import { ElementRef, WritableSignal, signal } from '@angular/core';
import {
  HEDGE_IDS,
  HedgeConfig,
  HedgeId,
  HedgeState,
  RabattageConfig,
  RabattageOption,
  TrimConfig,
  TrimPreset,
  createEmptyHedgeConfigs,
  createEmptyHedgeState,
} from '../../models/entry-modal.models.js';

export type PanelState =
  | { hedgeId: HedgeId; state: 'trim'; trim: TrimConfig }
  | { hedgeId: HedgeId; state: 'rabattage'; rabattage: RabattageConfig };

interface RelativeRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface SurroundingSpace {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 250;
const PANEL_MIN_WIDTH = 170;
const PANEL_MIN_HEIGHT = 180;
const PANEL_GUTTER = 18;
const PANEL_MIN_DRAG_WIDTH = 680;

const clampValue = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const HEDGE_POINTS: Record<HedgeId, string> = {
  'hedge-1': '175,790 680,790 680,865 175,865',
  'hedge-2': '175,80 225,80 225,800 175,800',
  'hedge-3': '175,80 1345,80 1345,140 175,140',
  'hedge-4': '1295,80 1350,80 1350,800 1295,800',
  'hedge-5': '1125,340 1178,340 1178,650 1065,650 1065,595 1125,595',
  'hedge-6': '380,185 450,185 450,640 680,640 680,710 380,710',
  'hedge-7': '1030,785 1350,785 1350,865 1030,865',
  'hedge-8': '785,640 835,640 835,875 785,875',
};

export class EntryModalPanelStore {
  readonly hedges = HEDGE_IDS;
  readonly hedgePoints = HEDGE_POINTS;
  readonly hedgeStates: WritableSignal<Record<HedgeId, HedgeState>>;
  readonly savedConfigs: WritableSignal<Record<HedgeId, HedgeConfig>>;
  readonly panelState: WritableSignal<PanelState | null>;
  readonly panelPosition: WritableSignal<{ left: number; top: number }>;
  readonly panelError: WritableSignal<string | null>;
  readonly floatingPanelEnabled: WritableSignal<boolean>;
  currentPanelSize: { width: number; height: number };
  hostRectSnapshot: DOMRect | null;

  private canvasHost?: ElementRef<HTMLElement>;
  private dragOffset = { x: 0, y: 0 };
  private onPanelDragMove: (event: PointerEvent) => void;
  private onPanelDragEnd: () => void;

  constructor() {
    const signals = createPanelSignals();
    this.hedgeStates = signals.hedgeStates;
    this.savedConfigs = signals.savedConfigs;
    this.panelState = signals.panelState;
    this.panelPosition = signals.panelPosition;
    this.panelError = signals.panelError;
    this.floatingPanelEnabled = signals.floatingPanelEnabled;
    this.currentPanelSize = { width: PANEL_WIDTH, height: PANEL_HEIGHT };
    this.hostRectSnapshot = null;
    this.onPanelDragMove = (event: PointerEvent) => this.handlePanelDragMove(event);
    this.onPanelDragEnd = () => this.stopDragging();
  }

  setCanvasHost(ref?: ElementRef<HTMLElement>): void {
    this.canvasHost = ref;
  }

  panelFloats(): boolean {
    return this.floatingPanelEnabled();
  }

  cycleHedge(event: MouseEvent, hedgeId: HedgeId): void {
    const activePanel = this.panelState();
    if (activePanel && activePanel.hedgeId !== hedgeId) {
      this.closePanel(true);
    }
    const states = { ...this.hedgeStates() };
    const current = states[hedgeId];
    const next = this.nextState(current);
    states[hedgeId] = next;
    this.hedgeStates.set(states);
    this.panelError.set(null);

    if (next === 'none') {
      this.resetHedgeSelection(hedgeId);
      this.panelState.set(null);
      return;
    }

    const target = event.currentTarget as SVGGraphicsElement | null;
    if (target) {
      this.updatePanelPosition(target);
    }

    const saved = this.savedConfigs()[hedgeId];
    if (next === 'trim') {
      const base: TrimConfig =
        saved.state === 'trim' && saved.trim
          ? { ...saved.trim }
          : { mode: 'custom', inside: false, top: false, outside: false };
      this.panelState.set({ hedgeId, state: 'trim', trim: base });
      return;
    }
    const base: RabattageConfig =
      saved.state === 'rabattage' && saved.rabattage ? { ...saved.rabattage } : { option: 'partial', partialAmountText: '' };
    this.panelState.set({ hedgeId, state: 'rabattage', rabattage: base });
  }

  updateTrimSection(section: 'inside' | 'top' | 'outside', checked: boolean): void {
    const panel = this.panelState();
    if (!panel || panel.state !== 'trim') {
      return;
    }
    const updated: TrimConfig = {
      ...panel.trim,
      mode: 'custom',
      preset: undefined,
      [section]: checked,
    };
    this.panelState.set({ ...panel, trim: updated });
    this.panelError.set(null);
  }

  selectTrimPreset(preset: TrimPreset): void {
    const panel = this.panelState();
    if (!panel || panel.state !== 'trim') {
      return;
    }
    const updated: TrimConfig = {
      mode: 'preset',
      preset,
      inside: false,
      top: false,
      outside: false,
    };
    this.panelState.set({ ...panel, trim: updated });
    this.panelError.set(null);
  }

  selectRabattage(option: RabattageOption): void {
    const panel = this.panelState();
    if (!panel || panel.state !== 'rabattage') {
      return;
    }
    const updated: RabattageConfig =
      option === 'partial'
        ? { option, partialAmountText: panel.rabattage.partialAmountText }
        : { option };
    this.panelState.set({ ...panel, rabattage: updated });
    if (option !== 'partial') {
      this.panelError.set(null);
    }
  }

  updatePartialAmount(value: string): void {
    const panel = this.panelState();
    if (!panel || panel.state !== 'rabattage') {
      return;
    }
    this.panelState.set({ ...panel, rabattage: { ...panel.rabattage, partialAmountText: value } });
  }

  savePanel(): void {
    const panel = this.panelState();
    if (!panel) {
      return;
    }

    if (panel.state === 'trim' && !this.trimSelectionExists(panel.trim)) {
      this.panelError.set('Select at least one trim option.');
      return;
    }

    if (panel.state === 'rabattage' && panel.rabattage?.option === 'partial') {
      const text = panel.rabattage.partialAmountText?.trim();
      if (!text) {
        this.panelError.set('Please describe how much to trim off.');
        return;
      }
    }

    const nextConfigs = { ...this.savedConfigs() };
    nextConfigs[panel.hedgeId] =
      panel.state === 'trim'
        ? { state: panel.state, trim: panel.trim }
        : { state: panel.state, rabattage: panel.rabattage };
    this.savedConfigs.set(nextConfigs);
    this.closePanel();
  }

  cancelPanel(): void {
    this.closePanel(true);
  }

  closePanel(resetSelection = false): void {
    const panel = this.panelState();
    if (!panel) {
      this.panelError.set(null);
      this.stopDragging();
      return;
    }
    if (resetSelection) {
      this.resetHedgeSelection(panel.hedgeId);
    }
    this.panelState.set(null);
    this.panelError.set(null);
    this.stopDragging();
  }

  trimHasCustomSelections(): boolean {
    const panel = this.panelState();
    if (!panel || panel.state !== 'trim') {
      return false;
    }
    return !!(panel.trim.inside || panel.trim.top || panel.trim.outside);
  }

  trimPresetSelected(): TrimPreset | null {
    const panel = this.panelState();
    if (!panel || panel.state !== 'trim') {
      return null;
    }
    if (panel.trim.mode === 'preset' && panel.trim.preset) {
      return panel.trim.preset;
    }
    return null;
  }

  getHedgeState(hedgeId: HedgeId): HedgeState {
    return this.hedgeStates()[hedgeId];
  }

  hasSavedConfig(hedgeId: HedgeId): boolean {
    return !!this.savedConfigs()[hedgeId] && this.savedConfigs()[hedgeId].state !== 'none';
  }

  buildHedgePayload(): Record<HedgeId, HedgeConfig> {
    const states = this.hedgeStates();
    const saved = this.savedConfigs();
    const result = {} as Record<HedgeId, HedgeConfig>;
    HEDGE_IDS.forEach((hedgeId) => {
      const state = states[hedgeId];
      const savedConfig = saved[hedgeId];
      if (state === 'trim') {
        if (savedConfig?.state === 'trim') {
          result[hedgeId] = savedConfig;
        } else {
          result[hedgeId] = { state: 'trim', trim: savedConfig?.trim };
        }
        return;
      }
      if (state === 'rabattage') {
        if (savedConfig?.state === 'rabattage') {
          result[hedgeId] = savedConfig;
        } else {
          result[hedgeId] = { state: 'rabattage', rabattage: savedConfig?.rabattage };
        }
        return;
      }
      result[hedgeId] = { state: 'none' };
    });
    return result;
  }

  reset(): void {
    this.hedgeStates.set(createEmptyHedgeState());
    this.savedConfigs.set(createEmptyHedgeConfigs());
    this.panelState.set(null);
    this.panelError.set(null);
    this.panelPosition.set({ left: 0, top: 0 });
    this.stopDragging();
  }

  loadFromConfigs(configs: Record<string, HedgeConfig>): void {
    const nextStates = createEmptyHedgeState();
    const nextConfigs = createEmptyHedgeConfigs();
    HEDGE_IDS.forEach((hedgeId) => {
      const config = configs[hedgeId] ?? { state: 'none' };
      nextStates[hedgeId] = config.state ?? 'none';
      nextConfigs[hedgeId] = { ...config };
    });
    this.hedgeStates.set(nextStates);
    this.savedConfigs.set(nextConfigs);
    this.panelState.set(null);
    this.panelError.set(null);
  }

  beginPanelDrag(event: PointerEvent): void {
    event.preventDefault();
    const grip = event.currentTarget as HTMLElement | null;
    const panel = grip?.closest('.hedge-panel');
    const hostRect = this.canvasHost?.nativeElement.getBoundingClientRect();
    if (!panel || !hostRect || !this.panelFloats()) {
      return;
    }
    const panelRect = panel.getBoundingClientRect();
    this.dragOffset = {
      x: event.clientX - panelRect.left,
      y: event.clientY - panelRect.top,
    };
    this.hostRectSnapshot = hostRect;
    window.addEventListener('pointermove', this.onPanelDragMove);
    window.addEventListener('pointerup', this.onPanelDragEnd);
  }

  destroy(): void {
    this.stopDragging();
  }

  /* @internal */
  forcePanelPositionForTest(element: SVGGraphicsElement): void {
    this.updatePanelPosition(element);
  }

  private trimSelectionExists(config: TrimConfig): boolean {
    if (config.mode === 'preset') {
      return !!config.preset;
    }
    return !!(config.inside || config.top || config.outside);
  }

  private resetHedgeSelection(hedgeId: HedgeId): void {
    const states = { ...this.hedgeStates() };
    states[hedgeId] = 'none';
    this.hedgeStates.set(states);
    const configs = { ...this.savedConfigs() };
    configs[hedgeId] = { state: 'none' };
    this.savedConfigs.set(configs);
  }

  private nextState(state: HedgeState): HedgeState {
    if (state === 'none') {
      return 'trim';
    }
    if (state === 'trim') {
      return 'rabattage';
    }
    return 'none';
  }

  private updatePanelPosition(element: SVGGraphicsElement): void {
    const hostRect = this.canvasHost?.nativeElement.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    if (!hostRect) {
      return;
    }
    const panelSize = this.updatePanelDimensions(hostRect);
    const relativeRect: RelativeRect = {
      left: rect.left - hostRect.left,
      right: rect.right - hostRect.left,
      top: rect.top - hostRect.top,
      bottom: rect.bottom - hostRect.top,
      width: rect.width,
      height: rect.height,
    };
    const spaces: SurroundingSpace = {
      left: relativeRect.left - PANEL_GUTTER,
      right: hostRect.width - relativeRect.right - PANEL_GUTTER,
      top: relativeRect.top - PANEL_GUTTER,
      bottom: hostRect.height - relativeRect.bottom - PANEL_GUTTER,
    };
    const horizontalRoom = Math.max(spaces.left, spaces.right) >= panelSize.width;
    const verticalRoom = Math.max(spaces.top, spaces.bottom) >= panelSize.height;
    const canFloat = hostRect.width >= PANEL_MIN_DRAG_WIDTH && (horizontalRoom || verticalRoom);
    this.floatingPanelEnabled.set(canFloat);
    if (!canFloat) {
      this.panelPosition.set({ left: PANEL_GUTTER, top: hostRect.height + PANEL_GUTTER });
      this.stopDragging();
      return;
    }

    const anchored = this.computeAnchoredPosition(relativeRect, spaces, hostRect, panelSize);
    this.panelPosition.set(this.normalizePanelPosition(anchored.left, anchored.top, hostRect, panelSize));
  }

  private computeAnchoredPosition(
    rect: RelativeRect,
    spaces: SurroundingSpace,
    hostRect: DOMRect,
    panelSize: { width: number; height: number },
  ): { left: number; top: number } {
    const left =
      spaces.right >= panelSize.width
        ? rect.right + PANEL_GUTTER
        : spaces.left >= panelSize.width
          ? rect.left - panelSize.width - PANEL_GUTTER
          : (hostRect.width - panelSize.width) / 2;

    let top = rect.top + (rect.height - panelSize.height) / 2;
    if (top < PANEL_GUTTER && spaces.bottom >= panelSize.height) {
      top = rect.bottom + PANEL_GUTTER;
    } else if (top + panelSize.height > hostRect.height - PANEL_GUTTER && spaces.top >= panelSize.height) {
      top = rect.top - panelSize.height - PANEL_GUTTER;
    }

    return { left, top };
  }

  handlePanelDragMove(event: PointerEvent): void {
    if (!this.hostRectSnapshot || !this.panelFloats()) {
      return;
    }
    const hostRect = this.hostRectSnapshot;
    const panelSize = this.currentPanelSize;
    const left = event.clientX - hostRect.left - this.dragOffset.x;
    const top = event.clientY - hostRect.top - this.dragOffset.y;
    this.panelPosition.set(this.normalizePanelPosition(left, top, hostRect, panelSize));
  }

  stopDragging(): void {
    if (!this.hostRectSnapshot) {
      return;
    }
    window.removeEventListener('pointermove', this.onPanelDragMove);
    window.removeEventListener('pointerup', this.onPanelDragEnd);
    this.hostRectSnapshot = null;
  }

  private updatePanelDimensions(hostRect: DOMRect): { width: number; height: number } {
    const compact = hostRect.width < 900;
    const width = clampValue(hostRect.width * (compact ? 0.32 : 0.38), PANEL_MIN_WIDTH, PANEL_WIDTH);
    const height = clampValue(hostRect.height * (compact ? 0.4 : 0.5), PANEL_MIN_HEIGHT, PANEL_HEIGHT);
    this.currentPanelSize = { width, height };
    return this.currentPanelSize;
  }

  private normalizePanelPosition(
    left: number,
    top: number,
    hostRect: DOMRect,
    panelSize: { width: number; height: number },
  ): { left: number; top: number } {
    const maxTop = hostRect.height - panelSize.height - PANEL_GUTTER;

    if (left + panelSize.width > hostRect.width - PANEL_GUTTER) {
      left = hostRect.width - panelSize.width - PANEL_GUTTER;
    }
    if (left < PANEL_GUTTER) {
      left = PANEL_GUTTER;
    }

    if (top < PANEL_GUTTER) {
      top = PANEL_GUTTER;
    }
    if (top > maxTop) {
      top = maxTop;
    }

    return { left, top };
  }
}

interface PanelSignals {
  hedgeStates: WritableSignal<Record<HedgeId, HedgeState>>;
  savedConfigs: WritableSignal<Record<HedgeId, HedgeConfig>>;
  panelState: WritableSignal<PanelState | null>;
  panelPosition: WritableSignal<{ left: number; top: number }>;
  panelError: WritableSignal<string | null>;
  floatingPanelEnabled: WritableSignal<boolean>;
}

export const createPanelSignals = (): PanelSignals => ({
  hedgeStates: signal<Record<HedgeId, HedgeState>>(createEmptyHedgeState()),
  savedConfigs: signal<Record<HedgeId, HedgeConfig>>(createEmptyHedgeConfigs()),
  panelState: signal<PanelState | null>(null),
  panelPosition: signal({ left: 0, top: 0 }),
  panelError: signal<string | null>(null),
  floatingPanelEnabled: signal(true),
});
