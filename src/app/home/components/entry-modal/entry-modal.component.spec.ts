import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, WritableSignal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { vi } from 'vitest';
import { EntryModalComponent, northAmericanPhoneValidator } from './entry-modal.component.js';
import {
  EntryModalPayload,
  HedgeConfig,
  HedgeState,
  TrimPreset,
} from '../../models/entry-modal.models.js';

interface Rect {
  left: number;
  top: number;
  right: number;
  width: number;
  height: number;
}

interface EntryModalTestHandles {
  canvasHost?: ElementRef<HTMLElement>;
  currentPanelSize: { width: number; height: number };
  hostRectSnapshot: DOMRect | null;
  floatingPanelEnabled: WritableSignal<boolean>;
  panelPosition: WritableSignal<{ left: number; top: number }>;
  panelState: WritableSignal<unknown>;
  panelError: WritableSignal<string | null>;
  hedgeStates: WritableSignal<Record<string, HedgeState>>;
  savedConfigs: WritableSignal<Record<string, HedgeConfig>>;
  beginPanelDrag(event: PointerEvent): void;
  onPanelDragMove(event: PointerEvent): void;
  onPanelDragEnd(): void;
  closePanel(resetSelection?: boolean): void;
  cancelPanel(): void;
  savePanel(): void;
  panelFloats(): boolean;
  trimHasCustomSelections(): boolean;
  trimPresetSelected(): TrimPreset | null;
  readonly eyebrowText: string;
  readonly headlineText: string;
  readonly subcopyText: string;
  readonly primaryLabelText: string;
}

const asInternals = (instance: EntryModalComponent): EntryModalTestHandles =>
  instance as unknown as EntryModalTestHandles;

const createElementRef = (rect: Rect): ElementRef<HTMLElement> =>
  ({
    nativeElement: {
      getBoundingClientRect: () => ({
        ...rect,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }),
    } as HTMLElement,
  }) as unknown as ElementRef<HTMLElement>;

describe('EntryModalComponent', () => {
  let fixture: ComponentFixture<EntryModalComponent>;
  let component: EntryModalComponent;
  let internals: EntryModalTestHandles;

  const hostRect: Rect = { left: 0, top: 0, right: 820, width: 820, height: 520 };
  const createEvent = (): MouseEvent =>
    ({
      stopPropagation: vi.fn(),
      currentTarget: {
        getBoundingClientRect: () => ({
          left: 10,
          top: 20,
          right: 120,
          width: 110,
          height: 60,
          bottom: 80,
          x: 10,
          y: 20,
          toJSON: () => ({}),
        }),
      },
    } as unknown as MouseEvent);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryModalComponent);
    component = fixture.componentInstance;
    internals = asInternals(component);
    component.open = true;
    internals.canvasHost = createElementRef(hostRect);
    fixture.detectChanges();
  });

  it('cycles hedges and saves trim configuration in payload', () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);

    component.form.patchValue({
      firstName: 'Alex',
      lastName: 'Stone',
      address: '123 Pine Ave',
      phone: '514-123-4567',
      email: 'alex@eco.test',
      jobType: 'Hedge Trimming',
      jobValue: '1250',
      desiredBudget: '',
      additionalDetails: '',
    });

    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 500, width: 500, height: 400 });

    component['cycleHedge'](createEvent(), 'hedge-1');
    expect(component['panelPosition']().left).toBeGreaterThan(0);
    expect(component['panelPosition']().top).toBeGreaterThanOrEqual(0);
    component['updateTrimSection']('inside', true);
    component['savePanel']();
    expect(component['hasSavedConfig']('hedge-1')).toBe(true);
    expect(component['getHedgeState']('hedge-1')).toBe('trim');
    const previewPayload = component['buildHedgePayload']();
    expect(previewPayload['hedge-1'].trim?.inside).toBe(true);

    component['submitEntry']();

    expect(savedSpy).toHaveBeenCalledTimes(1);
    const payload = savedSpy.mock.calls[0][0];
    expect(payload.variant).toBe('warm-lead');
    expect(payload.form.firstName).toBe('Alex');
    expect(payload.form.email).toBe('alex@eco.test');
    expect(payload.hedges['hedge-1'].trim?.inside).toBe(true);
    expect(component['panelState']()).toBeNull();
    expect(component['hasSavedConfig']('hedge-1')).toBe(false);
  });

  it('validates partial rabattage input before saving', () => {
    component['panelState'].set({
      hedgeId: 'hedge-2',
      state: 'rabattage',
      rabattage: { option: 'partial', partialAmountText: '' },
    });

    component['savePanel']();
    expect(component['panelError']()).toContain('Please describe');

    component['updatePartialAmount']('12 inches');
    component['savePanel']();
    expect(component['panelError']()).toBeNull();
    expect(component['savedConfigs']()['hedge-2'].rabattage?.partialAmountText).toBe('12 inches');
  });

  it('requires selecting at least one trim option before saving', () => {
    component['panelState'].set({
      hedgeId: 'hedge-3',
      state: 'trim',
      trim: { mode: 'custom', inside: false, top: false, outside: false },
    });

    component['savePanel']();
    expect(component['panelError']()).toContain('Select at least one trim option');

    component['updateTrimSection']('inside', true);
    component['savePanel']();
    expect(component['panelError']()).toBeNull();
    expect(component['savedConfigs']()['hedge-3'].state).toBe('trim');
  });

  it('accepts trim preset selections when saving', () => {
    component['panelState'].set({
      hedgeId: 'hedge-8',
      state: 'trim',
      trim: { mode: 'preset', preset: 'normal', inside: false, top: false, outside: false },
    });

    component['savePanel']();
    expect(component['panelError']()).toBeNull();
    expect(component['savedConfigs']()['hedge-8'].state).toBe('trim');
  });

  it('resets state when closing modal', () => {
    component.form.patchValue({ firstName: 'Will', jobType: 'Both', jobValue: '500' });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-3': 'trim' });
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    component['closeModal']();

    expect(closedSpy).toHaveBeenCalled();
    expect(component.form.value.firstName).toBe('');
    expect(component['hedgeStates']()['hedge-3']).toBe('none');
  });

  it('cycles through hedge states including rabattage and clearing configs', () => {
    const event = createEvent();
    component['cycleHedge'](event, 'hedge-4');
    expect(component['hedgeStates']()['hedge-4']).toBe('trim');

    component['cycleHedge'](event, 'hedge-4');
    expect(component['hedgeStates']()['hedge-4']).toBe('rabattage');

    component['cycleHedge'](event, 'hedge-4');
    expect(component['hedgeStates']()['hedge-4']).toBe('none');
    expect(component['panelState']()).toBeNull();
  });

  it('hydrates panel selections from saved configs when cycling again', () => {
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true, top: false, outside: false } },
      'hedge-2': { state: 'rabattage', rabattage: { option: 'total_no_roots', partialAmountText: '' } },
    });

    component['cycleHedge'](createEvent(), 'hedge-1');
    const trimState = component['panelState']();
    expect(trimState?.state).toBe('trim');
    if (trimState?.state === 'trim') {
      expect(trimState.trim.inside).toBe(true);
    }
    component['savePanel']();

    const rabEvent = createEvent();
    component['cycleHedge'](rabEvent, 'hedge-2');
    component['cycleHedge'](rabEvent, 'hedge-2');
    const rabState = component['panelState']();
    expect(rabState?.state).toBe('rabattage');
    if (rabState?.state === 'rabattage') {
      expect(rabState.rabattage.option).toBe('total_no_roots');
    }
  });

  it('handles helper guard clauses when no panel is active', () => {
    component['panelState'].set(null);
    component['updateTrimSection']('inside', true);
    component['selectTrimPreset']('normal');
    component['selectRabattage']('total');
    component['updatePartialAmount']('n/a');
    component['savePanel']();
    expect(component['panelError']()).toBeNull();
  });

  it('skips panel position updates when target is missing', () => {
    const event = { stopPropagation: vi.fn(), currentTarget: null } as unknown as MouseEvent;
    component['cycleHedge'](event, 'hedge-3');
    expect(component['panelPosition']()).toEqual({ left: 0, top: 0 });
  });

  it('selects rabattage totals and clears errors', () => {
    component['panelState'].set({
      hedgeId: 'hedge-6',
      state: 'rabattage',
      rabattage: { option: 'partial', partialAmountText: '10%' },
    });
    component['panelError'].set('Needs detail');

    component['selectRabattage']('partial');

    component['selectRabattage']('total_no_roots');

    expect(component['panelError']()).toBeNull();
    const state = component['panelState']();
    expect(state?.state).toBe('rabattage');
    if (state?.state === 'rabattage') {
      expect(state.rabattage.option).toBe('total_no_roots');
      expect(state.rabattage.partialAmountText).toBeUndefined();
    }
  });

  it('derives helper signals for trim selections', () => {
    expect(component['trimHasCustomSelections']()).toBe(false);
    expect(component['trimPresetSelected']()).toBeNull();

    component['panelState'].set({
      hedgeId: 'hedge-3',
      state: 'trim',
      trim: { mode: 'preset', preset: 'normal' },
    });
    expect(component['trimPresetSelected']()).toBe('normal');

    component['panelState'].set({
      hedgeId: 'hedge-3',
      state: 'trim',
      trim: { mode: 'custom', inside: true, top: false, outside: false },
    });
    expect(component['trimHasCustomSelections']()).toBe(true);
  });

  it('closePanel wipes transient state', () => {
    component['panelState'].set({
      hedgeId: 'hedge-2',
      state: 'trim',
      trim: { mode: 'custom', inside: true },
    });
    component['panelError'].set('Whoops');

    component['closePanel']();

    expect(component['panelState']()).toBeNull();
    expect(component['panelError']()).toBeNull();
  });

  it('closePanel is resilient when no panel is active', () => {
    component['panelState'].set(null);
    component['panelError'].set('Oops');

    component['closePanel']();

    expect(component['panelError']()).toBeNull();
  });

  it('cancelPanel clears hedge selection and saved configs', () => {
    component['panelState'].set({
      hedgeId: 'hedge-2',
      state: 'trim',
      trim: { mode: 'custom', inside: true },
    });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-2': 'trim' });

    component['cancelPanel']();

    expect(component['panelState']()).toBeNull();
    expect(component['hedgeStates']()['hedge-2']).toBe('none');
    expect(component['savedConfigs']()['hedge-2'].state).toBe('none');
  });

  it('updates panel position when host and element rects exist', () => {
    const element = {
      getBoundingClientRect: () => ({
        left: 50,
        right: 200,
        top: 80,
        bottom: 120,
        width: 150,
        height: 40,
        x: 50,
        y: 80,
        toJSON: () => ({}),
      }),
    } as SVGGraphicsElement;

    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 780, width: 780, height: 480 });

    component['updatePanelPosition'](element);

    expect(component['panelPosition']().left).toBeGreaterThan(0);
    expect(component['panelPosition']().top).toBeGreaterThanOrEqual(0);

    internals.canvasHost = undefined;
    component['panelPosition'].set({ left: 0, top: 0 });
    component['updatePanelPosition'](element);
    expect(component['panelPosition']()).toEqual({ left: 0, top: 0 });
  });

  it('keeps hedge panels fully visible within canvas bounds', () => {
    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 760, width: 760, height: 320 });

    const nearTop = {
      getBoundingClientRect: () => ({
        left: 210,
        right: 250,
        top: 0,
        bottom: 40,
        width: 40,
        height: 40,
        x: 210,
        y: 0,
        toJSON: () => ({}),
      }),
    } as SVGGraphicsElement;

    component['updatePanelPosition'](nearTop);
    const firstHostRect = internals.canvasHost!.nativeElement.getBoundingClientRect();
    const firstPanelSize = internals.currentPanelSize;
    const firstTop = component['panelPosition']().top;
    expect(firstTop).toBeGreaterThanOrEqual(0);
    expect(firstTop + firstPanelSize.height).toBeLessThanOrEqual(firstHostRect.height);

    const nearBottom = {
      getBoundingClientRect: () => ({
        left: 520,
        right: 560,
        top: 260,
        bottom: 300,
        width: 40,
        height: 40,
        x: 520,
        y: 260,
        toJSON: () => ({}),
      }),
    } as SVGGraphicsElement;

    component['updatePanelPosition'](nearBottom);
    const hostHeight = internals.canvasHost!.nativeElement.getBoundingClientRect().height;
    const secondPanelSize = internals.currentPanelSize;
    const secondTop = component['panelPosition']().top;
    expect(secondTop).toBeGreaterThanOrEqual(0);
    expect(secondTop + secondPanelSize.height).toBeLessThanOrEqual(hostHeight);
  });

  it('shows inline validation errors when required fields missing', () => {
    component.form.get('email')?.setValue('not-an-email');
    component.form.get('phone')?.setValue('');
    component.form.markAllAsTouched();
    fixture.detectChanges();

    const errors = fixture.nativeElement.querySelectorAll('.error') as NodeListOf<HTMLElement>;
    expect(errors.length).toBeGreaterThanOrEqual(5);
    expect(Array.from(errors).some((node) => node.textContent?.includes('Select one job type'))).toBe(true);
    expect(Array.from(errors).some((node) => node.textContent?.trim() === 'Required')).toBe(true);
  });

  it('shows phone format guidance when number is incomplete', () => {
    component.form.get('phone')?.setValue('12345');
    component.form.get('phone')?.markAsTouched();
    fixture.detectChanges();

    const phoneErrors = fixture.nativeElement.querySelectorAll('.error') as NodeListOf<HTMLElement>;
    expect(Array.from(phoneErrors).some((node) => node.textContent?.includes('10-digit phone'))).toBe(true);
  });

  it('normalizes nullish values inside the phone validator', () => {
    const control = new FormControl<string | null>(null);
    expect(northAmericanPhoneValidator(control)).toBeNull();
  });

  it('supports dragging the hedge panel within bounds', () => {
    component.form.get('jobType')?.setValue('Both');
    component['panelState'].set({
      hedgeId: 'hedge-5',
      state: 'trim',
      trim: { mode: 'custom', inside: false, top: false, outside: false },
    });
    internals.currentPanelSize = { width: 200, height: 150 };
    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 700, width: 700, height: 320 });
    const panelEl = document.createElement('div');
    panelEl.classList.add('hedge-panel');
    panelEl.getBoundingClientRect = () => ({
      left: 30,
      top: 30,
      right: 250,
      bottom: 210,
      width: 220,
      height: 180,
      x: 30,
      y: 30,
      toJSON: () => ({}),
    });
    const header = document.createElement('header');
    panelEl.appendChild(header);
    document.body.appendChild(panelEl);

    component['beginPanelDrag']({
      currentTarget: header,
      clientX: 60,
      clientY: 60,
      preventDefault: () => undefined,
    } as unknown as PointerEvent);

    component['onPanelDragMove']({ clientX: 280, clientY: 50 } as PointerEvent);
    const pos = component['panelPosition']();
    expect(pos.left).toBeGreaterThan(0);
    expect(pos.top).toBeGreaterThanOrEqual(0);

    component['onPanelDragMove']({ clientX: -50, clientY: -50 } as PointerEvent);
    const clampedToTop = component['panelPosition']();
    expect(clampedToTop.left).toBeGreaterThanOrEqual(18);
    expect(clampedToTop.top).toBeGreaterThanOrEqual(18);

    component['onPanelDragMove']({ clientX: 2000, clientY: 2000 } as PointerEvent);
    const hostDims = internals.canvasHost!.nativeElement.getBoundingClientRect();
    const size = internals.currentPanelSize;
    const clampedToBottom = component['panelPosition']();
    expect(clampedToBottom.left).toBeLessThanOrEqual(hostDims.width - size.width - 18);
    expect(clampedToBottom.top).toBeLessThanOrEqual(hostDims.height - size.height - 18);

    component['onPanelDragEnd']();
    component['closePanel']();
    document.body.removeChild(panelEl);
  });

  it('centers the panel when no horizontal room exists but vertical space is available', () => {
    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 720, width: 720, height: 620 });

    const spanning = {
      getBoundingClientRect: () => ({
        left: 40,
        right: 680,
        top: 60,
        bottom: 320,
        width: 640,
        height: 260,
        x: 40,
        y: 60,
        toJSON: () => ({}),
      }),
    } as SVGGraphicsElement;

    component['updatePanelPosition'](spanning);
    expect(component['panelFloats']()).toBe(true);
    const hostDims = internals.canvasHost!.nativeElement.getBoundingClientRect();
    const size = internals.currentPanelSize;
    const expectedLeft = (hostDims.width - size.width) / 2;
    expect(component['panelPosition']().left).toBeCloseTo(expectedLeft, 3);
  });

  it('guards drag helpers when the panel cannot float', () => {
    const header = document.createElement('header');
    component['panelPosition'].set({ left: 10, top: 10 });
    internals.floatingPanelEnabled.set(false);
    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 400, width: 400, height: 200 });

    component['beginPanelDrag']({
      currentTarget: header,
      clientX: 20,
      clientY: 20,
      preventDefault: () => undefined,
    } as unknown as PointerEvent);

    expect(internals.hostRectSnapshot).toBeNull();

    component['onPanelDragMove']({ clientX: 5, clientY: 5 } as PointerEvent);
    expect(component['panelPosition']()).toEqual({ left: 10, top: 10 });
  });

  it('uses the desktop panel sizing branch for wide canvases', () => {
    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 980, width: 980, height: 620 });

    const element = {
      getBoundingClientRect: () => ({
        left: 100,
        right: 300,
        top: 120,
        bottom: 220,
        width: 200,
        height: 100,
        x: 100,
        y: 120,
        toJSON: () => ({}),
      }),
    } as SVGGraphicsElement;

    component['updatePanelPosition'](element);
    const size = internals.currentPanelSize;
    expect(size.width).toBe(280);
    expect(component['panelFloats']()).toBe(true);
  });

  it('switches to compact mode on narrow canvases', () => {
    internals.canvasHost = createElementRef({ left: 0, top: 0, right: 400, width: 400, height: 200 });
    component['cycleHedge'](createEvent(), 'hedge-1');
    expect(component['panelFloats']()).toBe(false);
  });

  it('does not render shell markup when modal is closed', () => {
    const closedFixture = TestBed.createComponent(EntryModalComponent);
    const closedInstance = closedFixture.componentInstance;
    closedInstance.open = false;
    closedFixture.detectChanges();

    const shell = closedFixture.nativeElement.querySelector('.modal-shell');
    expect(shell).toBeNull();
  });

  it('renders trim and rabattage panels in the template', () => {
    component.form.get('jobType')?.setValue('Both');
    fixture.detectChanges();

    component['panelPosition'].set({ left: 10, top: 10 });
    component['panelState'].set({
      hedgeId: 'hedge-5',
      state: 'trim',
      trim: { mode: 'custom', inside: true, top: false, outside: false },
    });
    expect(component['panelState']()).not.toBeNull();
    fixture.detectChanges();

    let panelEl = fixture.nativeElement.querySelector('.hedge-panel') as HTMLElement | null;
    expect(panelEl).not.toBeNull();
    component['panelError'].set('Select at least one trim option.');
    fixture.detectChanges();
    const trimError = panelEl?.querySelector('.error') as HTMLElement | null;
    expect(trimError?.textContent).toContain('Select at least one trim option.');
    const pointerEvent =
      typeof PointerEvent !== 'undefined'
        ? new PointerEvent('pointerdown', { clientX: 0, clientY: 0 })
        : (new Event('pointerdown') as PointerEvent);
    panelEl?.querySelector('.panel-header')?.dispatchEvent(pointerEvent);
    let trimPanel = panelEl?.querySelector('.panel-title') as HTMLElement | null;
    expect(trimPanel).not.toBeNull();
    expect(trimPanel?.textContent).toContain('Trim options');

    component['panelState'].set({
      hedgeId: 'hedge-5',
      state: 'rabattage',
      rabattage: { option: 'partial', partialAmountText: '' },
    });
    expect(component['panelState']()).not.toBeNull();
    fixture.detectChanges();

    panelEl = fixture.nativeElement.querySelector('.hedge-panel') as HTMLElement | null;
    expect(panelEl).not.toBeNull();
    trimPanel = panelEl?.querySelector('.panel-title') as HTMLElement | null;
    expect(trimPanel).not.toBeNull();
    expect(trimPanel?.textContent).toContain('Rabattage options');

    component['savePanel']();
    fixture.detectChanges();

    const rabattageError = fixture.nativeElement.querySelector('.hedge-panel .error')?.textContent ?? '';
    expect(rabattageError).toContain('Please describe');

    component['updatePartialAmount']('Half hedge');
    component['savePanel']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.hedge-panel')).toBeNull();
  });

  it('cycles nextState helper deterministically', () => {
    expect(component['nextState']('none')).toBe('trim');
    expect(component['nextState']('trim')).toBe('rabattage');
    expect(component['nextState']('rabattage')).toBe('none');
  });

  it('clearSavedConfig resets stored entries', () => {
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-8': { state: 'trim' },
    });

    component['clearSavedConfig']('hedge-8');

    expect(component['savedConfigs']()['hedge-8'].state).toBe('none');
  });

  it('prevents submission when the form is invalid', () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);

    component['submitEntry']();

    expect(component.form.get('firstName')?.touched).toBe(true);
    expect(savedSpy).not.toHaveBeenCalled();
  });

  it('requires calendar details for customer entries', () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Maya',
      lastName: 'K',
      address: '42 Spruce',
      phone: '438-555-9900',
      jobType: 'Hedge Trimming',
      jobValue: '900',
    });

    component['submitEntry']();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(component.form.get('calendar.date')?.touched).toBe(true);
  });

  it('emits calendar payload when customer scheduling is provided', () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Noah',
      lastName: 'B',
      address: '9 Cedar',
      phone: '438-000-0000',
      jobType: 'Both',
      jobValue: '1500',
    });
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('11:00');
    component.form.get('calendar.notes')?.setValue('Bring ladder');

    component['submitEntry']();

    expect(savedSpy).toHaveBeenCalledTimes(1);
    const payload = savedSpy.mock.calls[0][0] as EntryModalPayload;
    expect(payload.calendar).toBeDefined();
    expect(payload.calendar?.start).toContain('2026-03-05');
    expect(payload.calendar?.end).toContain('2026-03-05');
    expect(payload.calendar?.notes).toBe('Bring ladder');
  });

  it('flags when end time precedes start time and clears the error after fixing it', () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Liam',
      lastName: 'N',
      address: '512 Maple',
      phone: '438-111-2222',
      jobType: 'Hedge Trimming',
      jobValue: '650',
    });
    component.form.get('calendar.date')?.setValue('2026-03-06');
    component.form.get('calendar.startTime')?.setValue('11:00');
    component.form.get('calendar.endTime')?.setValue('10:00');

    component['submitEntry']();
    expect(savedSpy).not.toHaveBeenCalled();
    expect(component.form.get('calendar.endTime')?.errors?.['timeOrder']).toBe(true);

    component.form.get('calendar.endTime')?.setValue('12:30');
    component['submitEntry']();
    expect(component.form.get('calendar.endTime')?.errors?.['timeOrder']).toBeUndefined();
  });

  it('computes default and custom UI copy for the modal shell', () => {
    expect(internals.eyebrowText).toBe('Warm / Lead');
    expect(internals.headlineText).toBe('Add Entry');
    expect(internals.subcopyText).toContain('Speed-first workflow');
    expect(internals.primaryLabelText).toBe('Save Warm Lead');

    component.variant = 'customer';
    expect(internals.eyebrowText).toBe('Customer');
    expect(internals.headlineText).toBe('Add Customer');
    expect(internals.primaryLabelText).toBe('Save Customer');

    component.eyebrow = 'Custom Eyebrow';
    component.headline = 'Custom Headline';
    component.subcopy = 'Custom Subcopy';
    component.primaryActionLabel = 'Log Customer';

    expect(internals.eyebrowText).toBe('Custom Eyebrow');
    expect(internals.headlineText).toBe('Custom Headline');
    expect(internals.subcopyText).toBe('Custom Subcopy');
    expect(internals.primaryLabelText).toBe('Log Customer');
  });

  it('executes template event bindings when interacting via the DOM', () => {
    component.form.get('jobType')?.setValue('Both');
    fixture.detectChanges();

    const polygon = fixture.nativeElement.querySelector('polygon#hedge-1') as SVGPolygonElement;
    expect(polygon).not.toBeNull();
    polygon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(component['panelState']()?.state).toBe('trim');

    component['panelState'].set({
      hedgeId: 'hedge-1',
      state: 'trim',
      trim: { mode: 'custom', inside: false, top: false, outside: false },
    });
    fixture.detectChanges();

    const phoneField = fixture.nativeElement.querySelector('input[formcontrolname="phone"]') as HTMLInputElement;
    phoneField.value = '4385551234';
    phoneField.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.form.get('phone')?.value).toBe('(438) 555-1234');

    const trimCheckboxes = fixture.nativeElement.querySelectorAll('.trim-options input') as NodeListOf<HTMLInputElement>;
    const [insideCheckbox, topCheckbox, outsideCheckbox] = Array.from(trimCheckboxes);
    insideCheckbox.checked = true;
    insideCheckbox.dispatchEvent(new Event('change'));
    topCheckbox.checked = true;
    topCheckbox.dispatchEvent(new Event('change'));
    outsideCheckbox.checked = true;
    outsideCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    insideCheckbox.checked = false;
    insideCheckbox.dispatchEvent(new Event('change'));
    topCheckbox.checked = false;
    topCheckbox.dispatchEvent(new Event('change'));
    outsideCheckbox.checked = false;
    outsideCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const normalPreset = fixture.nativeElement.querySelector('input[name="trimPreset"][value="normal"]') as HTMLInputElement;
    normalPreset.dispatchEvent(new Event('change'));

    const totalPreset = fixture.nativeElement.querySelector('input[name="trimPreset"][value="total"]') as HTMLInputElement;
    totalPreset.dispatchEvent(new Event('change'));

    component['panelState'].set({
      hedgeId: 'hedge-2',
      state: 'rabattage',
      rabattage: { option: 'partial', partialAmountText: '' },
    });
    fixture.detectChanges();

    const rabattageTextarea = fixture.nativeElement.querySelector('.partial-input textarea') as HTMLTextAreaElement;
    rabattageTextarea.value = '5 ft';
    rabattageTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const rabattageState = component['panelState']();
    expect(rabattageState?.state).toBe('rabattage');
    if (rabattageState?.state === 'rabattage') {
      expect(rabattageState.rabattage.partialAmountText).toBe('5 ft');
    }

    const rabattageTotal = fixture.nativeElement.querySelector('input[name="rabattageOption"][value="total"]') as HTMLInputElement;
    rabattageTotal.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  });

  it('renders the calendar scheduling section for customer variant', () => {
    const customerFixture = TestBed.createComponent(EntryModalComponent);
    const customerComponent = customerFixture.componentInstance;
    customerComponent.open = true;
    customerComponent.variant = 'customer';
    customerFixture.detectChanges();

    const calendarBlock = customerFixture.nativeElement.querySelector('.calendar-block') as HTMLElement | null;
    expect(calendarBlock).not.toBeNull();

    customerComponent.form.get('calendar.date')?.markAsTouched();
    customerComponent.form.get('calendar.startTime')?.markAsTouched();
    customerComponent.form.get('calendar.endTime')?.markAsTouched();
    customerFixture.detectChanges();

    const errorTexts = Array.from(calendarBlock?.querySelectorAll('.error') ?? []).map((node) =>
      node.textContent?.trim(),
    );
    expect(errorTexts.some((text) => text === 'Required')).toBe(true);
  });

  it('wires close buttons through template events', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);
    fixture.detectChanges();

    const headerClose = fixture.nativeElement.querySelector('.icon-btn') as HTMLButtonElement;
    headerClose.click();
    expect(closedSpy).toHaveBeenCalledTimes(1);

    const footerClose = fixture.nativeElement.querySelector('.form-footer .ghost') as HTMLButtonElement;
    footerClose.click();
    expect(closedSpy).toHaveBeenCalledTimes(2);
  });

  it('invokes panel action buttons via template bindings', () => {
    component.form.get('jobType')?.setValue('Hedge Trimming');
    component['panelState'].set({
      hedgeId: 'hedge-4',
      state: 'trim',
      trim: { mode: 'custom', inside: false, top: false, outside: false },
    });
    component['panelPosition'].set({ left: 18, top: 18 });
    const cancelPanelSpy = vi.spyOn(internals, 'cancelPanel');
    const savePanelSpy = vi.spyOn(internals, 'savePanel');
    fixture.detectChanges();

    const panelButtons = fixture.nativeElement.querySelectorAll('.hedge-panel footer button') as NodeListOf<HTMLButtonElement>;
    panelButtons[0].click();
    panelButtons[1].click();

    expect(cancelPanelSpy).toHaveBeenCalled();
    expect(savePanelSpy).toHaveBeenCalled();
  });

  it('submits the form via the ngSubmit binding', () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.form.patchValue({
      firstName: 'Jess',
      lastName: 'H',
      address: '1 Cedar',
      phone: '514-000-0000',
      email: '',
      jobType: 'Hedge Trimming',
      jobValue: '900',
      desiredBudget: '',
      additionalDetails: '',
    });
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(savedSpy).toHaveBeenCalledTimes(1);
  });

  it('formats phone inputs into NANP style and validates digit count', () => {
    const makeEvent = (value: string) =>
      ({ target: Object.assign(document.createElement('input'), { value }) } as unknown as Event);

    component['handlePhoneInput'](makeEvent(''));
    expect(component.form.get('phone')?.value).toBe('');

    component['handlePhoneInput'](makeEvent('51'));
    expect(component.form.get('phone')?.value).toBe('(51');

    component['handlePhoneInput'](makeEvent('5145'));
    expect(component.form.get('phone')?.value).toBe('(514) 5');

    component['handlePhoneInput'](makeEvent('+1 (438) 555-12345'));
    expect(component.form.get('phone')?.value).toBe('(438) 555-1234');
    expect(component.form.get('phone')?.errors).toBeNull();

    component['handlePhoneInput']({ target: null } as unknown as Event);

    component.form.get('phone')?.setValue('(438) 555-12');
    component.form.get('phone')?.markAsTouched();
    component.form.updateValueAndValidity();
    expect(component.form.get('phone')?.errors?.['phoneInvalid']).toBeTruthy();
  });

  it('resets previous hedge selection when choosing a different hedge mid-edit', () => {
    component['panelState'].set({
      hedgeId: 'hedge-1',
      state: 'trim',
      trim: { mode: 'custom', inside: false, top: false, outside: false },
    });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-1': 'trim' });

    component['cycleHedge'](createEvent(), 'hedge-2');

    expect(component['panelState']()?.hedgeId).toBe('hedge-2');
    expect(component['hedgeStates']()['hedge-1']).toBe('none');
  });
});
