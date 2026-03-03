import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import {
  EntryCalendarPayload,
  EntryModalPayload,
  EntryVariant,
  HEDGE_IDS,
  HedgeConfig,
  HedgeId,
  HedgeState,
  RabattageConfig,
  RabattageOption,
  TrimConfig,
  TrimPreset,
} from '../../models/entry-modal.models.js';

const hedgesList = HEDGE_IDS;

type PanelState =
  | TrimPanelState
  | RabattagePanelState;

interface TrimPanelState {
  hedgeId: HedgeId;
  state: 'trim';
  trim: TrimConfig;
}

interface RabattagePanelState {
  hedgeId: HedgeId;
  state: 'rabattage';
  rabattage: RabattageConfig;
}

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
const trimSelectionExists = (config: TrimConfig): boolean => {
  if (config.mode === 'preset') {
    return !!config.preset;
  }
  return !!(config.inside || config.top || config.outside);
};

const HEDGE_POINTS: Record<HedgeId, string> = {
  'hedge-1': '175,790 680,790 680,865 175,865',
  'hedge-2': '175,80 225,80 225,800 175,800',
  'hedge-3': '175,80 1345,80 1345,140 175,140',
  'hedge-4': '1295,80 1350,80 1350,800 1295,800',
  'hedge-5': '1125,340 1178,340 1178,650 1065,650 1065,595 1125,595',
  'hedge-6': '380,185 450,185 450,640 680,640 680,710 380,710',
  'hedge-7': '1030,785 1350,785 1350,865 1030,865',
  'hedge-8': '785,640 835,640 835,875 785,875',
};

const createEmptyHedgeState = (): Record<HedgeId, HedgeState> =>
  HEDGE_IDS.reduce((acc, id) => ({ ...acc, [id]: 'none' }), {} as Record<HedgeId, HedgeState>);

const createEmptyHedgeConfig = (): Record<HedgeId, HedgeConfig> =>
  HEDGE_IDS.reduce((acc, id) => ({ ...acc, [id]: { state: 'none' } }), {} as Record<HedgeId, HedgeConfig>);

/* c8 ignore start */
const createHedgeStateSignal = () => signal<Record<HedgeId, HedgeState>>(createEmptyHedgeState());
const createSavedConfigsSignal = () => signal<Record<HedgeId, HedgeConfig>>(createEmptyHedgeConfig());
const createPanelStateSignal = () => signal<PanelState | null>(null);
const createPanelPositionSignal = () => signal({ left: 0, top: 0 });
const createPanelErrorSignal = () => signal<string | null>(null);
/* c8 ignore end */

const extractDigits = (value: string): string => value.replace(/\D/g, '');
const normalizeNorthAmericanDigits = (value: string): string => {
  let digits = extractDigits(value);
  if (digits.startsWith('1') && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
};

const formatNorthAmericanPhone = (digits: string): string => {
  if (!digits) {
    return '';
  }
  if (digits.length <= 3) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const northAmericanPhoneValidator: ValidatorFn = (control) => {
  const raw = (control.value as string | null) ?? '';
  if (!raw) {
    return null;
  }
  return normalizeNorthAmericanDigits(raw).length === 10 ? null : { phoneInvalid: true };
};

@Component({
  selector: 'app-entry-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './entry-modal.component.html',
  styleUrl: './entry-modal.component.scss',
})
export class EntryModalComponent implements OnDestroy {
  @Input({ required: true }) open = false;
  private _variant: EntryVariant = 'warm-lead';
  @Input()
  get variant(): EntryVariant {
    return this._variant;
  }
  set variant(value: EntryVariant) {
    this._variant = value;
    this.syncCalendarValidators();
  }
  @Input() headline?: string;
  @Input() eyebrow?: string;
  @Input() subcopy?: string;
  @Input() primaryActionLabel?: string;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EntryModalPayload>();

  @ViewChild('canvasHost', { static: false }) private canvasHost?: ElementRef<HTMLElement>;

  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    address: ['', Validators.required],
    phone: ['', [Validators.required, northAmericanPhoneValidator]],
    email: ['', Validators.email],
    jobType: ['', Validators.required],
    jobValue: ['', Validators.required],
    desiredBudget: [''],
    additionalDetails: [''],
    calendar: this.fb.group({
      date: [''],
      startTime: [''],
      endTime: [''],
      notes: [''],
    }),
  });
  protected readonly calendarGroup = this.form.controls.calendar;

  readonly hedgeStates: WritableSignal<Record<HedgeId, HedgeState>>;
  readonly savedConfigs: WritableSignal<Record<HedgeId, HedgeConfig>>;
  readonly panelState: WritableSignal<PanelState | null>;
  readonly panelPosition: WritableSignal<{ left: number; top: number }>;
  readonly panelError: WritableSignal<string | null>;
  private currentPanelSize = { width: PANEL_WIDTH, height: PANEL_HEIGHT };
  private dragOffset = { x: 0, y: 0 };
  private hostRectSnapshot: DOMRect | null = null;
  private readonly onPanelDragMove = (event: PointerEvent) => this.handlePanelDragMove(event);
  private readonly onPanelDragEnd = () => this.stopDragging();
  /* c8 ignore next */
  private readonly floatingPanelEnabled = signal(true);
  protected panelFloats(): boolean {
    return this.floatingPanelEnabled();
  }

  private readonly jobTypeControl = this.form.controls.jobType;
  protected readonly jobTypeOptions = ['Hedge Trimming', 'Rabattage', 'Both'] as const;
  protected readonly rabattageOptions: RabattageOption[] = ['partial', 'total', 'total_no_roots'];

  protected trimHasCustomSelections(): boolean {
    const panel = this.panelState();
    if (!panel || panel.state !== 'trim') {
      return false;
    }
    return !!(panel.trim.inside || panel.trim.top || panel.trim.outside);
  }

  protected handlePhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }
    const digits = normalizeNorthAmericanDigits(input.value);
    const formatted = formatNorthAmericanPhone(digits);
    this.form.controls.phone.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  protected trimPresetSelected(): TrimPreset | null {
    const panel = this.panelState();
    if (!panel || panel.state !== 'trim') {
      return null;
    }
    if (panel.trim.mode === 'preset' && panel.trim.preset) {
      return panel.trim.preset;
    }
    return null;
  }

  protected readonly hedges = hedgesList;
  protected readonly hedgePoints = HEDGE_POINTS;

  protected jobTypeSelected(): boolean {
    return this.jobTypeControl.value !== '';
  }

  protected requiresCalendar(): boolean {
    return this.variant === 'customer';
  }

  constructor() {
    this.hedgeStates = createHedgeStateSignal();
    this.savedConfigs = createSavedConfigsSignal();
    this.panelState = createPanelStateSignal();
    this.panelPosition = createPanelPositionSignal();
    this.panelError = createPanelErrorSignal();
    this.syncCalendarValidators();
  }

  protected cycleHedge(event: MouseEvent, hedgeId: HedgeId): void {
    event.stopPropagation();
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
      let base: TrimConfig;
      if (saved.state === 'trim' && saved.trim) {
        base = { ...saved.trim };
      } else {
        base = { mode: 'custom', inside: false, top: false, outside: false };
      }
      this.panelState.set({ hedgeId, state: 'trim', trim: base });
    } else {
      let base: RabattageConfig;
      if (saved.state === 'rabattage' && saved.rabattage) {
        base = { ...saved.rabattage };
      } else {
        base = { option: 'partial', partialAmountText: '' };
      }
      this.panelState.set({ hedgeId, state: 'rabattage', rabattage: base });
    }
  }

  protected updateTrimSection(section: 'inside' | 'top' | 'outside', checked: boolean): void {
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

  protected selectTrimPreset(preset: TrimPreset): void {
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

  protected selectRabattage(option: RabattageOption): void {
    const panel = this.panelState();
    if (!panel || panel.state !== 'rabattage') {
      return;
    }
    let partialAmountText: string | undefined;
    if (option === 'partial') {
      partialAmountText = panel.rabattage.partialAmountText;
    }
    const updated: RabattageConfig = {
      option,
      partialAmountText,
    };
    this.panelState.set({ ...panel, rabattage: updated });
    if (option !== 'partial') {
      this.panelError.set(null);
    }
  }

  protected updatePartialAmount(value: string): void {
    const panel = this.panelState();
    if (!panel || panel.state !== 'rabattage') {
      return;
    }
    this.panelState.set({ ...panel, rabattage: { ...panel.rabattage, partialAmountText: value } });
  }

  protected savePanel(): void {
    const panel = this.panelState();
    if (!panel) {
      return;
    }

    if (panel.state === 'trim' && !trimSelectionExists(panel.trim)) {
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
    this.closePanel(false);
  }

  protected cancelPanel(): void {
    this.closePanel(true);
  }

  protected closePanel(resetSelection = false): void {
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

  protected closeModal(): void {
    this.resetModalState();
    this.closed.emit();
  }

  protected submitEntry(): void {
    this.syncCalendarValidators();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.validateCalendarRange()) {
      return;
    }

    const hedgesPayload = this.buildHedgePayload();
    const formValue = this.form.getRawValue();
    const payload: EntryModalPayload = {
      variant: this.variant,
      form: {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        address: formValue.address,
        phone: formValue.phone,
        email: formValue.email || undefined,
        jobType: formValue.jobType,
        jobValue: formValue.jobValue,
        desiredBudget: formValue.desiredBudget || undefined,
        additionalDetails: formValue.additionalDetails || undefined,
      },
      hedges: hedgesPayload,
    };

    const calendarPayload = this.buildCalendarPayload();
    if (calendarPayload) {
      payload.calendar = calendarPayload;
    }

    this.saved.emit(payload);
    this.resetModalState();
  }

  protected getHedgeState(hedgeId: HedgeId): HedgeState {
    return this.hedgeStates()[hedgeId];
  }

  protected hasSavedConfig(hedgeId: HedgeId): boolean {
    return !!this.savedConfigs()[hedgeId] && this.savedConfigs()[hedgeId].state !== 'none';
  }

  private syncCalendarValidators(): void {
    const calendar = this.calendarGroup;
    const controls = [calendar.controls.date, calendar.controls.startTime, calendar.controls.endTime];
    if (this.requiresCalendar()) {
      controls.forEach((control) => {
        control.addValidators(Validators.required);
        control.updateValueAndValidity({ emitEvent: false });
      });
      return;
    }
    controls.forEach((control) => {
      control.clearValidators();
      control.setErrors(null);
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private validateCalendarRange(): boolean {
    if (!this.requiresCalendar()) {
      return true;
    }
    const { date, startTime, endTime } = this.calendarGroup.getRawValue();
    if (!date || !startTime || !endTime) {
      this.calendarGroup.markAllAsTouched();
      return false;
    }
    const startIso = this.combineDateTime(date, startTime);
    const endIso = this.combineDateTime(date, endTime);
    const endControl = this.calendarGroup.controls.endTime;
    if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
      endControl.setErrors({ ...(endControl.errors ?? {}), timeOrder: true });
      endControl.markAsTouched();
      return false;
    }
    if (endControl.errors?.['timeOrder']) {
      const rest = { ...endControl.errors };
      delete rest['timeOrder'];
      endControl.setErrors(Object.keys(rest).length ? rest : null);
    }
    return true;
  }

  private combineDateTime(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }

  private buildCalendarPayload(): EntryCalendarPayload | undefined {
    if (!this.requiresCalendar()) {
      return undefined;
    }
    const { date, startTime, endTime, notes } = this.calendarGroup.getRawValue();
    if (!date || !startTime || !endTime) {
      return undefined;
    }
    return {
      start: this.combineDateTime(date, startTime),
      end: this.combineDateTime(date, endTime),
      notes: notes?.trim() ? notes.trim() : undefined,
    };
  }

  private buildHedgePayload(): Record<HedgeId, HedgeConfig> {
    return { ...this.savedConfigs() };
  }

  private clearSavedConfig(hedgeId: HedgeId): void {
    const configs = { ...this.savedConfigs() };
    configs[hedgeId] = { state: 'none' };
    this.savedConfigs.set(configs);
  }

  private resetHedgeSelection(hedgeId: HedgeId): void {
    const states = { ...this.hedgeStates() };
    states[hedgeId] = 'none';
    this.hedgeStates.set(states);
    this.clearSavedConfig(hedgeId);
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

  private resetModalState(): void {
    this.form.reset();
    this.hedgeStates.set(createEmptyHedgeState());
    this.savedConfigs.set(createEmptyHedgeConfig());
    this.panelState.set(null);
    this.panelError.set(null);
    this.panelPosition.set({ left: 0, top: 0 });
    this.stopDragging();
    this.syncCalendarValidators();
  }

  protected get eyebrowText(): string {
    if (this.eyebrow) {
      return this.eyebrow;
    }
    return this.variant === 'customer' ? 'Customer' : 'Warm / Lead';
  }

  protected get headlineText(): string {
    if (this.headline) {
      return this.headline;
    }
    return this.variant === 'customer' ? 'Add Customer' : 'Add Entry';
  }

  protected get subcopyText(): string {
    if (this.subcopy) {
      return this.subcopy;
    }
    return 'Speed-first workflow • Dark Evergreen theme';
  }

  protected get primaryLabelText(): string {
    if (this.primaryActionLabel) {
      return this.primaryActionLabel;
    }
    return this.variant === 'customer' ? 'Save Customer' : 'Save Warm Lead';
  }

  protected beginPanelDrag(event: PointerEvent): void {
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

  private handlePanelDragMove(event: PointerEvent): void {
    if (!this.hostRectSnapshot || !this.panelFloats()) {
      return;
    }
    const hostRect = this.hostRectSnapshot;
    const panelSize = this.currentPanelSize;
    const left = event.clientX - hostRect.left - this.dragOffset.x;
    const top = event.clientY - hostRect.top - this.dragOffset.y;
    this.panelPosition.set(this.normalizePanelPosition(left, top, hostRect, panelSize));
  }

  private stopDragging(): void {
    if (!this.hostRectSnapshot) {
      return;
    }
    window.removeEventListener('pointermove', this.onPanelDragMove);
    window.removeEventListener('pointerup', this.onPanelDragEnd);
    this.hostRectSnapshot = null;
  }

  ngOnDestroy(): void {
    this.stopDragging();
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
