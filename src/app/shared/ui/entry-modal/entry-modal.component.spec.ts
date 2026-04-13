import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { vi } from 'vitest';
import { EntryModalComponent, northAmericanPhoneValidator } from './entry-modal.component.js';
import { EntryModalValidationService } from './entry-modal-validation.service.js';
import {
  CalendarEventsServiceStub,
  EntryModalTestHandles,
  Rect,
  assignCanvasHost,
  asEntryModalInternals,
  createElementRef,
  createPanelMouseEvent,
  localTimeString,
} from '@shared/testing/entry-modal-test-helpers.js';
import { EntryModalPayload } from '@shared/domain/entry/entry-modal.models.js';
import { CalendarEventSummary, CalendarEventsService } from '@shared/domain/entry/calendar-events.service.js';
class EntryRepositoryServiceStub {
  findClientMatch = vi.fn().mockResolvedValue(null);
}
import { EntryRepositoryService } from '@shared/domain/entry/entry-repository.service.js';

describe('EntryModalComponent', () => {
  let fixture: ComponentFixture<EntryModalComponent>;
  let component: EntryModalComponent;
  let internals: EntryModalTestHandles;
  let calendarService: CalendarEventsServiceStub;
  let entryRepository: EntryRepositoryServiceStub;
  const defaultPayload: EntryModalPayload = {
    variant: 'customer',
    form: {
      firstName: 'Lina',
      lastName: 'Foret',
      address: '12 Pine Ave',
      phone: '5141112222',
      email: 'lina@example.com',
      jobType: 'Full trim',
      jobValue: '$950',
      desiredBudget: '900',
      additionalDetails: 'Prefer mornings',
    },
    hedges: {
      'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true } },
      'hedge-2': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '3ft' } },
      'hedge-3': { state: 'none' },
      'hedge-4': { state: 'none' },
      'hedge-5': { state: 'none' },
      'hedge-6': { state: 'none' },
      'hedge-7': { state: 'none' },
      'hedge-8': { state: 'none' },
    },
    calendar: {
      start: '2026-04-02T13:00:00.000Z',
      end: '2026-04-02T15:00:00.000Z',
      timeZone: 'America/Toronto',
    },
  };

  const hostRect: Rect = { left: 0, top: 0, right: 820, width: 820, height: 520 };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryModalComponent],
      providers: [
        { provide: CalendarEventsService, useClass: CalendarEventsServiceStub },
        { provide: EntryRepositoryService, useClass: EntryRepositoryServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryModalComponent);
    component = fixture.componentInstance;
    internals = asEntryModalInternals(component);
    component.open = true;
    assignCanvasHost(internals, hostRect);
    fixture.detectChanges();
    calendarService = TestBed.inject(CalendarEventsService) as unknown as CalendarEventsServiceStub;
    entryRepository = TestBed.inject(EntryRepositoryService) as unknown as EntryRepositoryServiceStub;
  });

  it('ignores falsy initialEntry assignments', () => {
    const spy = vi.spyOn(component as unknown as { prefillFromPayload: (value: EntryModalPayload) => void }, 'prefillFromPayload');
    component.initialEntry = null;
    expect(spy).not.toHaveBeenCalled();
  });

  it('derives shell copy defaults and honors overrides', () => {
    expect((component as unknown as { headlineText: string })['headlineText']).toBe('Add Entry');
    expect((component as unknown as { subcopyText: string })['subcopyText']).toContain('Speed-first');
    expect((component as unknown as { primaryLabelText: string })['primaryLabelText']).toBe('Save Warm Lead');

    component.headline = 'Custom Headline';
    component.subcopy = 'Custom body copy';
    component.primaryActionLabel = 'Do It';
    expect((component as unknown as { headlineText: string })['headlineText']).toBe('Custom Headline');
    expect((component as unknown as { subcopyText: string })['subcopyText']).toBe('Custom body copy');
    expect((component as unknown as { primaryLabelText: string })['primaryLabelText']).toBe('Do It');
  });

  it('cycles hedges and saves trim configuration in payload', async () => {
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

    assignCanvasHost(internals, { left: 0, top: 0, right: 500, width: 500, height: 400 });

    component['cycleHedge'](createPanelMouseEvent(), 'hedge-1');
    expect(component['panelPosition']().left).toBeGreaterThan(0);
    expect(component['panelPosition']().top).toBeGreaterThanOrEqual(0);
    component['updateTrimSection']('inside', true);
    component['savePanel']();
    expect(component['hasSavedConfig']('hedge-1')).toBe(true);
    expect(component['getHedgeState']('hedge-1')).toBe('trim');
    const previewPayload = internals.panelStore.buildHedgePayload();
    expect(previewPayload['hedge-1'].trim?.inside).toBe(true);

    await component['submitEntry']();

    expect(savedSpy).toHaveBeenCalledTimes(1);
    const payload = savedSpy.mock.calls[0][0];
    expect(payload.variant).toBe('warm-lead');
    expect(payload.form.firstName).toBe('Alex');
    expect(payload.form.email).toBe('alex@eco.test');
    expect(payload.hedges['hedge-1'].trim?.inside).toBe(true);
    expect(component['panelState']()).toBeNull();
    expect(component['hasSavedConfig']('hedge-1')).toBe(false);
  });

  it('prefills customer data when initialEntry is provided', async () => {
    const payload = JSON.parse(JSON.stringify(defaultPayload)) as EntryModalPayload;
    component.initialEntry = payload;
    await fixture.whenStable();
    const formValue = component['form'].value;
    expect(formValue.firstName).toBe(payload.form.firstName);
    expect(formValue.jobType).toBe(payload.form.jobType);
    expect(component['calendarGroup'].value.date).toBe('2026-04-02');
    expect(component['calendarGroup'].value.startTime).toBe(localTimeString(payload.calendar!.start));
    expect(component['calendarGroup'].value.endTime).toBe(localTimeString(payload.calendar!.end));
    const hedges = internals.panelStore.buildHedgePayload();
    expect(hedges['hedge-1'].state).toBe('trim');
    expect(calendarService.listEventsForDate).toHaveBeenCalledWith('2026-04-02');
  });

  it('prefill skips calendar loading for warm-lead entries', async () => {
    const warmPayload: EntryModalPayload = {
      ...(JSON.parse(JSON.stringify(defaultPayload)) as EntryModalPayload),
      variant: 'warm-lead',
      calendar: undefined,
    };
    calendarService.listEventsForDate.mockClear();
    component.initialEntry = warmPayload;
    await fixture.whenStable();
    expect(component['calendarGroup'].value.date).toBe('');
    expect(calendarService.listEventsForDate).not.toHaveBeenCalled();
  });

  it('blocks customer submissions without any hedge selections', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    (component as unknown as { _variant: 'warm-lead' | 'customer' })._variant = 'customer';
    component.form.patchValue({
      firstName: 'Client',
      lastName: 'Test',
      address: '500 Elm',
      phone: '(438) 000-0000',
      jobType: 'Hedge Trimming',
      jobValue: '900',
      calendar: {
        date: '2026-03-10',
        startTime: '09:00',
        endTime: '10:00',
      },
    });

    await component['submitEntry']();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(component['hedgeSelectionError']()).toContain('Select at least one hedge');
  });

  it('blocks warm-lead submissions when no hedge is selected and additional details are blank', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'warm-lead';
    component.form.patchValue({
      firstName: 'Lead',
      lastName: 'NoMap',
      address: '17 Green',
      phone: '(438) 222-3333',
      jobType: 'Hedge Trimming',
      jobValue: '700',
      additionalDetails: '',
    });

    await component['submitEntry']();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(component['hedgeSelectionError']()).toContain('Select at least one hedge');
    expect(component['requiredFieldErrors']()).toContain('Hedge map selection (or Additional details)');
  });

  it('allows saving without map selection when additional details are provided', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'warm-lead';
    component.form.patchValue({
      firstName: 'Lead',
      lastName: 'Details',
      address: '25 River',
      phone: '(438) 333-4444',
      jobType: 'Hedge Trimming',
      jobValue: '840',
      additionalDetails: 'Back yard hedge does not match the map layout.',
    });

    await component['submitEntry']();

    expect(savedSpy).toHaveBeenCalledTimes(1);
    expect(component['hedgeSelectionError']()).toBeNull();
  });

  it('blocks save when a selected trim hedge has no configured option', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'warm-lead';
    component.form.patchValue({
      firstName: 'Lead',
      lastName: 'NeedsTrimConfig',
      address: '91 Birch',
      phone: '(438) 777-2222',
      jobType: 'Hedge Trimming',
      jobValue: '920',
      additionalDetails: '',
    });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-1': 'trim' });
    component['savedConfigs'].set({ ...component['savedConfigs'](), 'hedge-1': { state: 'none' } });

    await component['submitEntry']();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(component['hedgeSelectionError']()).toContain('Hedge 1');
    expect(component['requiredFieldErrors']()).toContain(
      'Hedge 1: select at least one trim option or preset.',
    );
  });

  it('clears hedge selection errors when a customer restores at least one hedge', () => {
    component.variant = 'customer';
    component['hedgeSelectionError'].set('Select at least one hedge before saving this customer entry.');
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true } },
    });

    component['cycleHedge'](createPanelMouseEvent(), 'hedge-1');

    expect(component['hedgeSelectionError']()).toBeNull();
  });

  it('blocks saving when a selected hedge has no saved configuration', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.form.patchValue({
      firstName: 'Partial',
      lastName: 'Config',
      address: '777 Test',
      phone: '(438) 111-1111',
      jobType: 'Both',
      jobValue: '1200',
    });
    component['hedgeStates'].set({
      ...component['hedgeStates'](),
      'hedge-4': 'trim',
    });

    await component['submitEntry']();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(component['requiredFieldErrors']()).toContain(
      'Hedge 4: select at least one trim option or preset.',
    );
  });

  it('clears hedge selection errors when the trim panel is saved for customers', () => {
    component.variant = 'customer';
    component['hedgeSelectionError'].set('Select at least one hedge before saving this customer entry.');
    component['hedgeStates'].set({
      ...component['hedgeStates'](),
      'hedge-3': 'trim',
    });
    component['panelState'].set({
      hedgeId: 'hedge-3',
      state: 'trim',
      trim: { mode: 'custom', inside: true, top: false, outside: false },
    });

    component['savePanel']();

    expect(component['hedgeSelectionError']()).toBeNull();
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
    vi.useFakeTimers();
    component.form.patchValue({ firstName: 'Will', jobType: 'Both', jobValue: '500' });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-3': 'trim' });
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    component['closeModal']();
    vi.advanceTimersByTime(220);

    expect(closedSpy).toHaveBeenCalled();
    expect(component.form.value.firstName).toBe('');
    expect(component['hedgeStates']()['hedge-3']).toBe('none');
    vi.useRealTimers();
  });

  it('cycles through hedge states including rabattage and clearing configs', () => {
    const event = createPanelMouseEvent();
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

    component['cycleHedge'](createPanelMouseEvent(), 'hedge-1');
    const trimState = component['panelState']();
    expect(trimState?.state).toBe('trim');
    if (trimState?.state === 'trim') {
      expect(trimState.trim.inside).toBe(true);
    }
    component['savePanel']();

    const rabEvent = createPanelMouseEvent();
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

    assignCanvasHost(internals, { left: 0, top: 0, right: 780, width: 780, height: 480 });

    internals.panelStore.forcePanelPositionForTest(element);

    expect(component['panelPosition']().left).toBeGreaterThan(0);
    expect(component['panelPosition']().top).toBeGreaterThanOrEqual(0);

    assignCanvasHost(internals, undefined);
    component['panelPosition'].set({ left: 0, top: 0 });
    internals.panelStore.forcePanelPositionForTest(element);
    expect(component['panelPosition']()).toEqual({ left: 0, top: 0 });
  });

  it('keeps hedge panels fully visible within canvas bounds', () => {
    assignCanvasHost(internals, { left: 0, top: 0, right: 760, width: 760, height: 320 });

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

    internals.panelStore.forcePanelPositionForTest(nearTop);
    const firstHostRect = internals.canvasHost!.nativeElement.getBoundingClientRect();
    const firstPanelSize = internals.panelStore.currentPanelSize;
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

    internals.panelStore.forcePanelPositionForTest(nearBottom);
    const hostHeight = internals.canvasHost!.nativeElement.getBoundingClientRect().height;
    const secondPanelSize = internals.panelStore.currentPanelSize;
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

  it('lists missing required fields when save is attempted for a warm lead', async () => {
    await component['submitEntry']();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.required-fields-banner') as HTMLElement | null;
    expect(banner).not.toBeNull();
    const fields = Array.from(banner?.querySelectorAll('li') ?? []).map((node) =>
      node.textContent?.trim(),
    );
    expect(fields).toContain('First name');
    expect(fields).toContain('Last name');
    expect(fields).toContain('Home address');
    expect(fields).toContain('Phone number');
    expect(fields).toContain('Job type');
    expect(fields).toContain('Job value');
  });

  it('lists missing calendar fields when save is attempted for a customer', async () => {
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Kim',
      lastName: 'Nguyen',
      address: '10 Maple',
      phone: '(514) 555-1212',
      jobType: 'Hedge Trimming',
      jobValue: '800',
      calendar: {
        date: '',
        startTime: '',
        endTime: '',
      },
    });

    await component['submitEntry']();
    fixture.detectChanges();

    const fields = Array.from(
      fixture.nativeElement.querySelectorAll('.required-fields-banner li'),
    ).map((node) => (node as HTMLElement).textContent?.trim());
    expect(fields).toContain('Date');
    expect(fields).toContain('Start time');
    expect(fields).toContain('End time');
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
    internals.panelStore.currentPanelSize = { width: 200, height: 150 };
    assignCanvasHost(internals, { left: 0, top: 0, right: 700, width: 700, height: 320 });
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

    internals.panelStore.handlePanelDragMove({ clientX: 280, clientY: 50 } as PointerEvent);
    const pos = component['panelPosition']();
    expect(pos.left).toBeGreaterThan(0);
    expect(pos.top).toBeGreaterThanOrEqual(0);

    internals.panelStore.handlePanelDragMove({ clientX: -50, clientY: -50 } as PointerEvent);
    const clampedToTop = component['panelPosition']();
    expect(clampedToTop.left).toBeGreaterThanOrEqual(18);
    expect(clampedToTop.top).toBeGreaterThanOrEqual(18);

    internals.panelStore.handlePanelDragMove({ clientX: 2000, clientY: 2000 } as PointerEvent);
    const hostDims = internals.canvasHost!.nativeElement.getBoundingClientRect();
    const size = internals.panelStore.currentPanelSize;
    const clampedToBottom = component['panelPosition']();
    expect(clampedToBottom.left).toBeLessThanOrEqual(hostDims.width - size.width - 18);
    expect(clampedToBottom.top).toBeLessThanOrEqual(hostDims.height - size.height - 18);

    internals.panelStore.stopDragging();
    component['closePanel']();
    document.body.removeChild(panelEl);
  });

  it('centers the panel when no horizontal room exists but vertical space is available', () => {
    assignCanvasHost(internals, { left: 0, top: 0, right: 720, width: 720, height: 620 });

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

    internals.panelStore.forcePanelPositionForTest(spanning);
    expect(component['panelFloats']()).toBe(true);
    const hostDims = internals.canvasHost!.nativeElement.getBoundingClientRect();
    const size = internals.panelStore.currentPanelSize;
    const expectedLeft = (hostDims.width - size.width) / 2;
    expect(component['panelPosition']().left).toBeCloseTo(expectedLeft, 3);
  });

  it('guards drag helpers when the panel cannot float', () => {
    const header = document.createElement('header');
    component['panelPosition'].set({ left: 10, top: 10 });
    internals.panelStore.floatingPanelEnabled.set(false);
    assignCanvasHost(internals, { left: 0, top: 0, right: 400, width: 400, height: 200 });

    component['beginPanelDrag']({
      currentTarget: header,
      clientX: 20,
      clientY: 20,
      preventDefault: () => undefined,
    } as unknown as PointerEvent);

    expect(internals.panelStore.hostRectSnapshot).toBeNull();

    internals.panelStore.handlePanelDragMove({ clientX: 5, clientY: 5 } as PointerEvent);
    expect(component['panelPosition']()).toEqual({ left: 10, top: 10 });
  });

  it('uses the desktop panel sizing branch for wide canvases', () => {
    assignCanvasHost(internals, { left: 0, top: 0, right: 980, width: 980, height: 620 });

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

    internals.panelStore.forcePanelPositionForTest(element);
    const size = internals.panelStore.currentPanelSize;
    expect(size.width).toBe(280);
    expect(component['panelFloats']()).toBe(true);
  });

  it('switches to compact mode on narrow canvases', () => {
    assignCanvasHost(internals, { left: 0, top: 0, right: 400, width: 400, height: 200 });
    component['cycleHedge'](createPanelMouseEvent(), 'hedge-1');
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

  it('prevents submission when the form is invalid', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);

    await component['submitEntry']();

    expect(component.form.get('firstName')?.touched).toBe(true);
    expect(savedSpy).not.toHaveBeenCalled();
  });

  it('requires calendar details for customer entries', async () => {
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

    await component['submitEntry']();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(component.form.get('calendar.date')?.touched).toBe(true);
  });

  it('emits calendar payload when customer scheduling is provided', async () => {
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
    component['hedgeStates'].set({
      ...component['hedgeStates'](),
      'hedge-1': 'trim',
    });
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-1': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
    });
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('11:00');

    await component['submitEntry']();

    expect(savedSpy).toHaveBeenCalledTimes(1);
    const payload = savedSpy.mock.calls[0][0] as EntryModalPayload;
    expect(payload.calendar).toBeDefined();
    expect(payload.calendar?.start).toContain('2026-03-05');
    expect(payload.calendar?.end).toContain('2026-03-05');
  });

  it('flags when end time precedes start time and clears the error after fixing it', async () => {
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
      additionalDetails: 'Manual date/time verification.',
    });
    component.form.get('calendar.date')?.setValue('2026-03-06');
    component.form.get('calendar.startTime')?.setValue('11:00');
    component.form.get('calendar.endTime')?.setValue('10:00');

    await component['submitEntry']();
    expect(savedSpy).not.toHaveBeenCalled();
    expect(component.form.get('calendar.endTime')?.errors?.['timeOrder']).toBe(true);

    component.form.get('calendar.endTime')?.setValue('12:30');
    await component['submitEntry']();
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

  it('loads calendar events when the date changes', async () => {
    const spy = vi.spyOn(calendarService, 'listEventsForDate').mockResolvedValue([
      { id: 'evt-1', summary: 'Existing job', start: '2026-03-05T13:00:00Z', end: '2026-03-05T14:00:00Z' },
    ]);
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-05');

    await component['refreshCalendarEventsForDate']('2026-03-05');

    expect(spy).toHaveBeenCalledWith('2026-03-05');
    expect(component['calendarEvents']()).toHaveLength(1);
  });

  it('clears calendar preview when switching away from customer variant', () => {
    const isolated = TestBed.createComponent(EntryModalComponent).componentInstance;
    isolated.variant = 'customer';
    isolated['calendarEvents'].set([{ id: 'evt', summary: 'job', start: '', end: '' }]);
    isolated['calendarEventsError'].set('Boom');

    isolated.variant = 'warm-lead';

    expect(isolated['calendarEvents']()).toHaveLength(0);
    expect(isolated['calendarEventsError']()).toBeNull();
  });

  it('shows an error message when calendar events cannot load', async () => {
    vi.spyOn(calendarService, 'listEventsForDate').mockRejectedValue(new Error('boom'));
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-08');

    await component['refreshCalendarEventsForDate']('2026-03-08');

    expect(component['calendarEventsError']()).toContain('Unable to load Google Calendar');
  });

  it('handles calendar date changes when scheduling is optional or date missing', () => {
    component.variant = 'warm-lead';
    component['calendarEvents'].set([{ id: 'evt', summary: 'Job', start: '', end: '' }]);

    component['handleCalendarDateChange']();
    expect(component['calendarEvents']()).toHaveLength(1); // early return, nothing cleared

    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('');
    component['handleCalendarDateChange']();
    expect(component['calendarEvents']()).toHaveLength(0);
  });

  it('defaults the calendar date when scheduling is required', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('');
    const dateSpy = vi.spyOn(component as unknown as { todayIsoDate: () => string }, 'todayIsoDate').mockReturnValue('2026-03-09');
    const handleSpy = vi.spyOn(component as unknown as { handleCalendarDateChange: () => void }, 'handleCalendarDateChange');

    component['ensureCalendarDefaults']();

    expect(component.form.get('calendar.date')?.value).toBe('2026-03-09');
    expect(handleSpy).toHaveBeenCalled();
    dateSpy.mockRestore();
    handleSpy.mockRestore();
  });

  it('rebuilds slot availability and marks conflicts', () => {
    component.variant = 'customer';
    const startIso = component['combineDateTime']('2026-03-05', '14:00');
    const endIso = component['combineDateTime']('2026-03-05', '15:30');
    component['rebuildCalendarSlots']('2026-03-05', [{ id: 'evt-1', summary: 'Booked', start: startIso, end: endIso }]);
    const slots = component['calendarSlots']();
    const slot14 = slots.find((slot) => slot.id === 'slot-14');
    expect(slot14?.status).toBe('booked');
    expect(slot14?.conflictSummary).toBe('Booked');
  });

  it('selects available slots and clears selection on manual edits', () => {
    component.variant = 'customer';
    component['calendarSlots'].set([
      { id: 'slot-08', startTime: '08:00', endTime: '10:00', label: '8-10', status: 'available' },
    ]);
    component['selectCalendarSlot']('slot-08');
    expect(component['selectedSlotId']()).toBe('slot-08');
    expect(component.form.get('calendar.startTime')?.value).toBe('08:00');
    component['handleManualTimeChange']();
    expect(component['selectedSlotId']()).toBeNull();
  });

  it('applies timeline selections, detects conflicts, and requires confirmation', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-05');
    const startIso = component['combineDateTime']('2026-03-05', '14:00');
    const endIso = component['combineDateTime']('2026-03-05', '15:00');
    component['rebuildTimelineEvents']('2026-03-05', [
      { id: 'evt-2', summary: 'Existing crew', start: startIso, end: endIso, location: '123 Pine' },
    ]);

    component['applyTimelineSelectionMinutes'](14 * 60, 15 * 60);

    const selection = component['timelineSelection']();
    expect(selection?.startMinutes).toBe(14 * 60);
    expect(component.form.get('calendar.startTime')?.value).toBe('13:45');
    expect(component['selectionConflict']()).toBe(true);
    expect(component['conflictWarningText']()).toContain('Existing crew');
    expect(component['isPrimaryDisabled']()).toBe(true);

    component['confirmTimelineConflict']();
    expect(component['conflictConfirmedFlag']()).toBe(true);
    expect(component['isPrimaryDisabled']()).toBe(false);
  });

  it('produces timeline selection and now-line styles', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue(component['todayIsoDate']());
    component['applyTimelineSelectionMinutes'](8 * 60, 9 * 60);

    const selectionStyle = component['timelineSelectionStyle']();
    expect(selectionStyle).not.toBeNull();
    expect(selectionStyle?.topPercent).toBeGreaterThanOrEqual(0);
    component['currentTimeMinutes'].set(12 * 60);
    const nowStyle = component['timelineNowLineStyle']();
    expect(nowStyle).not.toBeNull();
    expect(nowStyle?.topPercent).toBeGreaterThan(0);

    component['timelineSelection'].set({ startMinutes: 8 * 60, endMinutes: 8 * 60 });
    expect(component['timelineSelectionStyle']()).toBeNull();
  });

  it('applies selection offset while clamping to timeline bounds', () => {
    const offsetNearStart = component['applySelectionOffset'](7 * 60 + 10, 7 * 60 + 20);
    expect(offsetNearStart).toEqual({ start: 7 * 60, end: 7 * 60 + 30 });
    const offsetNearEnd = component['applySelectionOffset'](20 * 60 - 5, 20 * 60);
    expect(offsetNearEnd.end).toBe(20 * 60);
    expect(offsetNearEnd.start).toBe(20 * 60 - 30);
  });

  it('handles timeline pointer gestures and cleans up listeners', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-05');
    const gridRect: Rect = { left: 0, top: 0, right: 300, width: 300, height: 600 };
    component['timelineGrid'] = createElementRef(gridRect);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    component['onTimelinePointerDown']({ preventDefault: vi.fn(), clientY: 300 } as unknown as PointerEvent);
    expect(addSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(component.form.get('calendar.startTime')?.value).not.toBe('');
    component['handleTimelinePointerMove']({ preventDefault: vi.fn(), clientY: 450 } as unknown as PointerEvent);
    const selection = component['timelineSelection']();
    expect(selection).not.toBeNull();
    component['handleTimelinePointerUp']();
    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('skips pointer interactions when scheduling not required and marks date when missing', () => {
    component.variant = 'warm-lead';
    component['onTimelinePointerDown']({ preventDefault: vi.fn(), clientY: 100 } as unknown as PointerEvent);
    expect(component['timelineSelection']()).toBeNull();

    component.variant = 'customer';
    const dateControl = component.form.get('calendar.date') as FormControl<string | null>;
    const touchSpy = vi.spyOn(dateControl, 'markAsTouched');
    component['timelineGrid'] = undefined;
    component['onTimelinePointerDown']({ preventDefault: vi.fn(), clientY: 200 } as unknown as PointerEvent);
    expect(touchSpy).toHaveBeenCalled();
  });

  it('updates current time minutes only when viewing today', () => {
    vi.useFakeTimers();
    const today = '2026-03-05';
    vi.setSystemTime(new Date(`${today}T15:00:00-05:00`));
    const intervalSpy = vi
      .spyOn(window, 'setInterval')
      .mockImplementation((cb: TimerHandler) => {
        if (typeof cb === 'function') {
          cb();
        }
        return 123 as unknown as number;
      });
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue(today);
    component['syncCurrentTimeTicker']();
    expect(component['currentTimeMinutes']()).not.toBeNull();

    component.form.get('calendar.date')?.setValue('2026-03-06');
    component['updateCurrentTimeMinutes']();
    expect(component['currentTimeMinutes']()).toBeNull();

    component['currentTimeTicker'] = 456 as unknown as ReturnType<typeof setInterval>;
    component['clearCurrentTimeTicker']();
    expect(component['currentTimeTicker']).toBeNull();
    intervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it('clears current time minutes when outside the timeline window', () => {
    vi.useFakeTimers();
    const today = '2026-03-05';
    vi.setSystemTime(new Date(`${today}T05:15:00-05:00`));
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue(today);
    component['currentTimeMinutes'].set(9 * 60);

    component['updateCurrentTimeMinutes']();

    expect(component['currentTimeMinutes']()).toBeNull();
    vi.useRealTimers();
  });

  it('falls back to default minutes when timeline grid is missing', () => {
    const minutes = component['minutesFromPointer']({ clientY: 0 } as unknown as PointerEvent);
    expect(minutes).toBe(7 * 60);
  });

  it('renders timeline grid, events, and conflict banner in the template', () => {
    const timelineFixture = TestBed.createComponent(EntryModalComponent);
    const timelineComponent = timelineFixture.componentInstance;
    timelineComponent.open = true;
    timelineComponent.variant = 'customer';
    timelineComponent.form.get('calendar.date')?.setValue('2026-03-05');
    timelineComponent['timelineEvents'].set([
      {
        id: 'evt-tpl',
        summary: 'Booked job',
        location: '456 Cedar',
        startMinutes: 8 * 60,
        endMinutes: 9 * 60,
        topPercent: 10,
        heightPercent: 12,
        column: 0,
        columns: 1,
        leftPercent: 0,
        widthPercent: 100,
      } as never,
      {
        id: 'evt-nolocation',
        summary: 'Prep',
        startMinutes: 10 * 60,
        endMinutes: 10 * 60 + 30,
        topPercent: 30,
        heightPercent: 8,
        column: 0,
        columns: 1,
        leftPercent: 0,
        widthPercent: 100,
      } as never,
    ]);
    timelineComponent['timelineSelection'].set({ startMinutes: 9 * 60, endMinutes: 10 * 60 });
    timelineComponent['selectionConflict'].set(true);
    timelineComponent['conflictSummary'].set('Booked job');
    timelineComponent['currentTimeMinutes'].set(9 * 60 + 30);
    timelineFixture.detectChanges();

    const block = timelineFixture.nativeElement.querySelector('.timeline-event-block') as HTMLElement;
    expect(block?.textContent).toContain('Booked job');
    const selection = timelineFixture.nativeElement.querySelector('.timeline-selection') as HTMLElement;
    expect(selection).not.toBeNull();
    const banner = timelineFixture.nativeElement.querySelector('.conflict-banner') as HTMLElement;
    expect(banner?.textContent).toContain('Conflicting job');
    const overrideButton = banner?.querySelector('button') as HTMLButtonElement;
    overrideButton?.click();
    timelineFixture.detectChanges();
    expect(banner?.textContent).toContain('Overlap confirmed');
    timelineComponent['conflictSummary'].set(null);
    timelineComponent['selectionConflict'].set(true);
    timelineFixture.detectChanges();
    expect(banner?.textContent).toContain('This slot overlaps an existing booking.');

    const grid = timelineFixture.nativeElement.querySelector('.timeline-grid') as HTMLElement;
    grid.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 600,
        left: 0,
        right: 300,
        width: 300,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    const pointerEvent =
      typeof PointerEvent === 'function'
        ? new PointerEvent('pointerdown', { clientY: 250 })
        : (new MouseEvent('pointerdown', { clientY: 250 }) as unknown as PointerEvent);
    grid.dispatchEvent(pointerEvent);
  });

  it('normalizes timeline events with overlapping columns', () => {
    component.variant = 'customer';
    component['rebuildTimelineEvents']('2026-03-05', [
      { id: 'evt-10', summary: 'A', start: component['combineDateTime']('2026-03-05', '09:00'), end: component['combineDateTime']('2026-03-05', '10:00') },
      { id: 'evt-11', summary: 'B', start: component['combineDateTime']('2026-03-05', '09:30'), end: component['combineDateTime']('2026-03-05', '10:30') },
      { id: 'evt-12', summary: 'C', start: component['combineDateTime']('2026-03-05', '11:30'), end: component['combineDateTime']('2026-03-05', '12:00') },
    ]);
    const events = component['timelineEvents']();
    expect(events).toHaveLength(3);
    expect(events.some((evt) => evt.column > 0)).toBe(true);
  });

  it('blocks submission until calendar conflicts are confirmed', async () => {
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Jon',
      lastName: 'Snow',
      address: '123 Wall',
      phone: '(438) 555-1010',
      jobType: 'Hedge Trimming',
      jobValue: '900',
    });
    component['hedgeStates'].set({
      ...component['hedgeStates'](),
      'hedge-2': 'trim',
    });
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-2': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
    });
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    component['selectionConflict'].set(true);
    component['conflictConfirmed'].set(false);
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);

    await component['submitEntry']();
    expect(savedSpy).not.toHaveBeenCalled();

    component['selectionConflict'].set(false);
    await component['submitEntry']();
    expect(savedSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores pointer move/up events when no drag selection exists', () => {
    component['timelineDragStartMinutes'] = null;
    component['handleTimelinePointerMove']({ preventDefault: vi.fn(), clientY: 50 } as unknown as PointerEvent);
    component['timelineSelection'].set(null);
    component['handleTimelinePointerUp']();
    expect(component['timelineSelection']()).toBeNull();
  });

  it('exposes timeline pointer handler references', () => {
    expect(typeof component['onTimelinePointerMove']).toBe('function');
    expect(typeof component['onTimelinePointerUp']).toBe('function');
    component['onTimelinePointerMove']({ preventDefault: vi.fn(), clientY: 60 } as unknown as PointerEvent);
    component['timelineSelection'].set({ startMinutes: 8 * 60, endMinutes: 8 * 60 + 30 });
    component['onTimelinePointerUp']();
  });

  it('tracks timeline grid and drag state through facade accessors', () => {
    const gridRef = createElementRef({ left: 0, top: 0, right: 300, width: 300, height: 400 });
    component['onTimelineGridReady'](gridRef);
    expect(component['timelineGrid']).toBe(gridRef);
    component['timelineDragStartMinutes'] = 540;
    expect(component['timelineDragStartMinutes']).toBe(540);
  });

  it('ignores slot selection when the slot is booked', () => {
    component.variant = 'customer';
    component['calendarSlots'].set([
      { id: 'slot-10', startTime: '10:00', endTime: '12:00', label: '10-12', status: 'booked' },
    ]);
    component['selectCalendarSlot']('slot-10');
    expect(component.form.get('calendar.startTime')?.value).toBe('');
    expect(component['selectedSlotId']()).toBeNull();
  });

  it('retains slot selection when refreshed with matching values', () => {
    component.variant = 'customer';
    component.form.get('calendar.startTime')?.setValue('08:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    component['rebuildCalendarSlots']('2026-03-05', []);
    expect(component['selectedSlotId']()).toBe('slot-08');
  });

  it('renders the loading/empty/error states in the calendar preview', () => {
    const previewFixture = TestBed.createComponent(EntryModalComponent);
    const previewComponent = previewFixture.componentInstance;
    previewComponent.open = true;
    previewComponent.variant = 'customer';
    previewComponent['calendarSlots'].set([{ id: 'slot-08', startTime: '08:00', endTime: '10:00', label: '8-10', status: 'available' }]);
    previewFixture.detectChanges();

    previewComponent['calendarEventsLoading'].set(true);
    previewFixture.detectChanges();
    expect(
      (previewFixture.nativeElement.querySelector('.preview-state span') as HTMLElement).textContent,
    ).toContain('Loading availability');

    previewComponent['calendarEventsLoading'].set(false);
    previewComponent['calendarEventsError'].set('Boom');
    previewFixture.detectChanges();
    expect(
      (previewFixture.nativeElement.querySelector('.preview-state.error span') as HTMLElement).textContent,
    ).toContain('Boom');

    previewComponent['calendarEventsError'].set(null);
    previewComponent['calendarEvents'].set([]);
    previewFixture.detectChanges();
    const emptyState = previewFixture.nativeElement.querySelector('.preview-state .helper') as HTMLElement;
    expect(emptyState.textContent).toContain('No existing events');

    previewComponent['calendarEvents'].set([
      {
        id: 'evt',
        summary: 'Job',
        start: '2026-03-05T13:00:00Z',
        end: '2026-03-05T14:00:00Z',
        location: '123 Pine',
      },
    ]);
    previewFixture.detectChanges();
    const summary = previewFixture.nativeElement.querySelector('.event-summary') as HTMLElement;
    expect(summary.textContent).toContain('Job');
    const location = previewFixture.nativeElement.querySelector('.event-location') as HTMLElement;
    expect(location.textContent).toContain('123 Pine');
    previewComponent['calendarEvents'].set([]);
    previewFixture.detectChanges();
    const emptyMessage = previewFixture.nativeElement.querySelector('.calendar-preview .preview-state .helper')
      ?.textContent;
    expect(emptyMessage).toContain('No existing events');
  });

  it('returns null for calendar errors until the controls are touched', () => {
    const errorFixture = TestBed.createComponent(EntryModalComponent);
    const errorComponent = errorFixture.componentInstance;
    errorComponent.open = true;
    errorComponent.variant = 'customer';
    errorComponent.form.get('calendar.date')?.setValue('');
    errorComponent.form.get('calendar.startTime')?.setValue('');
    errorComponent.form.get('calendar.endTime')?.setValue('');

    const exposed = errorComponent as unknown as {
      calendarDateError: string | null;
      calendarStartTimeError: string | null;
      calendarEndTimeError: string | null;
    };

    expect(exposed.calendarDateError).toBeNull();
    expect(exposed.calendarStartTimeError).toBeNull();
    expect(exposed.calendarEndTimeError).toBeNull();

    errorComponent.form.get('calendar.date')?.markAsTouched();
    errorComponent.form.get('calendar.startTime')?.markAsTouched();
    errorComponent.form.get('calendar.endTime')?.markAsTouched();

    expect(exposed.calendarDateError).toBe('Required');
    expect(exposed.calendarStartTimeError).toBe('Required');
    expect(exposed.calendarEndTimeError).toBe('Required');
  });

  it('clears calendar errors once valid values are provided', () => {
    const validFixture = TestBed.createComponent(EntryModalComponent);
    const validComponent = validFixture.componentInstance;
    validComponent.open = true;
    validComponent.variant = 'customer';
    validComponent.form.get('calendar.date')?.setValue('2026-03-10');
    validComponent.form.get('calendar.startTime')?.setValue('09:00');
    validComponent.form.get('calendar.endTime')?.setValue('10:00');
    validComponent.form.get('calendar.date')?.markAsTouched();
    validComponent.form.get('calendar.startTime')?.markAsTouched();
    validComponent.form.get('calendar.endTime')?.markAsTouched();
    const exposed = validComponent as unknown as {
      calendarDateError: string | null;
      calendarStartTimeError: string | null;
      calendarEndTimeError: string | null;
    };
    expect(exposed.calendarDateError).toBeNull();
    expect(exposed.calendarStartTimeError).toBeNull();
    expect(exposed.calendarEndTimeError).toBeNull();
  });

  it('renders calendar field errors when date and times are missing', () => {
    const calendarFixture = TestBed.createComponent(EntryModalComponent);
    const calendarComponent = calendarFixture.componentInstance;
    calendarComponent.open = true;
    calendarComponent.variant = 'customer';
    calendarComponent.form.get('calendar.date')?.setValue('');
    calendarComponent.form.get('calendar.startTime')?.setValue('');
    calendarComponent.form.get('calendar.endTime')?.setValue('');
    calendarComponent.form.get('calendar.date')?.markAsTouched();
    calendarComponent.form.get('calendar.startTime')?.markAsTouched();
    calendarComponent.form.get('calendar.endTime')?.markAsTouched();
    calendarFixture.detectChanges();

    expect((calendarComponent as unknown as { calendarDateError: string | null }).calendarDateError).toBe('Required');
    expect((calendarComponent as unknown as { calendarStartTimeError: string | null }).calendarStartTimeError).toBe(
      'Required',
    );
    expect((calendarComponent as unknown as { calendarEndTimeError: string | null }).calendarEndTimeError).toBe(
      'Required',
    );

    const dateLabel = calendarFixture.nativeElement
      .querySelector('input[formcontrolname="date"]')
      ?.closest('label') as HTMLElement | null;
    expect(dateLabel?.querySelector('.error')?.textContent).toContain('Required');

    const startLabel = calendarFixture.nativeElement
      .querySelector('input[formcontrolname="startTime"]')
      ?.closest('label') as HTMLElement | null;
    expect(startLabel?.querySelector('.error')?.textContent).toContain('Required');

    const endLabel = calendarFixture.nativeElement
      .querySelector('input[formcontrolname="endTime"]')
      ?.closest('label') as HTMLElement | null;
    expect(endLabel?.querySelector('.error')?.textContent).toContain('Required');
  });

  it('shows ordering errors when end time is before start time', () => {
    const orderingFixture = TestBed.createComponent(EntryModalComponent);
    const orderingComponent = orderingFixture.componentInstance;
    const exposed = orderingComponent as unknown as {
      calendarEndTimeError: string | null;
    };
    orderingComponent.open = true;
    orderingComponent.variant = 'customer';
    orderingComponent.form.get('calendar.date')?.setValue('2026-03-09');
    orderingComponent.form.get('calendar.startTime')?.setValue('15:00');
    orderingComponent.form.get('calendar.endTime')?.setValue('14:00');
    orderingFixture.detectChanges();

    const validation = TestBed.inject(EntryModalValidationService);
    validation.validateCalendarRange(orderingComponent['calendarGroup'], true);
    orderingFixture.detectChanges();

    expect(exposed.calendarEndTimeError).toBe('End time must be after the start time');

    const endLabel = orderingFixture.nativeElement
      .querySelector('input[formcontrolname="endTime"]')
      ?.closest('label') as HTMLElement | null;
    expect(endLabel?.querySelector('.error')?.textContent).toContain('End time must be after the start time');
  });

  it('does not override an already selected calendar date when ensuring defaults', () => {
    const ensureFixture = TestBed.createComponent(EntryModalComponent);
    const ensureComponent = ensureFixture.componentInstance;
    const exposed = ensureComponent as unknown as {
      ensureCalendarDefaults: () => void;
    };
    ensureComponent.open = true;
    ensureComponent.variant = 'customer';
    ensureComponent.form.get('calendar.date')?.setValue('2026-04-01');
    const spy = vi.spyOn(ensureComponent as unknown as { handleCalendarDateChange: () => void }, 'handleCalendarDateChange');
    exposed.ensureCalendarDefaults();
    expect(ensureComponent.form.get('calendar.date')?.value).toBe('2026-04-01');
    expect(spy).toHaveBeenCalled();
  });

  it('invokes date/time handlers when interacting via the template', () => {
    const inputsFixture = TestBed.createComponent(EntryModalComponent);
    const inputsComponent = inputsFixture.componentInstance;
    inputsComponent.open = true;
    inputsComponent.variant = 'customer';
    inputsFixture.detectChanges();

    const dateInput = inputsFixture.nativeElement.querySelector('input[formcontrolname="date"]') as HTMLInputElement;
    const startInput = inputsFixture.nativeElement.querySelector(
      'input[formcontrolname="startTime"]',
    ) as HTMLInputElement;
    const endInput = inputsFixture.nativeElement.querySelector(
      'input[formcontrolname="endTime"]',
    ) as HTMLInputElement;

    const dateSpy = vi.spyOn(inputsComponent as unknown as { handleCalendarDateChange: () => void }, 'handleCalendarDateChange');
    const manualSpy = vi.spyOn(inputsComponent as unknown as { handleManualTimeChange: () => void }, 'handleManualTimeChange');

    dateInput.dispatchEvent(new Event('change'));
    startInput.dispatchEvent(new Event('input'));
    endInput.dispatchEvent(new Event('input'));

    expect(dateSpy).toHaveBeenCalledTimes(1);
    expect(manualSpy).toHaveBeenCalledTimes(2);
  });

  it('renders slot chips with booked and selected states', () => {
    const slotFixture = TestBed.createComponent(EntryModalComponent);
    const slotComponent = slotFixture.componentInstance;
    slotComponent.open = true;
    slotComponent.variant = 'customer';
    slotComponent['calendarSlots'].set([
      { id: 'slot-08', startTime: '08:00', endTime: '10:00', label: '8-10', status: 'available' },
      { id: 'slot-10', startTime: '10:00', endTime: '12:00', label: '10-12', status: 'booked', conflictSummary: 'Existing job' },
    ]);
    slotComponent['selectedSlotId'].set('slot-08');
    slotFixture.detectChanges();
    const chips = slotFixture.nativeElement.querySelectorAll('.slot-chip') as NodeListOf<HTMLButtonElement>;
    expect(chips.length).toBe(2);
    expect(chips[0].classList).toContain('slot-chip--selected');
    expect(chips[1].disabled).toBe(true);
    expect(chips[1].textContent).toContain('Existing job');
    chips[0].click();
    slotFixture.detectChanges();
    expect(slotComponent['selectedSlotId']()).toBe('slot-08');
    const conflictHint = chips[1].querySelector('small');
    expect(conflictHint?.textContent).toContain('Existing job');
  });

  it('shows slot picker fallback when no slots exist', () => {
    const fallbackFixture = TestBed.createComponent(EntryModalComponent);
    const fallbackComponent = fallbackFixture.componentInstance;
    fallbackComponent.open = true;
    fallbackComponent.variant = 'customer';
    fallbackFixture.detectChanges();
    const fallbackText = fallbackFixture.nativeElement.querySelector('.slot-picker .preview-state .helper')
      ?.textContent;
    expect(fallbackText).toContain('Pick a date to view suggested slots');
  });

  it('renders booked slot badges with conflict summaries', () => {
    const bookedFixture = TestBed.createComponent(EntryModalComponent);
    const bookedComponent = bookedFixture.componentInstance;
    bookedComponent.open = true;
    bookedComponent.variant = 'customer';
    bookedComponent['calendarSlots'].set([
      { id: 'slot-10', startTime: '10:00', endTime: '12:00', label: '10-12', status: 'booked', conflictSummary: 'Crew busy' },
    ]);
    bookedFixture.detectChanges();

    const chip = bookedFixture.nativeElement.querySelector('.slot-chip') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    expect(chip.disabled).toBe(true);
    const hint = chip.querySelector('small') as HTMLElement | null;
    expect(hint?.textContent).toContain('Booked');
    expect(hint?.textContent).toContain('Crew busy');
  });

  it('renders event locations only when events provide them', () => {
    const eventsFixture = TestBed.createComponent(EntryModalComponent);
    const eventsComponent = eventsFixture.componentInstance;
    eventsComponent.open = true;
    vi.spyOn(eventsComponent as unknown as { refreshCalendarEventsForDate: (date: string) => Promise<void> }, 'refreshCalendarEventsForDate').mockResolvedValue();
    eventsComponent.variant = 'customer';
    eventsComponent['calendarEvents'].set([
      { id: 'evt-1', summary: 'Job', start: '2026-03-05T13:00:00Z', end: '2026-03-05T14:00:00Z', location: '555 Pine' },
      { id: 'evt-2', summary: 'Job', start: '2026-03-05T15:00:00Z', end: '2026-03-05T16:00:00Z' },
    ]);
    eventsFixture.detectChanges();

    const locations = eventsFixture.nativeElement.querySelectorAll('.event-location') as NodeListOf<HTMLElement>;
    expect(locations.length).toBe(1);
    expect(locations[0].textContent).toContain('555 Pine');
  });

  it('marks the currently edited calendar event in the list', async () => {
    const listFixture = TestBed.createComponent(EntryModalComponent);
    const listComponent = listFixture.componentInstance;
    listComponent.open = true;
    listComponent.variant = 'customer';
    vi.spyOn(listComponent as unknown as { refreshCalendarEventsForDate: (date: string) => Promise<void> }, 'refreshCalendarEventsForDate').mockResolvedValue();
    listFixture.detectChanges();
    await listFixture.whenStable();
    const events = [
      { id: 'evt-edit', summary: 'Editing', start: '2026-03-05T13:00:00Z', end: '2026-03-05T14:00:00Z' },
      { id: 'evt-other', summary: 'Other', start: '2026-03-05T15:00:00Z', end: '2026-03-05T16:00:00Z' },
    ];
    listComponent['calendarEvents'].set(events);
    listFixture.detectChanges();
    await listFixture.whenStable();

    const editButton = listFixture.nativeElement.querySelector(
      '.event-list li:first-child .event-actions button',
    ) as HTMLButtonElement | null;
    editButton?.click();
    listFixture.detectChanges();
    await listFixture.whenStable();

    const editingItem = listFixture.nativeElement.querySelector('.event-item--editing') as HTMLElement | null;
    expect(editingItem).not.toBeNull();
    expect(editingItem?.textContent).toContain('Editing');
  });

  it('shows a validation error when the calendar date is missing', () => {
    const customerFixture = TestBed.createComponent(EntryModalComponent);
    const customerComponent = customerFixture.componentInstance;
    customerComponent.open = true;
    customerComponent.variant = 'customer';
    customerFixture.detectChanges();

    const dateControl = customerComponent.form.get('calendar.date');
    dateControl?.markAsTouched();
    dateControl?.setValue('');
    customerFixture.detectChanges();

    const dateLabel = customerFixture.nativeElement.querySelector('input[formcontrolname="date"]')
      ?.closest('label') as HTMLElement | null;
    const dateError = dateLabel?.querySelector('.error') as HTMLElement | null;
    expect(dateError?.textContent).toContain('Required');
  });

  it('surfaces the time-order calendar error in the template', () => {
    const customerFixture = TestBed.createComponent(EntryModalComponent);
    const customerComponent = customerFixture.componentInstance;
    customerComponent.open = true;
    customerComponent.variant = 'customer';
    customerFixture.detectChanges();

    customerComponent.form.patchValue({
      firstName: 'Adlane',
      lastName: 'Marco',
      address: '93 Cedar Lane',
      phone: '(514) 555-8890',
      jobType: 'Hedge Trimming',
      jobValue: '950',
    });
    customerComponent.form.get('calendar.date')?.setValue('2026-03-05');
    customerComponent.form.get('calendar.startTime')?.setValue('10:00');
    customerComponent.form.get('calendar.endTime')?.setValue('09:00');

    TestBed.inject(EntryModalValidationService).validateCalendarRange(customerComponent['calendarGroup'], true);
    customerFixture.detectChanges();

    const calendarBlock = customerFixture.nativeElement.querySelector('.calendar-block') as HTMLElement | null;
    expect(calendarBlock).not.toBeNull();
    const errorTexts = Array.from(calendarBlock?.querySelectorAll('.error') ?? []).map((node) =>
      node.textContent?.trim(),
    );
    expect(errorTexts).toContain('End time must be after the start time');
  });

  it('retains other end-time errors when clearing the time-order violation', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-07');
    component.form.get('calendar.startTime')?.setValue('08:00');
    component.form.get('calendar.endTime')?.setValue('09:30');
    const endControl = component.form.get('calendar.endTime') as FormControl;
    endControl.setErrors({ timeOrder: true, required: true });

    const valid = TestBed.inject(EntryModalValidationService).validateCalendarRange(component['calendarGroup'], true);
    expect(valid).toBe(true);
    expect(endControl.errors).toEqual({ required: true });
  });

  it('returns undefined calendar payload when scheduling info is incomplete', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-10');
    component.form.get('calendar.startTime')?.setValue('');
    component.form.get('calendar.endTime')?.setValue('');

    expect(component['buildCalendarPayload']()).toBeUndefined();
  });

  it('includes the existing event id when editing a calendar event', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-12');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('11:00');
    component['editingCalendarEvent'].set({
      id: 'evt-55',
      summary: 'Existing',
      start: '2026-03-12T09:00:00Z',
      end: '2026-03-12T11:00:00Z',
    });

    const payload = component['buildCalendarPayload']();
    expect(payload?.eventId).toBe('evt-55');
  });

  it('enters edit mode when selecting an existing calendar event', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-05');
    const event = {
      id: 'evt-edit',
      summary: 'Existing booking',
      start: component['combineDateTime']('2026-03-05', '10:00'),
      end: component['combineDateTime']('2026-03-05', '12:00'),
    };

    component['editCalendarEvent'](event);

    expect(component['editingCalendarEvent']()).toEqual(event);
    expect(component.form.get('calendar.startTime')?.value).toBe('10:00');
    expect(component.form.get('calendar.endTime')?.value).toBe('12:00');
  });

  it('cancels calendar editing when requested', () => {
    component['editingCalendarEvent'].set({
      id: 'evt-cancel',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    component['cancelCalendarEdit']();
    expect(component['editingCalendarEvent']()).toBeNull();
  });

  it('deletes existing calendar events and refreshes availability', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-05');
    const refreshSpy = vi
      .spyOn(component as unknown as { refreshCalendarEventsForDate: (date: string) => Promise<void> }, 'refreshCalendarEventsForDate')
      .mockResolvedValue();
    component['editingCalendarEvent'].set({
      id: 'evt-del',
      summary: 'Delete me',
      start: '',
      end: '',
    });

    await component['deleteCalendarEvent']({
      id: 'evt-del',
      summary: 'Delete me',
      start: component['combineDateTime']('2026-03-05', '08:00'),
      end: component['combineDateTime']('2026-03-05', '09:00'),
    });

    expect(calendarService.deleteEvent).toHaveBeenCalledWith('evt-del');
    expect(refreshSpy).toHaveBeenCalledWith('2026-03-05');
    expect(component['editingCalendarEvent']()).toBeNull();
  });

  it('removes deleted events locally when no calendar date is selected', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('');
    component['calendarEvents'].set([
      { id: 'evt-local', summary: 'Keep', start: '', end: '' },
      { id: 'evt-delete', summary: 'Delete me', start: '', end: '' },
    ]);

    await component['deleteCalendarEvent']({
      id: 'evt-delete',
      summary: 'Delete me',
      start: '',
      end: '',
    });

    const events = component['calendarEvents']();
    expect(events.find((evt) => evt.id === 'evt-delete')).toBeUndefined();
  });

  it('surfaces an error message when calendar deletion fails', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-05');
    calendarService.deleteEvent.mockRejectedValueOnce(new Error('boom'));

    await component['deleteCalendarEvent']({
      id: 'evt-error',
      summary: 'Oops',
      start: component['combineDateTime']('2026-03-05', '07:00'),
      end: component['combineDateTime']('2026-03-05', '08:00'),
    });

    expect(component['calendarEventsError']()).toContain('Unable to delete calendar event');
  });

  it('skips calendar deletion when an event lacks an id', async () => {
    component.variant = 'customer';
    calendarService.deleteEvent.mockClear();

    await component['deleteCalendarEvent']({
      id: '',
      summary: 'Missing id',
      start: '',
      end: '',
    });

    expect(calendarService.deleteEvent).not.toHaveBeenCalled();
  });

  it('clears editing state when deleting the currently edited event', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-20');
    component['editingCalendarEvent'].set({
      id: 'evt-edit-delete',
      summary: 'Editing',
      start: component['combineDateTime']('2026-03-20', '09:00'),
      end: component['combineDateTime']('2026-03-20', '10:00'),
    });

    await component['deleteCalendarEvent']({
      id: 'evt-edit-delete',
      summary: 'Editing',
      start: component['combineDateTime']('2026-03-20', '09:00'),
      end: component['combineDateTime']('2026-03-20', '10:00'),
    });

    expect(component['editingCalendarEvent']()).toBeNull();
  });

  it('clears editing state for local deletions when no calendar date is selected', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('');
    component['calendarEvents'].set([
      { id: 'evt-local-edit', summary: 'Editing', start: '', end: '' },
      { id: 'evt-other', summary: 'Other', start: '', end: '' },
    ]);
    component['editingCalendarEvent'].set({
      id: 'evt-local-edit',
      summary: 'Editing',
      start: '',
      end: '',
    });

    await component['deleteCalendarEvent']({
      id: 'evt-local-edit',
      summary: 'Editing',
      start: '',
      end: '',
    });

    expect(component['editingCalendarEvent']()).toBeNull();
  });

  it('computes whether the editing update action should be disabled', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-08');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    component['editingCalendarEvent'].set({
      id: 'evt-edit-state',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    component['selectionConflict'].set(false);
    component['conflictConfirmed'].set(false);
    component['calendarEventsLoading'].set(false);

    expect(component['editingUpdateDisabled']()).toBe(false);

    component['selectionConflict'].set(true);
    component['conflictConfirmed'].set(false);
    expect(component['editingUpdateDisabled']()).toBe(true);
  });

  it('disables editing updates when no event is selected or while loading', () => {
    expect(component['editingUpdateDisabled']()).toBe(true);
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-12');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    component['editingCalendarEvent'].set({
      id: 'evt-loading',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    component['calendarEventsLoading'].set(true);
    expect(component['editingUpdateDisabled']()).toBe(true);
    component['calendarEventsLoading'].set(false);
  });

  it('disables editing updates when calendar values are missing', () => {
    component.variant = 'customer';
    component['editingCalendarEvent'].set({
      id: 'evt-missing',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    component.form.get('calendar.date')?.setValue('');
    component.form.get('calendar.startTime')?.setValue('08:00');
    component.form.get('calendar.endTime')?.setValue('09:00');

    expect(component['editingUpdateDisabled']()).toBe(true);
  });

  it('disables editing updates when the start time is missing', () => {
    component.variant = 'customer';
    component['editingCalendarEvent'].set({
      id: 'evt-missing-start',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    component.form.get('calendar.date')?.setValue('2026-03-15');
    component.form.get('calendar.startTime')?.setValue('');
    component.form.get('calendar.endTime')?.setValue('09:30');

    expect(component['editingUpdateDisabled']()).toBe(true);
  });

  it('disables editing updates when the end time is missing', () => {
    component.variant = 'customer';
    component['editingCalendarEvent'].set({
      id: 'evt-missing-end',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    component.form.get('calendar.date')?.setValue('2026-03-16');
    component.form.get('calendar.startTime')?.setValue('08:45');
    component.form.get('calendar.endTime')?.setValue('');

    expect(component['editingUpdateDisabled']()).toBe(true);
  });

  it('prefills editing summary and notes when entering edit mode', () => {
    component.variant = 'customer';
    const event = {
      id: 'evt-prefill',
      summary: 'Existing booking',
      description: 'Bring extra crew',
      start: component['combineDateTime']('2026-03-10', '11:00'),
      end: component['combineDateTime']('2026-03-10', '12:00'),
    };

    component['editCalendarEvent'](event);

    expect(component['editingCalendarForm'].getRawValue()).toEqual({
      summary: 'Existing booking',
      notes: 'Bring extra crew',
    });

    component['cancelCalendarEdit']();
    expect(component['editingCalendarForm'].getRawValue()).toEqual({ summary: '', notes: '' });
  });

  it('updates existing calendar events through the inline action', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component.form.get('calendar.startTime')?.setValue('10:00');
    component.form.get('calendar.endTime')?.setValue('11:30');
    component['editingCalendarEvent'].set({
      id: 'evt-update',
      summary: 'Existing booking',
      start: component['combineDateTime']('2026-03-05', '09:00'),
      end: component['combineDateTime']('2026-03-05', '10:00'),
      location: '123 Pine',
    });
    const refreshSpy = vi
      .spyOn(component as unknown as { refreshCalendarEventsForDate: (date: string) => Promise<void> }, 'refreshCalendarEventsForDate')
      .mockResolvedValue();

    await component['updateCalendarEvent']();

    expect(calendarService.updateEvent).toHaveBeenCalledWith(
      'evt-update',
      expect.objectContaining({
        start: component['combineDateTime']('2026-03-05', '10:00'),
        end: component['combineDateTime']('2026-03-05', '11:30'),
      }),
    );
    expect(refreshSpy).toHaveBeenCalledWith('2026-03-05');
    expect(component['calendarEventsError']()).toBeNull();
  });

  it('shows an error when calendar updates fail', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-06');
    component.form.get('calendar.startTime')?.setValue('13:00');
    component.form.get('calendar.endTime')?.setValue('14:00');
    component['editingCalendarEvent'].set({
      id: 'evt-update-error',
      summary: 'Existing booking',
      start: component['combineDateTime']('2026-03-06', '12:00'),
      end: component['combineDateTime']('2026-03-06', '13:00'),
    });
    calendarService.updateEvent.mockRejectedValueOnce(new Error('boom'));

    await component['updateCalendarEvent']();

    expect(component['calendarEventsError']()).toContain('Unable to update calendar event');
  });

  it('allows overriding calendar title and notes before updating', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-11');
    component.form.get('calendar.startTime')?.setValue('09:30');
    component.form.get('calendar.endTime')?.setValue('10:30');
    const event = {
      id: 'evt-override',
      summary: 'Old title',
      description: 'Old notes',
      start: component['combineDateTime']('2026-03-11', '08:30'),
      end: component['combineDateTime']('2026-03-11', '09:30'),
    };

    component['editCalendarEvent'](event);
    component['editingCalendarForm'].controls.summary.setValue('New title');
    component['editingCalendarForm'].controls.notes.setValue('Updated notes');

    await component['updateCalendarEvent']();

    expect(calendarService.updateEvent).toHaveBeenCalledWith(
      'evt-override',
      expect.objectContaining({
        summary: 'New title',
        description: 'Updated notes',
      }),
    );
  });

  it('does not update calendar events when validation fails', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-07');
    component.form.get('calendar.startTime')?.setValue('15:00');
    component.form.get('calendar.endTime')?.setValue('14:00');
    component['editingCalendarEvent'].set({
      id: 'evt-invalid',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    calendarService.updateEvent.mockClear();

    await component['updateCalendarEvent']();

    expect(calendarService.updateEvent).not.toHaveBeenCalled();
  });

  it('requires conflicts to be confirmed before updating events', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-09');
    component.form.get('calendar.startTime')?.setValue('08:00');
    component.form.get('calendar.endTime')?.setValue('09:00');
    component['editingCalendarEvent'].set({
      id: 'evt-conflict',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    component['selectionConflict'].set(true);
    component['conflictConfirmed'].set(false);
    calendarService.updateEvent.mockClear();

    await component['updateCalendarEvent']();

    expect(calendarService.updateEvent).not.toHaveBeenCalled();
  });

  it('marks calendar controls when attempting to update without a date', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('');
    component.form.get('calendar.startTime')?.setValue('10:00');
    component.form.get('calendar.endTime')?.setValue('11:00');
    component['editingCalendarEvent'].set({
      id: 'evt-missing-date',
      summary: 'Existing booking',
      start: '',
      end: '',
    });
    calendarService.updateEvent.mockClear();

    await component['updateCalendarEvent']();

    expect(component.form.get('calendar.date')?.touched).toBe(true);
    expect(calendarService.updateEvent).not.toHaveBeenCalled();
  });

  it('skips calendar updates when no event is selected', async () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-11');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    component['editingCalendarEvent'].set(null);
    calendarService.updateEvent.mockClear();

    await component['updateCalendarEvent']();

    expect(calendarService.updateEvent).not.toHaveBeenCalled();
  });

  it('marks calendar controls as touched when fields are missing', () => {
    component.variant = 'customer';
    const result = TestBed.inject(EntryModalValidationService).validateCalendarRange(component['calendarGroup'], true);
    expect(result).toBe(false);
    const calendarControls = component['calendarGroup'].controls;
    expect(calendarControls.date.touched).toBe(true);
    expect(calendarControls.startTime.touched).toBe(true);
    expect(calendarControls.endTime.touched).toBe(true);
  });

  it('clears time-order errors when no other end-time issues remain', () => {
    component.variant = 'customer';
    component.form.get('calendar.date')?.setValue('2026-03-11');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    const endControl = component.form.get('calendar.endTime') as FormControl;
    endControl.setErrors({ timeOrder: true });

    const valid = TestBed.inject(EntryModalValidationService).validateCalendarRange(component['calendarGroup'], true);
    expect(valid).toBe(true);
    expect(endControl.errors).toBeNull();
  });

  it('wires close buttons through template events', () => {
    vi.useFakeTimers();
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);
    fixture.detectChanges();

    const headerClose = fixture.nativeElement.querySelector('.icon-btn') as HTMLButtonElement;
    headerClose.click();
    vi.advanceTimersByTime(220);
    expect(closedSpy).toHaveBeenCalledTimes(1);

    const footerClose = fixture.nativeElement.querySelector('.form-footer .ghost') as HTMLButtonElement;
    footerClose.click();
    vi.advanceTimersByTime(220);
    expect(closedSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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

  it('renders edit and delete controls for calendar events', async () => {
    (component as unknown as { _variant: 'warm-lead' | 'customer' })._variant = 'customer';
    component.form.get('jobType')?.setValue('Hedge Trimming');
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component['calendarEvents'].set([
      {
        id: 'evt-ui',
        summary: 'UI job',
        start: component['combineDateTime']('2026-03-05', '09:00'),
        end: component['combineDateTime']('2026-03-05', '10:00'),
      },
    ]);
    component.open = true;
    fixture.detectChanges();
    await fixture.whenStable();
    component['calendarEventsLoading'].set(false);
    component['selectionConflict'].set(false);
    component['conflictConfirmed'].set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['calendarEvents']()).toHaveLength(1);
    fixture.detectChanges();
    await fixture.whenStable();

    const actionButtons = fixture.nativeElement.querySelectorAll('.event-actions button') as NodeListOf<HTMLButtonElement>;
    expect(actionButtons.length).toBe(2);

    actionButtons[0].click();
    expect(component['editingCalendarEvent']()?.id).toBe('evt-ui');
  });

  it('displays the editing banner when an event is being edited', () => {
    component.variant = 'customer';
    component.open = true;
    component.form.get('jobType')?.setValue('Hedge Trimming');
    component['editingCalendarEvent'].set({
      id: 'evt-banner',
      summary: 'Banner event',
      start: component['combineDateTime']('2026-03-05', '13:00'),
      end: component['combineDateTime']('2026-03-05', '14:00'),
    });
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.editing-banner') as HTMLElement;
    expect(banner?.textContent).toContain('Editing existing event');
    expect(banner?.textContent).toContain('Banner event');
  });

  it('skips duplicate checks for warm leads', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'warm-lead';
    component.form.patchValue({
      firstName: 'Warm',
      lastName: 'Lead',
      address: '11 Test',
      phone: '(438) 111-4444',
      jobType: 'Trim',
      jobValue: '400',
      additionalDetails: 'Client called with no mapped hedge reference.',
    });

    await component['submitEntry']();

    expect(entryRepository.findClientMatch).not.toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledTimes(1);
  });

  it('prompts for confirmation when a duplicate customer exists', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Alex',
      lastName: 'Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobType: 'Trim',
      jobValue: '900',
    });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-1': 'trim' });
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-1': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
    });
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    entryRepository.findClientMatch.mockResolvedValue({
      matchedBy: 'phone-address',
      descriptor: '(438) 555-1111 • 123 Pine',
      client: {
        clientId: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Stone',
        fullName: 'Alex Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobsCount: 2,
        lastJobDate: '2026-03-04T12:00:00Z',
      },
    });

    await component['submitEntry']();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(component['duplicateMatch']()?.client.fullName).toBe('Alex Stone');
  });

  it('saves after the user confirms the duplicate match', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Alex',
      lastName: 'Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobType: 'Trim',
      jobValue: '900',
    });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-1': 'trim' });
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-1': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
    });
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    entryRepository.findClientMatch.mockResolvedValue({
      matchedBy: 'phone-address',
      descriptor: '(438) 555-1111 • 123 Pine',
      client: {
        clientId: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Stone',
        fullName: 'Alex Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobsCount: 2,
        lastJobDate: '2026-03-04T12:00:00Z',
      },
    });

    await component['submitEntry']();
    component['confirmDuplicateAndSave']();

    expect(savedSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces duplicate check errors and allows retry', async () => {
    const savedSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.variant = 'customer';
    component.form.patchValue({
      firstName: 'Alex',
      lastName: 'Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobType: 'Trim',
      jobValue: '900',
    });
    component['hedgeStates'].set({ ...component['hedgeStates'](), 'hedge-1': 'trim' });
    component['savedConfigs'].set({
      ...component['savedConfigs'](),
      'hedge-1': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
    });
    component.form.get('calendar.date')?.setValue('2026-03-05');
    component.form.get('calendar.startTime')?.setValue('09:00');
    component.form.get('calendar.endTime')?.setValue('10:00');
    entryRepository.findClientMatch.mockRejectedValue(new Error('boom'));

    await component['submitEntry']();
    expect(component['duplicateMatchError']()).toContain('Unable to check');

    entryRepository.findClientMatch.mockResolvedValue(null);
    await component['retryDuplicateCheck']();
    expect(savedSpy).toHaveBeenCalledTimes(1);
  });

  it('exercises schedule helper pass-through methods', async () => {
    component.variant = 'customer';
    component['calendarGroup'].patchValue({
      date: '2026-03-05',
      startTime: '08:00',
      endTime: '09:00',
    });

    expect(component['isoToDateString']('2026-03-05T12:30:00.000Z')).toBe('2026-03-05');
    expect(component['isoToTimeString']('2026-03-05T12:30:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    expect(component['minutesToTimeString'](615)).toBe('10:15');
    expect(component['timeStringToMinutes']('10:15')).toBe(615);
    expect(component['timelineTotalMinutes']()).toBeGreaterThan(0);
    expect(component['clampTimelineMinutes'](100)).toBeGreaterThanOrEqual(7 * 60);
    expect(component['applySelectionOffset'](7 * 60, 8 * 60).start).toBe(7 * 60);

    const calendarEvent: CalendarEventSummary = {
      id: 'evt-helper',
      summary: 'Helper test',
      start: component['combineDateTime']('2026-03-05', '09:00'),
      end: component['combineDateTime']('2026-03-05', '10:00'),
      location: 'Yard',
    };
    component['rebuildCalendarSlots']('2026-03-05', [calendarEvent]);
    component['rebuildTimelineEvents']('2026-03-05', [calendarEvent]);
    calendarService.listEventsForDate.mockResolvedValueOnce([calendarEvent]);
    await component['refreshCalendarEventsForDate']('2026-03-05');

    expect(component['calendarSlots']().length).toBeGreaterThan(0);
    expect(component['timelineEvents']().length).toBeGreaterThan(0);
  });

  it('routes editing banner actions through template buttons', async () => {
    component.variant = 'customer';
    component.open = true;
    component.form.patchValue({
      jobType: 'Hedge Trimming',
      calendar: {
        date: '2026-03-15',
        startTime: '08:00',
        endTime: '09:15',
      },
    });
    component['editingCalendarEvent'].set({
      id: 'evt-dom-edit',
      summary: 'Existing booking',
      start: component['combineDateTime']('2026-03-15', '07:00'),
      end: component['combineDateTime']('2026-03-15', '08:00'),
    });
    const updateSpy = vi
      .spyOn(component as unknown as { updateCalendarEvent: () => Promise<void> }, 'updateCalendarEvent')
      .mockResolvedValue();
    const cancelSpy = vi.spyOn(component as unknown as { cancelCalendarEdit: () => void }, 'cancelCalendarEdit');
    const editingDisabledSpy = vi
      .spyOn(component as unknown as { editingUpdateDisabled: () => boolean }, 'editingUpdateDisabled')
      .mockReturnValue(false);

    fixture.detectChanges();
    await fixture.whenStable();

    const bannerButtons = fixture.nativeElement.querySelectorAll('.editing-banner__actions button') as NodeListOf<HTMLButtonElement>;
    expect(bannerButtons.length).toBe(2);

    expect(bannerButtons[0].disabled).toBe(false);
    bannerButtons[0].click();
    await fixture.whenStable();
    bannerButtons[1].click();
    await fixture.whenStable();

    expect(updateSpy).toHaveBeenCalled();

    component['editingCalendarEvent'].set({
      id: 'evt-dom-edit',
      summary: 'Existing booking',
      start: component['combineDateTime']('2026-03-15', '07:00'),
      end: component['combineDateTime']('2026-03-15', '08:00'),
    });
    component['calendarEventsLoading'].set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    const newBannerButtons = fixture.nativeElement.querySelectorAll('.editing-banner__actions button') as NodeListOf<HTMLButtonElement>;
    newBannerButtons[1].click();
    await fixture.whenStable();

    expect(cancelSpy).toHaveBeenCalled();
    editingDisabledSpy.mockRestore();
  });

  it('fires calendar delete through the DOM button', async () => {
    component.variant = 'customer';
    component.open = true;
    component.form.get('jobType')?.setValue('Hedge Trimming');
    component['calendarEvents'].set([
      {
        id: 'evt-dom-delete',
        summary: 'Existing booking',
        start: component['combineDateTime']('2026-03-16', '09:00'),
        end: component['combineDateTime']('2026-03-16', '10:00'),
      },
    ]);
    component['calendarEventsLoading'].set(false);
    component['calendarEventsError'].set(null);
    const deleteSpy = vi
      .spyOn(component as unknown as { deleteCalendarEvent: (event: CalendarEventSummary) => Promise<void> }, 'deleteCalendarEvent')
      .mockResolvedValue();

    fixture.detectChanges();
    await fixture.whenStable();
    component['calendarEvents'].set([
      {
        id: 'evt-dom-delete',
        summary: 'Existing booking',
        start: component['combineDateTime']('2026-03-16', '09:00'),
        end: component['combineDateTime']('2026-03-16', '10:00'),
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const deleteButton = fixture.nativeElement.querySelector('.event-actions .danger') as HTMLButtonElement;
    expect(deleteButton).toBeTruthy();
    deleteButton.click();
    await fixture.whenStable();

    expect(deleteSpy).toHaveBeenCalled();
  });

  it('clears editing state when deleting without a selected date', async () => {
    component.open = true;
    component['editingCalendarEvent'].set({
      id: 'evt-delete-local',
      summary: 'Local delete',
      start: component['combineDateTime']('2026-03-05', '15:00'),
      end: component['combineDateTime']('2026-03-05', '16:00'),
    });
    component['calendarEvents'].set([
      {
        id: 'evt-delete-local',
        summary: 'Local delete',
        start: component['combineDateTime']('2026-03-05', '15:00'),
        end: component['combineDateTime']('2026-03-05', '16:00'),
      },
    ]);
    component['calendarGroup'].patchValue({ date: '', startTime: '', endTime: '' });

    await component['deleteCalendarEvent']({
      id: 'evt-delete-local',
      summary: 'Local delete',
      start: component['combineDateTime']('2026-03-05', '15:00'),
      end: component['combineDateTime']('2026-03-05', '16:00'),
    });

    expect(component['editingCalendarEvent']()).toBeNull();
    expect(component['calendarEvents']()).toHaveLength(0);
  });

  it('formats timeline hours and computes tick positions', () => {
    expect((component as unknown as { formatTimelineHour: (hour: number) => string })['formatTimelineHour'](7)).toBe('7 AM');
    expect((component as unknown as { formatTimelineHour: (hour: number) => string })['formatTimelineHour'](15)).toBe('3 PM');
    const positionStart = (component as unknown as { timelineHourPosition: (index: number) => number })['timelineHourPosition'](0);
    const positionEnd = (component as unknown as { timelineHourPosition: (index: number) => number })['timelineHourPosition'](
      component['timelineHours'].length - 1,
    );
    expect(positionStart).toBe(0);
    expect(positionEnd).toBeCloseTo(100);
  });

  it('clears calendar validators when scheduling becomes optional', () => {
    component.variant = 'customer';
    component['calendarGroup'].patchValue({ date: '', startTime: '', endTime: '' });
    component['syncCalendarValidators']();
    const dateControl = component['calendarGroup'].controls.date;
    expect(dateControl.errors?.['required']).toBeTruthy();

    component.variant = 'warm-lead';
    component['syncCalendarValidators']();
    expect(dateControl.errors).toBeNull();
  });

  it('resets calendar preview state via helper', () => {
    component['calendarEvents'].set([
      { id: 'evt', summary: 'x', start: '2026-03-05T12:00:00Z', end: '2026-03-05T13:00:00Z' },
    ]);
    component['calendarSlots'].set([{ id: 'slot', startTime: '08:00', endTime: '10:00', label: '8-10', status: 'available' }]);
    component['timelineEvents'].set([{ id: 'evt', summary: 'x', startMinutes: 60, endMinutes: 120, topPercent: 0, heightPercent: 10, column: 0, columns: 1, leftPercent: 0, widthPercent: 100 }]);
    component['timelineSelection'].set({ startMinutes: 60, endMinutes: 120 });
    component['selectionConflict'].set(true);
    component['conflictSummary'].set('conflict');
    component['conflictConfirmed'].set(true);
    component['currentTimeMinutes'].set(100);
    component['editingCalendarEvent'].set({
      id: 'evt',
      summary: 'x',
      start: '2026-03-05T12:00:00Z',
      end: '2026-03-05T13:00:00Z',
    });

    component['clearCalendarPreview']();

    expect(component['calendarEvents']()).toHaveLength(0);
    expect(component['calendarSlots']()).toHaveLength(0);
    expect(component['timelineEvents']()).toHaveLength(0);
    expect(component['timelineSelection']()).toBeNull();
    expect(component['selectionConflict']()).toBe(false);
    expect(component['conflictSummary']()).toBeNull();
    expect(component['conflictConfirmed']()).toBe(false);
    expect(component['currentTimeMinutes']()).toBeNull();
    expect(component['editingCalendarEvent']()).toBeNull();
  });

  it('prefills payload data through the helper', () => {
    const payload: EntryModalPayload = {
      variant: 'customer',
      form: {
        firstName: 'Ema',
        lastName: 'Doe',
        address: '123 Pine',
        phone: '(111) 111-1111',
        email: 'test@example.com',
        jobType: 'Hedge Trimming',
        jobValue: '500',
        desiredBudget: '450',
        additionalDetails: 'Front yard only',
      },
      hedges: {
        'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true } },
        'hedge-2': { state: 'none' },
        'hedge-3': { state: 'none' },
        'hedge-4': { state: 'none' },
        'hedge-5': { state: 'none' },
        'hedge-6': { state: 'none' },
        'hedge-7': { state: 'none' },
        'hedge-8': { state: 'none' },
      },
      calendar: {
        start: '2026-04-02T13:00:00.000Z',
        end: '2026-04-02T15:00:00.000Z',
        timeZone: 'America/Toronto',
      },
    };

    component['prefillFromPayload'](payload);

    expect(component.form.value.firstName).toBe('Ema');
    expect(component.form.value.additionalDetails).toBe('Front yard only');
    expect(component['calendarGroup'].value.date).toBe('2026-04-02');
    expect(component['calendarGroup'].value.startTime).toBe(localTimeString(payload.calendar!.start));
  });

  it('trims override text when updating calendar events', async () => {
    component.variant = 'customer';
    component.open = true;
    component['editingCalendarEvent'].set({
      id: 'evt-editing',
      summary: 'Original',
      description: 'Original desc',
      start: component['combineDateTime']('2026-03-05', '09:00'),
      end: component['combineDateTime']('2026-03-05', '10:00'),
    });
    component['calendarGroup'].patchValue({
      date: '2026-03-05',
      startTime: '11:00',
      endTime: '12:00',
    });
    component['editingCalendarForm'].setValue({ summary: '  New Title  ', notes: '  Extra  ' });
    await component['updateCalendarEvent']();

    expect(calendarService.updateEvent).toHaveBeenCalledWith(
      'evt-editing',
      expect.objectContaining({ summary: 'New Title', description: 'Extra' }),
    );
  });

  it('renders the hedge selection error when present', () => {
    component.open = true;
    component.form.get('jobType')?.setValue('Hedge Trimming');
    component['hedgeSelectionError'].set('Select at least one hedge before saving this customer entry.');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.hedge-error') as HTMLElement;
    expect(errorEl?.textContent).toContain('Select at least one hedge');
  });

  it('renders the duplicate confirmation banner with descriptor', () => {
    component.open = true;
    component['duplicateMatch'].set({
      matchedBy: 'phone-address',
      descriptor: '(438) 555-1111 • 123 Pine',
      client: {
        clientId: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Stone',
        fullName: 'Alex Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobsCount: 2,
        lastJobDate: '2026-03-04T12:00:00Z',
      },
    });
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.duplicate-banner') as HTMLElement;
    expect(banner?.textContent).toContain('Existing client detected');
    expect(banner?.textContent).toContain('(438) 555-1111 • 123 Pine');
  });

  it('renders duplicate check errors in the template', () => {
    component.open = true;
    component['duplicateMatchError'].set('Unable to check for existing clients. Please retry.');
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.duplicate-banner--error') as HTMLElement;
    expect(banner?.textContent).toContain('Duplicate check failed');
  });

  it('renders the duplicate loading state', () => {
    component.open = true;
    component['duplicateCheckLoading'].set(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.duplicate-banner--loading') as HTMLElement;
    expect(banner?.textContent).toContain('Checking existing clients');
  });

  it('routes duplicate banner actions through template buttons', () => {
    component.open = true;
    const match = {
      matchedBy: 'phone-address' as const,
      descriptor: '(438) 555-1111 • 123 Pine',
      client: {
        clientId: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Stone',
        fullName: 'Alex Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobsCount: 2,
        lastJobDate: '2026-03-04T12:00:00Z',
      },
    };
    component['duplicateMatch'].set(match);
    const dismissSpy = vi.spyOn(component as unknown as { dismissDuplicateWarning(): void }, 'dismissDuplicateWarning');
    fixture.detectChanges();
    const dismissBtn = fixture.nativeElement.querySelector('.duplicate-banner .ghost') as HTMLButtonElement;
    dismissBtn.click();
    expect(dismissSpy).toHaveBeenCalled();

    component['duplicateMatch'].set(match);
    const confirmSpy = vi.spyOn(
      component as unknown as { confirmDuplicateAndSave(): void },
      'confirmDuplicateAndSave',
    );
    fixture.detectChanges();
    const confirmBtn = fixture.nativeElement.querySelector('.duplicate-banner .primary') as HTMLButtonElement;
    confirmBtn.click();
    expect(confirmSpy).toHaveBeenCalled();
  });

  it('routes duplicate retry action through the template button', () => {
    component.open = true;
    component['duplicateMatchError'].set('Unable to check for existing clients. Please retry.');
    const retrySpy = vi
      .spyOn(component as unknown as { retryDuplicateCheck(): Promise<void> }, 'retryDuplicateCheck')
      .mockResolvedValue();
    fixture.detectChanges();
    const retryBtn = fixture.nativeElement.querySelector('.duplicate-banner--error button') as HTMLButtonElement;
    retryBtn.click();
    expect(retrySpy).toHaveBeenCalled();
  });

  it('submits the form via the ngSubmit binding', async () => {
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
      additionalDetails: 'Manual entry without map selection.',
    });
    fixture.detectChanges();

    const formEl = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
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

    component['cycleHedge'](createPanelMouseEvent(), 'hedge-2');

    expect(component['panelState']()?.hedgeId).toBe('hedge-2');
    expect(component['hedgeStates']()['hedge-1']).toBe('none');
  });
});
