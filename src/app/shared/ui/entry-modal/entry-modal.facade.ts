import {
  Directive,
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
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import {
  EntryCalendarPayload,
  EntryModalPayload,
  EntryVariant,
  HedgeConfig,
  HedgeId,
  HedgeState,
  RabattageOption,
  TrimPreset,
} from '@shared/domain/entry/entry-modal.models.js';
import { EntryModalPanelStore, PanelState } from './entry-modal-panel.store.js';
import {
  formatNorthAmericanPhone,
  normalizeNorthAmericanDigits,
  northAmericanPhoneValidator,
} from './entry-modal-phone.util.js';
import {
  CalendarEventSummary,
  CalendarEventsService,
} from '@shared/domain/entry/calendar-events.service.js';
import type { EntryDetailsFormHandlers } from './entry-details-form/entry-details-form.component.js';
import { EntryModalValidationService } from './entry-modal-validation.service.js';
import type {
  EntryScheduleSectionHandlers,
  EntryScheduleSectionViewModel,
} from './entry-schedule-section/entry-schedule-section.component.js';
import {
  EntryRepositoryService,
  type ClientMatchResult,
} from '@shared/domain/entry/entry-repository.service.js';
import { Subscription } from 'rxjs';
import { EntryModalDuplicateGuard } from './entry-modal-duplicate.guard.js';
import { EntryModalScheduleController } from './entry-modal-schedule.controller.js';

@Directive()
export abstract class EntryModalFacade implements OnDestroy {
  private static readonly HEDGE_REQUIREMENT_ERROR =
    'Select at least one hedge on the map or fill Additional details.';

  @Input({ required: true }) open = false;
  private _variant: EntryVariant = 'warm-lead';
  private variantPrefillInProgress = false;
  @Input()
  get variant(): EntryVariant {
    return this._variant;
  }
  set variant(value: EntryVariant) {
    this._variant = value;
    this.syncCalendarValidators();
    this.scheduleController.setVariant(value, { allowSideEffects: !this.variantPrefillInProgress });
    if (value !== 'customer' && !this.variantPrefillInProgress) {
      this.hedgeSelectionError.set(null);
    }
  }
  @Input() headline?: string;
  @Input() eyebrow?: string;
  @Input() subcopy?: string;
  @Input() primaryActionLabel?: string;
  @Input()
  set initialEntry(value: EntryModalPayload | null) {
    /* c8 ignore next */
    if (!value) {
      return;
    }
    this.prefillFromPayload(value);
  }
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EntryModalPayload>();

  @ViewChild('canvasHost', { static: false }) private canvasHost?: ElementRef<HTMLElement>;
  private _timelineGrid?: ElementRef<HTMLElement>;

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
    }),
  });
  protected readonly calendarGroup = this.form.controls.calendar;
  protected readonly editingCalendarForm: FormGroup<{
    summary: FormControl<string>;
    notes: FormControl<string>;
  }> = this.fb.group({
    summary: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });
  private readonly calendarService = inject(CalendarEventsService);
  private readonly entryRepository = inject(EntryRepositoryService);
  private readonly validationService = inject(EntryModalValidationService);
  private readonly scheduleController = new EntryModalScheduleController({
    calendarGroup: this.calendarGroup,
    editingCalendarForm: this.editingCalendarForm,
    calendarService: this.calendarService,
    validationService: this.validationService,
    initialVariant: this._variant,
    requestRefresh: (date) => this.refreshCalendarEventsForDate(date),
    requestEnsureCalendarDefaults: () => this.ensureCalendarDefaults(),
  });
  protected readonly calendarEvents = this.scheduleController.calendarEventsSignal();
  protected readonly calendarEventsLoading = this.scheduleController.calendarEventsLoadingSignal();
  protected readonly calendarEventsError = this.scheduleController.calendarEventsErrorSignal();
  protected readonly calendarSlots = this.scheduleController.calendarSlotsSignal();
  protected readonly selectedSlotId = this.scheduleController.selectedSlotIdSignal();
  protected readonly timelineEvents = this.scheduleController.timelineEventsSignal();
  protected readonly timelineSelection = this.scheduleController.timelineSelectionSignal();
  protected readonly selectionConflict = this.scheduleController.selectionConflictSignal();
  protected readonly conflictSummary = this.scheduleController.conflictSummarySignal();
  protected readonly conflictConfirmed = this.scheduleController.conflictConfirmedSignal();
  protected readonly currentTimeMinutes = this.scheduleController.currentTimeMinutesSignal();
  protected readonly editingCalendarEvent = this.scheduleController.editingCalendarEventSignal();
  private readonly duplicateGuard = new EntryModalDuplicateGuard(
    inject(EntryRepositoryService),
  );
  protected readonly duplicateMatch = this.duplicateGuard.match;
  protected readonly duplicateMatchError = this.duplicateGuard.error;
  protected readonly duplicateCheckLoading = this.duplicateGuard.loading;
  private readonly formChangesSub: Subscription;
  protected readonly panelStore = new EntryModalPanelStore();
  protected readonly hedgeStates = this.panelStore.hedgeStates;
  protected readonly savedConfigs = this.panelStore.savedConfigs;
  protected readonly panelState: WritableSignal<PanelState | null> = this.panelStore.panelState;
  protected readonly panelPosition = this.panelStore.panelPosition;
  protected readonly panelError = this.panelStore.panelError;
  protected readonly hedgeSelectionError = signal<string | null>(null);
  protected readonly requiredFieldErrors = signal<string[]>([]);
  /* c8 ignore next */
  protected readonly floatingPanelEnabled = this.panelStore.floatingPanelEnabled;
  protected readonly hedges = this.panelStore.hedges;
  protected readonly hedgePoints = this.panelStore.hedgePoints;
  protected panelFloats(): boolean {
    return this.panelStore.panelFloats();
  }

  protected readonly rabattageOptions: RabattageOption[] = ['partial', 'total', 'total_no_roots'];
  protected readonly panelFloatsFn = () => this.panelFloats();
  protected readonly trimHasCustomSelectionsFn = () => this.trimHasCustomSelections();
  protected readonly trimPresetSelectedFn = () => this.trimPresetSelected();
  protected readonly hasSavedConfigFn = (hedgeId: HedgeId) => this.hasSavedConfig(hedgeId);
  protected readonly getHedgeStateFn = (hedgeId: HedgeId) => this.getHedgeState(hedgeId);
  protected readonly detailsHandlers: EntryDetailsFormHandlers = {
    handlePhoneInput: (event) => this.handlePhoneInput(event),
    cycleHedge: (event, hedgeId) => this.cycleHedge(event, hedgeId),
    updateTrimSection: (section, checked) => this.updateTrimSection(section, checked),
    selectTrimPreset: (preset) => this.selectTrimPreset(preset),
    selectRabattage: (option) => this.selectRabattage(option),
    updatePartialAmount: (value) => this.updatePartialAmount(value),
    savePanel: () => this.savePanel(),
    cancelPanel: () => this.cancelPanel(),
    beginPanelDrag: (event) => this.beginPanelDrag(event),
  };
  protected readonly scheduleHandlers: EntryScheduleSectionHandlers = {
    handleCalendarDateChange: () => this.handleCalendarDateChange(),
    handleManualTimeChange: () => this.handleManualTimeChange(),
    handleTimelinePointerDown: (event) => this.handleTimelinePointerDown(event),
    handleTimelineGridReady: (ref) => this.handleTimelineGridReady(ref),
    confirmTimelineConflict: () => this.confirmTimelineConflict(),
    selectCalendarSlot: (slotId) => this.selectCalendarSlot(slotId),
    editCalendarEvent: (event) => this.editCalendarEvent(event),
    deleteCalendarEvent: (event) => void this.deleteCalendarEvent(event),
    updateCalendarEvent: () => void this.updateCalendarEvent(),
    cancelCalendarEdit: () => this.cancelCalendarEdit(),
    formatEventTimeRange: (event) => this.formatEventTimeRange(event),
  };

  protected handleCalendarDateChange(): void {
    this.scheduleController.handleCalendarDateChange();
  }

  protected handleManualTimeChange(): void {
    this.scheduleController.handleManualTimeChange();
  }

  protected handleTimelinePointerDown(event: PointerEvent): void {
    this.scheduleController.handleTimelinePointerDown(event);
  }

  protected handleTimelineGridReady(ref: ElementRef<HTMLElement>): void {
    this.scheduleController.handleTimelineGridReady(ref);
  }

  protected get timelineGrid(): ElementRef<HTMLElement> | undefined {
    return this._timelineGrid;
  }

  protected set timelineGrid(ref: ElementRef<HTMLElement> | undefined) {
    this._timelineGrid = ref;
    if (ref) {
      this.scheduleController.handleTimelineGridReady(ref);
    }
  }

  protected get timelineDragStartMinutes(): number | null {
    return this.scheduleController.getTimelineDragStartMinutes();
  }

  protected set timelineDragStartMinutes(value: number | null) {
    this.scheduleController.setTimelineDragStartMinutes(value);
  }

  protected get currentTimeTicker(): ReturnType<typeof setInterval> | null {
    return this.scheduleController.getCurrentTimeTicker();
  }

  protected set currentTimeTicker(value: ReturnType<typeof setInterval> | null) {
    this.scheduleController.setCurrentTimeTicker(value);
  }

  protected confirmTimelineConflict(): void {
    this.scheduleController.confirmTimelineConflict();
  }

  protected selectCalendarSlot(slotId: string): void {
    this.scheduleController.selectCalendarSlot(slotId);
  }

  protected editCalendarEvent(event: CalendarEventSummary): void {
    this.scheduleController.editCalendarEvent(event);
  }

  protected deleteCalendarEvent(event: CalendarEventSummary): Promise<void> {
    return this.scheduleController.deleteCalendarEvent(event);
  }

  protected updateCalendarEvent(): Promise<void> {
    return this.scheduleController.updateCalendarEvent();
  }

  protected cancelCalendarEdit(): void {
    this.scheduleController.cancelCalendarEdit();
  }

  protected formatEventTimeRange(event: CalendarEventSummary): string {
    return this.scheduleController.formatEventTimeRange(event);
  }

  protected conflictWarningText(): string | null {
    return this.scheduleController.getConflictSummary();
  }

  protected conflictConfirmedFlag(): boolean {
    return this.scheduleController.isConflictConfirmed();
  }

  protected isPrimaryDisabled(): boolean {
    return this.requiresCalendar() && this.scheduleController.hasBlockingConflict();
  }

  protected buildCalendarPayload(): EntryCalendarPayload | undefined {
    return this.scheduleController.buildCalendarPayload();
  }

  constructor() {
    this.formChangesSub = this.form.valueChanges.subscribe(() => {
      this.resetDuplicateGuards();
      if (this.requiredFieldErrors().length > 0) {
        this.requiredFieldErrors.set(this.collectRequiredFieldErrors());
      }
      if (this.hedgeSelectionError()) {
        this.syncHedgeSelectionError();
      }
    });
    this.syncCalendarValidators();
  }
  protected get scheduleViewModel(): EntryScheduleSectionViewModel {
    const base = this.scheduleController.buildViewModel();
    return {
      ...base,
      editingUpdateDisabled: this.editingUpdateDisabled(),
    };
  }

  protected trimHasCustomSelections(): boolean {
    return this.panelStore.trimHasCustomSelections();
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
    return this.panelStore.trimPresetSelected();
  }

  protected requiresCalendar(): boolean {
    return this.variant === 'customer';
  }

  protected onCanvasHostChange(ref: ElementRef<HTMLElement> | undefined): void {
    this.canvasHost = ref;
    this.syncCanvasHost();
  }

  protected get calendarDateError(): string | null {
    const control = this.calendarGroup.controls.date;
    if (!control.touched) {
      return null;
    }
    return control.invalid ? 'Required' : null;
  }

  protected get calendarStartTimeError(): string | null {
    const control = this.calendarGroup.controls.startTime;
    if (!control.touched) {
      return null;
    }
    return control.invalid ? 'Required' : null;
  }

  protected get calendarEndTimeError(): string | null {
    const control = this.calendarGroup.controls.endTime;
    if (!control.touched) {
      return null;
    }
    if (control.errors?.['timeOrder']) {
      return 'End time must be after the start time';
    }
    return control.invalid ? 'Required' : null;
  }

  protected cycleHedge(event: MouseEvent, hedgeId: HedgeId): void {
    event.stopPropagation();
    this.syncCanvasHost();
    this.panelStore.cycleHedge(event, hedgeId);
    this.syncHedgeSelectionError();
  }

  protected updateTrimSection(section: 'inside' | 'top' | 'outside', checked: boolean): void {
    this.panelStore.updateTrimSection(section, checked);
  }

  protected selectTrimPreset(preset: TrimPreset): void {
    this.panelStore.selectTrimPreset(preset);
  }

  protected selectRabattage(option: RabattageOption): void {
    this.panelStore.selectRabattage(option);
  }

  protected updatePartialAmount(value: string): void {
    this.panelStore.updatePartialAmount(value);
  }

  protected savePanel(): void {
    this.panelStore.savePanel();
    this.syncHedgeSelectionError();
  }

  protected cancelPanel(): void {
    this.panelStore.cancelPanel();
  }

  protected closePanel(resetSelection = false): void {
    this.panelStore.closePanel(resetSelection);
  }

  protected closeModal(): void {
    this.resetModalState();
    this.resetDuplicateGuards();
    this.closed.emit();
  }

  protected onTimelineGridReady(ref: ElementRef<HTMLElement>): void {
    this.timelineGrid = ref;
  }

  protected async submitEntry(): Promise<void> {
    this.requiredFieldErrors.set([]);
    this.hedgeSelectionError.set(null);
    this.syncCalendarValidators();
    const requiredFieldErrors = this.collectRequiredFieldErrors();
    if (this.form.invalid || requiredFieldErrors.length > 0) {
      this.requiredFieldErrors.set(requiredFieldErrors);
      this.syncHedgeSelectionError();
      this.form.markAllAsTouched();
      return;
    }
    if (!this.validationService.validateCalendarRange(this.calendarGroup, this.requiresCalendar())) {
      this.requiredFieldErrors.set(this.collectRequiredFieldErrors());
      return;
    }
    if (this.selectionConflict() && !this.conflictConfirmed()) {
      return;
    }

    const hedgesPayload = this.panelStore.buildHedgePayload();
    if (!this.hasHedgeSelectionRequirement(hedgesPayload)) {
      this.hedgeSelectionError.set(EntryModalFacade.HEDGE_REQUIREMENT_ERROR);
      this.requiredFieldErrors.set(this.collectRequiredFieldErrors());
      return;
    }
    this.hedgeSelectionError.set(null);
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

    const calendarPayload = this.scheduleController.buildCalendarPayload();
    if (calendarPayload) {
      payload.calendar = calendarPayload;
    }

    const signature = this.buildFormSignature(payload.form);
    const duplicateCleared = await this.duplicateGuard.ensureClearance(
      payload,
      signature,
      this.variant,
    );
    if (!duplicateCleared) {
      return;
    }

    this.finalizeSubmission(payload);
  }

  protected getHedgeState(hedgeId: HedgeId): HedgeState {
    return this.panelStore.getHedgeState(hedgeId);
  }

  protected hasSavedConfig(hedgeId: HedgeId): boolean {
    return this.panelStore.hasSavedConfig(hedgeId);
  }

  protected duplicateReasonText(match: ClientMatchResult | null = null): string | null {
    return this.duplicateGuard.getReason(match);
  }

  protected confirmDuplicateAndSave(): void {
    const payload = this.duplicateGuard.confirmPending();
    if (!payload) {
      return;
    }
    this.finalizeSubmission(payload);
  }

  protected dismissDuplicateWarning(): void {
    this.duplicateGuard.dismiss();
  }

  protected async retryDuplicateCheck(): Promise<void> {
    const payload = await this.duplicateGuard.retry(this.variant);
    if (payload) {
      this.finalizeSubmission(payload);
    }
  }

  /* c8 ignore start */
  private resetDuplicateGuards(): void {
    this.duplicateGuard.reset();
  }

  private finalizeSubmission(payload: EntryModalPayload): void {
    this.saved.emit(payload);
    this.resetModalState();
    this.resetDuplicateGuards();
  }

  private buildFormSignature(form: EntryModalPayload['form']): string {
    const email = form.email?.trim().toLowerCase() ?? '';
    const phoneDigits = form.phone.replace(/\D/g, '');
    const name = `${form.firstName}::${form.lastName}`.toLowerCase();
    const address = form.address.trim().toLowerCase();
    return `${email}::${phoneDigits}::${name}::${address}`;
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

  private collectRequiredFieldErrors(): string[] {
    const errors: string[] = [];
    const addError = (message: string): void => {
      if (!errors.includes(message)) {
        errors.push(message);
      }
    };

    const requiredFormFields: { control: FormControl<string>; label: string }[] = [
      { control: this.form.controls.firstName, label: 'First name' },
      { control: this.form.controls.lastName, label: 'Last name' },
      { control: this.form.controls.address, label: 'Home address' },
      { control: this.form.controls.jobType, label: 'Job type' },
      { control: this.form.controls.jobValue, label: 'Job value' },
    ];

    requiredFormFields.forEach(({ control, label }) => {
      if (control.hasError('required')) {
        addError(label);
      }
    });

    if (this.form.controls.phone.hasError('required')) {
      addError('Phone number');
    } else if (this.form.controls.phone.hasError('phoneInvalid')) {
      addError('Phone number (valid 10-digit format)');
    }

    if (this.requiresCalendar()) {
      if (this.calendarGroup.controls.date.hasError('required')) {
        addError('Date');
      }
      if (this.calendarGroup.controls.startTime.hasError('required')) {
        addError('Start time');
      }
      if (this.calendarGroup.controls.endTime.hasError('required')) {
        addError('End time');
      }
      if (this.calendarGroup.controls.endTime.hasError('timeOrder')) {
        addError('End time must be after start time');
      }
    }

    if (!this.hasHedgeSelectionRequirement()) {
      addError('Hedge map selection (or Additional details)');
    }

    return errors;
  }

  private shouldEnforceHedgeSelection(): boolean {
    return this.form.controls.jobType.value.trim().length > 0;
  }

  private hasHedgeSelectionRequirement(hedges = this.panelStore.buildHedgePayload()): boolean {
    if (!this.shouldEnforceHedgeSelection()) {
      return true;
    }
    if (this.validationService.hasSelectedHedge(hedges as Record<string, HedgeConfig>)) {
      return true;
    }
    return this.form.controls.additionalDetails.value.trim().length > 0;
  }

  private syncHedgeSelectionError(): void {
    if (!this.shouldEnforceHedgeSelection()) {
      this.hedgeSelectionError.set(null);
      return;
    }
    this.hedgeSelectionError.set(
      this.hasHedgeSelectionRequirement()
        ? null
        : EntryModalFacade.HEDGE_REQUIREMENT_ERROR,
    );
  }

  private prefillFromPayload(payload: EntryModalPayload): void {
    this.variantPrefillInProgress = true;
    this.variant = payload.variant;
    this.variantPrefillInProgress = false;
    this.resetModalState();
    this.form.patchValue(
      {
        firstName: payload.form.firstName,
        lastName: payload.form.lastName,
        address: payload.form.address,
        phone: payload.form.phone,
        email: payload.form.email ?? '',
        jobType: payload.form.jobType,
        jobValue: payload.form.jobValue,
        desiredBudget: payload.form.desiredBudget ?? '',
        additionalDetails: payload.form.additionalDetails ?? '',
      },
      { emitEvent: false },
    );
    this.panelStore.loadFromConfigs(payload.hedges);
    this.hedgeSelectionError.set(null);
    const calendarPayload =
      payload.variant === 'customer' ? payload.calendar ?? null : null;
    this.scheduleController.applyCalendarPayload(calendarPayload);
  }
  /* c8 ignore end */

  private resetModalState(): void {
    this.form.reset();
    this.panelStore.reset();
    this.scheduleController.reset();
    this.syncCalendarValidators();
    this.hedgeSelectionError.set(null);
    this.requiredFieldErrors.set([]);
  }

  private syncCanvasHost(): void {
    this.panelStore.setCanvasHost(this.canvasHost);
  }

  private ensureCalendarDefaults(): void {
    const dateControl = this.calendarGroup.controls.date;
    if (!dateControl.value) {
      dateControl.setValue(this.todayIsoDate());
    }
    this.handleCalendarDateChange();
  }

  private clearCalendarPreview(): void {
    this.scheduleController.clearPreview();
  }

  private clearCurrentTimeTicker(): void {
    this.scheduleController.clearCurrentTimeTicker();
  }

  private syncCurrentTimeTicker(): void {
    this.scheduleController.syncCurrentTimeTicker();
  }

  protected get eyebrowText(): string {
    if (this.eyebrow) {
      return this.eyebrow;
    }
    return this.variant === 'customer' ? 'Customer' : 'Warm / Lead';
  }

  /* c8 ignore next */
  protected get headlineText(): string {
    if (this.headline) {
      return this.headline;
    }
    return this.variant === 'customer' ? 'Add Customer' : 'Add Entry';
  }

  /* c8 ignore next */
  protected get subcopyText(): string {
    if (this.subcopy) {
      return this.subcopy;
    }
    return 'Speed-first workflow • Dark Evergreen theme';
  }

  /* c8 ignore next */
  protected get primaryLabelText(): string {
    if (this.primaryActionLabel) {
      return this.primaryActionLabel;
    }
    return this.variant === 'customer' ? 'Save Customer' : 'Save Warm Lead';
  }

  protected formatTimelineHour(hour: number): string {
    const normalized = ((hour + 11) % 12) + 1;
    const suffix = hour < 12 ? 'AM' : 'PM';
    return `${normalized} ${suffix}`;
  }

  protected get timelineHours(): number[] {
    return this.scheduleController.timelineHours;
  }

  protected timelineHourPosition(index: number): number {
    const hours = this.timelineHours;
    const totalMarks = Math.max(1, hours.length - 1);
    return (index / totalMarks) * 100;
  }

  protected timelineSelectionStyle():
    | { topPercent: number; heightPercent: number; conflict: boolean }
    | null {
    return this.scheduleController.buildViewModel().timelineSelectionStyle;
  }

  protected timelineNowLineStyle(): { topPercent: number } | null {
    return this.scheduleController.buildViewModel().timelineNowLine;
  }

  protected onTimelinePointerDown(event: PointerEvent): void {
    this.handleTimelinePointerDown(event);
  }

  protected onTimelinePointerMove(event: PointerEvent): void {
    this.handleTimelinePointerMove(event);
  }

  protected onTimelinePointerUp(): void {
    this.handleTimelinePointerUp();
  }

  protected async refreshCalendarEventsForDate(date: string): Promise<void> {
    await this.scheduleController.refreshCalendarEventsForDate(date);
  }

  protected combineDateTime(date: string, time: string): string {
    return this.scheduleController.combineDateTime(date, time);
  }

  protected isoToDateString(value: string): string {
    return this.scheduleController.isoToDateString(value);
  }

  protected isoToTimeString(value: string): string {
    return this.scheduleController.isoToTimeString(value);
  }

  protected applyTimelineSelectionMinutes(startMinutes: number, endMinutes: number): void {
    this.scheduleController.applyTimelineSelectionMinutes(startMinutes, endMinutes);
  }

  protected applySelectionOffset(startMinutes: number, endMinutes: number): { start: number; end: number } {
    return this.scheduleController.applySelectionOffset(startMinutes, endMinutes);
  }

  protected rebuildCalendarSlots(date: string, events: CalendarEventSummary[]): void {
    this.scheduleController.rebuildCalendarSlots(date, events);
  }

  protected rebuildTimelineEvents(date: string, events: CalendarEventSummary[]): void {
    this.scheduleController.rebuildTimelineEvents(date, events);
  }

  protected minutesToTimeString(totalMinutes: number): string {
    return this.scheduleController.minutesToTimeString(totalMinutes);
  }

  protected timeStringToMinutes(time: string): number {
    return this.scheduleController.timeStringToMinutes(time);
  }

  protected timelineTotalMinutes(): number {
    return this.scheduleController.timelineTotalMinutes();
  }

  protected clampTimelineMinutes(minutes: number): number {
    return this.scheduleController.clampTimelineMinutes(minutes);
  }

  protected minutesFromPointer(event: PointerEvent): number {
    return this.scheduleController.minutesFromPointer(event);
  }

  protected handleTimelinePointerMove(event: PointerEvent): void {
    this.scheduleController.handleTimelinePointerMove(event);
  }

  protected handleTimelinePointerUp(): void {
    this.scheduleController.handleTimelinePointerUp();
  }

  protected todayIsoDate(): string {
    return this.scheduleController.todayIsoDate();
  }

  protected updateCurrentTimeMinutes(): void {
    this.scheduleController.updateCurrentTimeMinutes();
  }

  protected beginPanelDrag(event: PointerEvent): void {
    this.syncCanvasHost();
    this.panelStore.beginPanelDrag(event);
  }

  protected editingUpdateDisabled(): boolean {
    return this.scheduleController.buildViewModel().editingUpdateDisabled;
  }

  ngOnDestroy(): void {
    this.formChangesSub.unsubscribe();
    this.panelStore.destroy();
    this.scheduleController.destroy();
  }
}
