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
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  EntryCalendarPayload,
  EntryModalPayload,
  EntryVariant,
  HedgeId,
  HedgeState,
  RabattageOption,
  TrimPreset,
} from '../../models/entry-modal.models.js';
import { EntryModalPanelStore, PanelState } from './entry-modal-panel.store.js';
import {
  formatNorthAmericanPhone,
  normalizeNorthAmericanDigits,
  northAmericanPhoneValidator,
} from './entry-modal-phone.util.js';
import {
  CalendarEventSummary,
  CalendarEventsService,
  type UpdateCalendarEventRequest,
} from '../../services/calendar-events.service.js';
import {
  EntryDetailsFormComponent,
  type EntryDetailsFormHandlers,
} from './entry-details-form/entry-details-form.component.js';
import { EntryModalFooterComponent } from './entry-footer/entry-modal-footer.component.js';
import { EntryModalValidationService } from './entry-modal-validation.service.js';
import {
  EntryScheduleSectionComponent,
  type EntryScheduleSectionHandlers,
  type EntryScheduleSectionViewModel,
} from './entry-schedule-section/entry-schedule-section.component.js';
import {
  EntryRepositoryService,
  type ClientMatchResult,
} from '../../services/entry-repository.service.js';
import { Subscription } from 'rxjs';

export { northAmericanPhoneValidator } from './entry-modal-phone.util.js';

type CalendarSlotStatus = 'available' | 'booked';
export interface CalendarSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  status: CalendarSlotStatus;
  conflictSummary?: string;
}

const CALENDAR_SLOT_TEMPLATES: readonly { id: string; start: string; end: string }[] = [
  { id: 'slot-08', start: '08:00', end: '10:00' },
  { id: 'slot-10', start: '10:00', end: '12:00' },
  { id: 'slot-12', start: '12:00', end: '14:00' },
  { id: 'slot-14', start: '14:00', end: '16:00' },
  { id: 'slot-16', start: '16:00', end: '18:00' },
  { id: 'slot-18', start: '18:00', end: '20:00' },
];

const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 20;
const MIN_SELECTION_MINUTES = 30;
const TIMELINE_INCREMENT = 15;
const TIMELINE_SELECTION_OFFSET = 15;

export interface TimelineEventBlock {
  id: string;
  summary: string;
  startMinutes: number;
  endMinutes: number;
  topPercent: number;
  heightPercent: number;
  column: number;
  columns: number;
  location?: string;
  leftPercent: number;
  widthPercent: number;
}

@Component({
  selector: 'app-entry-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EntryDetailsFormComponent,
    EntryScheduleSectionComponent,
    EntryModalFooterComponent,
  ],
  templateUrl: './entry-modal.component.html',
  styleUrl: './entry-modal.component.scss',
})
export class EntryModalComponent implements OnDestroy {
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
    if (value === 'customer') {
      if (!this.variantPrefillInProgress) {
        this.ensureCalendarDefaults();
      }
    } else {
      if (!this.variantPrefillInProgress) {
        this.clearCalendarPreview();
        this.hedgeSelectionError.set(null);
        this.setEditingCalendarEvent(null);
      }
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
  private timelineGrid?: ElementRef<HTMLElement>;

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
  /* c8 ignore next */
  protected readonly calendarEvents = signal<CalendarEventSummary[]>([]);
  /* c8 ignore next */
  protected readonly calendarEventsLoading = signal(false);
  /* c8 ignore next */
  protected readonly calendarEventsError = signal<string | null>(null);
  /* c8 ignore next */
  protected readonly calendarTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private readonly eventTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  /* c8 ignore next */
  protected readonly calendarSlots = signal<CalendarSlot[]>([]);
  /* c8 ignore next */
  protected readonly selectedSlotId = signal<string | null>(null);
  /* c8 ignore next */
  protected readonly timelineEvents = signal<TimelineEventBlock[]>([]);
  /* c8 ignore next */
  protected readonly timelineSelection = signal<{ startMinutes: number; endMinutes: number } | null>(null);
  /* c8 ignore next */
  protected readonly selectionConflict = signal(false);
  /* c8 ignore next */
  protected readonly conflictSummary = signal<string | null>(null);
  /* c8 ignore next */
  protected readonly conflictConfirmed = signal(false);
  /* c8 ignore next */
  protected readonly currentTimeMinutes = signal<number | null>(null);
  protected readonly timelineHelperText =
    'Click and drag to choose a slot. Conflicts require confirmation.';
  /* c8 ignore next */
  protected readonly editingCalendarEvent = signal<CalendarEventSummary | null>(null);
  protected readonly duplicateMatch = signal<ClientMatchResult | null>(null);
  protected readonly duplicateMatchError = signal<string | null>(null);
  protected readonly duplicateCheckLoading = signal(false);
  private pendingSubmissionPayload: EntryModalPayload | null = null;
  private pendingSubmissionSignature: string | null = null;
  private confirmedDuplicateSignature: string | null = null;
  private readonly formChangesSub: Subscription;
  private syncEditingFormFromEvent(event: CalendarEventSummary | null): void {
    if (!event) {
      this.editingCalendarForm.reset({ summary: '', notes: '' });
      return;
    }
    this.editingCalendarForm.patchValue(
      {
        summary: event.summary ?? '',
        notes: event.description ?? '',
      },
      { emitEvent: false },
    );
  }

  private setEditingCalendarEvent(event: CalendarEventSummary | null): void {
    this.editingCalendarEvent.set(event);
    this.syncEditingFormFromEvent(event);
  }
  protected readonly timelineHours = Array.from(
    { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
    (_, index) => TIMELINE_START_HOUR + index,
  );

  protected readonly panelStore = new EntryModalPanelStore();
  protected readonly hedgeStates = this.panelStore.hedgeStates;
  protected readonly savedConfigs = this.panelStore.savedConfigs;
  protected readonly panelState: WritableSignal<PanelState | null> = this.panelStore.panelState;
  protected readonly panelPosition = this.panelStore.panelPosition;
  protected readonly panelError = this.panelStore.panelError;
  protected readonly hedgeSelectionError = signal<string | null>(null);
  /* c8 ignore next */
  protected readonly floatingPanelEnabled = this.panelStore.floatingPanelEnabled;
  protected readonly hedges = this.panelStore.hedges;
  protected readonly hedgePoints = this.panelStore.hedgePoints;
  protected panelFloats(): boolean {
    return this.panelStore.panelFloats();
  }
  private timelineDragStartMinutes: number | null = null;
  private readonly onTimelinePointerMove = (event: PointerEvent) => this.handleTimelinePointerMove(event);
  private readonly onTimelinePointerUp = () => this.handleTimelinePointerUp();
  private currentTimeTicker: ReturnType<typeof setInterval> | null = null;
  private readonly validationService = inject(EntryModalValidationService);

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
    handleTimelinePointerDown: (event) => this.onTimelinePointerDown(event),
    handleTimelineGridReady: (ref) => this.onTimelineGridReady(ref),
    confirmTimelineConflict: () => this.confirmTimelineConflict(),
    selectCalendarSlot: (slotId: string) => this.selectCalendarSlot(slotId),
    editCalendarEvent: (event) => this.editCalendarEvent(event),
    deleteCalendarEvent: (event) => void this.deleteCalendarEvent(event),
    updateCalendarEvent: () => void this.updateCalendarEvent(),
    cancelCalendarEdit: () => this.cancelCalendarEdit(),
    formatEventTimeRange: (event) => this.formatEventTimeRange(event),
  };

  constructor() {
    this.formChangesSub = this.form.valueChanges.subscribe(() => this.resetDuplicateGuards());
    this.syncCalendarValidators();
  }
  protected get scheduleViewModel(): EntryScheduleSectionViewModel {
    return {
      calendarGroup: this.calendarGroup,
      calendarTimeZone: this.calendarTimeZone,
      timelineHours: this.timelineHours,
      timelineEvents: this.timelineEvents(),
      timelineSelectionStyle: this.timelineSelectionStyle(),
      timelineNowLine: this.timelineNowLineStyle(),
      timelineHelperText: this.timelineHelperText,
      selectionConflict: this.selectionConflict(),
      conflictSummary: this.conflictWarningText(),
      conflictConfirmed: this.conflictConfirmedFlag(),
      calendarSlots: this.calendarSlots(),
      selectedSlotId: this.selectedSlotId(),
      calendarEventsLoading: this.calendarEventsLoading(),
      calendarEventsError: this.calendarEventsError(),
      calendarEvents: this.calendarEvents(),
      editingCalendarEvent: this.editingCalendarEvent(),
      editingCalendarForm: this.editingCalendarForm,
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

  protected handleCalendarDateChange(): void {
    if (!this.requiresCalendar()) {
      this.calendarSlots.set([]);
      this.selectedSlotId.set(null);
      this.timelineEvents.set([]);
      this.timelineSelection.set(null);
      this.selectionConflict.set(false);
      this.conflictSummary.set(null);
      this.conflictConfirmed.set(false);
      this.clearCurrentTimeTicker();
      this.setEditingCalendarEvent(null);
      return;
    }
    const date = this.calendarGroup.controls.date.value;
    if (!date) {
      this.clearCalendarPreview();
      this.calendarGroup.patchValue({ startTime: '', endTime: '' }, { emitEvent: false });
      this.setEditingCalendarEvent(null);
      return;
    }
    this.calendarGroup.patchValue({ startTime: '', endTime: '' }, { emitEvent: false });
    this.selectedSlotId.set(null);
    this.timelineSelection.set(null);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
    this.syncCurrentTimeTicker();
    void this.refreshCalendarEventsForDate(date);
  }

  protected formatEventTimeRange(event: CalendarEventSummary): string {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return `${this.eventTimeFormatter.format(start)} – ${this.eventTimeFormatter.format(end)}`;
  }

  protected cycleHedge(event: MouseEvent, hedgeId: HedgeId): void {
    event.stopPropagation();
    this.syncCanvasHost();
    this.panelStore.cycleHedge(event, hedgeId);
    if (this.variant === 'customer' && this.hedgeSelectionError()) {
      const snapshot = this.panelStore.buildHedgePayload();
      if (this.validationService.hasSelectedHedge(snapshot)) {
        this.hedgeSelectionError.set(null);
      }
    }
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
    if (this.variant === 'customer' && this.hedgeSelectionError()) {
      const snapshot = this.panelStore.buildHedgePayload();
      if (this.validationService.hasSelectedHedge(snapshot)) {
        this.hedgeSelectionError.set(null);
      }
    }
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
    this.syncCalendarValidators();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.validationService.validateCalendarRange(this.calendarGroup, this.requiresCalendar())) {
      return;
    }
    if (this.selectionConflict() && !this.conflictConfirmed()) {
      return;
    }

    const hedgesPayload = this.panelStore.buildHedgePayload();
    if (this.variant === 'customer' && !this.validationService.hasSelectedHedge(hedgesPayload)) {
      this.hedgeSelectionError.set('Select at least one hedge before saving this customer entry.');
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

    const calendarPayload = this.buildCalendarPayload();
    if (calendarPayload) {
      payload.calendar = calendarPayload;
    }

    const signature = this.buildFormSignature(payload.form);
    const duplicateCleared = await this.ensureDuplicateClearance(payload, signature);
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
    const candidate = match ?? this.duplicateMatch();
    if (!candidate) {
      return null;
    }
    switch (candidate.matchedBy) {
      case 'email':
        return 'email address';
      case 'phone-address':
        return 'phone number + address';
      case 'phone-name':
        return 'phone number + name';
      default:
        return 'name + address';
    }
  }

  protected confirmDuplicateAndSave(): void {
    if (!this.pendingSubmissionPayload || !this.pendingSubmissionSignature) {
      return;
    }
    this.confirmedDuplicateSignature = this.pendingSubmissionSignature;
    const payload = this.pendingSubmissionPayload;
    this.clearPendingSubmission();
    this.resetDuplicatePrompts();
    this.finalizeSubmission(payload);
  }

  protected dismissDuplicateWarning(): void {
    this.resetDuplicatePrompts();
    this.clearPendingSubmission();
  }

  protected async retryDuplicateCheck(): Promise<void> {
    if (!this.pendingSubmissionPayload || !this.pendingSubmissionSignature) {
      await this.submitEntry();
      return;
    }
    const payload = this.pendingSubmissionPayload;
    const signature = this.pendingSubmissionSignature;
    this.duplicateMatchError.set(null);
    const allowed = await this.ensureDuplicateClearance(payload, signature);
    if (allowed) {
      this.finalizeSubmission(payload);
    }
  }

  /* c8 ignore start */
  private resetDuplicateGuards(): void {
    this.resetDuplicatePrompts();
    this.clearPendingSubmission();
    this.confirmedDuplicateSignature = null;
  }

  private resetDuplicatePrompts(): void {
    this.duplicateMatch.set(null);
    this.duplicateMatchError.set(null);
    this.duplicateCheckLoading.set(false);
  }

  private clearPendingSubmission(): void {
    this.pendingSubmissionPayload = null;
    this.pendingSubmissionSignature = null;
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

  private async ensureDuplicateClearance(
    payload: EntryModalPayload,
    signature: string,
  ): Promise<boolean> {
    if (this.variant !== 'customer') {
      return true;
    }
    if (this.confirmedDuplicateSignature && this.confirmedDuplicateSignature === signature) {
      return true;
    }

    this.duplicateMatchError.set(null);
    this.duplicateMatch.set(null);
    this.duplicateCheckLoading.set(true);

    try {
      const match = await this.entryRepository.findClientMatch(payload.form);
      if (!match) {
        this.clearPendingSubmission();
        return true;
      }
      this.pendingSubmissionPayload = payload;
      this.pendingSubmissionSignature = signature;
      this.duplicateMatch.set(match);
      return false;
    } catch (error) {
      console.error('Failed to check client match', error);
      this.pendingSubmissionPayload = payload;
      this.pendingSubmissionSignature = signature;
      this.duplicateMatchError.set('Unable to check for existing clients. Please retry.');
      return false;
    } finally {
      this.duplicateCheckLoading.set(false);
    }
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

  private ensureCalendarDefaults(): void {
    const dateControl = this.calendarGroup.controls.date;
    if (!dateControl.value) {
      dateControl.setValue(this.todayIsoDate());
    }
    this.handleCalendarDateChange();
  }

  private clearCalendarPreview(): void {
    this.calendarEvents.set([]);
    this.calendarEventsError.set(null);
    this.calendarEventsLoading.set(false);
    this.calendarSlots.set([]);
    this.selectedSlotId.set(null);
    this.timelineEvents.set([]);
    this.timelineSelection.set(null);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
    this.currentTimeMinutes.set(null);
    this.clearCurrentTimeTicker();
    this.setEditingCalendarEvent(null);
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
    if (payload.variant === 'customer' && payload.calendar) {
      const date = this.isoToDateString(payload.calendar.start);
      const startTime = this.isoToTimeString(payload.calendar.start);
      const endTime = this.isoToTimeString(payload.calendar.end);
      this.calendarGroup.patchValue(
        {
          date,
          startTime,
          endTime,
        },
        { emitEvent: false },
      );
      this.setTimelineSelectionFromTimes(startTime, endTime);
      this.selectionConflict.set(false);
      this.conflictSummary.set(null);
      this.conflictConfirmed.set(false);
      this.selectedSlotId.set(null);
      this.syncCurrentTimeTicker();
      void this.refreshCalendarEventsForDate(date);
    } else {
      this.calendarGroup.reset(
        {
          date: '',
          startTime: '',
          endTime: '',
        },
        { emitEvent: false },
      );
      this.clearCalendarPreview();
    }
  }
  /* c8 ignore end */

  private async refreshCalendarEventsForDate(date: string): Promise<void> {
    this.calendarEventsLoading.set(true);
    this.calendarEventsError.set(null);
    try {
      const events = await this.calendarService.listEventsForDate(date);
      this.calendarEvents.set(events);
      const currentEdit = this.editingCalendarEvent();
      if (currentEdit) {
        const updatedReference = events.find((evt) => evt.id === currentEdit.id) ?? null;
        this.setEditingCalendarEvent(updatedReference);
      }
      this.rebuildTimelineEvents(date, events);
      this.syncCurrentTimeTicker();
      this.evaluateConflictForCurrentTimeRange();
      this.rebuildCalendarSlots(date, events);
    } catch (error) {
      console.warn('Unable to load calendar availability', error);
      this.calendarEventsError.set('Unable to load Google Calendar availability right now.');
      this.calendarEvents.set([]);
      this.calendarSlots.set([]);
      this.selectedSlotId.set(null);
      this.timelineEvents.set([]);
      this.timelineSelection.set(null);
      this.selectionConflict.set(false);
      this.conflictSummary.set(null);
    } finally {
      this.calendarEventsLoading.set(false);
    }
  }

  private todayIsoDate(): string {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }

  private combineDateTime(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }

  private isoToDateString(value: string): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isoToTimeString(value: string): string {
    const date = new Date(value);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  private buildCalendarPayload(): EntryCalendarPayload | undefined {
    if (!this.requiresCalendar()) {
      return undefined;
    }
    const { date, startTime, endTime } = this.calendarGroup.getRawValue();
    if (!date || !startTime || !endTime) {
      return undefined;
    }
    const editingEvent = this.editingCalendarEvent();
    return {
      start: this.combineDateTime(date, startTime),
      end: this.combineDateTime(date, endTime),
      timeZone: this.calendarTimeZone,
      eventId: editingEvent?.id,
    };
  }

  private resetModalState(): void {
    this.form.reset();
    this.panelStore.reset();
    this.clearCalendarPreview();
    this.syncCalendarValidators();
    this.hedgeSelectionError.set(null);
    this.timelineSelection.set(null);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
  }

  private syncCanvasHost(): void {
    this.panelStore.setCanvasHost(this.canvasHost);
  }

  private minutesFromPointer(event: PointerEvent): number {
    const grid = this.timelineGrid?.nativeElement;
    if (!grid) {
      return TIMELINE_START_HOUR * 60;
    }
    const rect = grid.getBoundingClientRect();
    const relative = (event.clientY - rect.top) / rect.height;
    const minutes =
      TIMELINE_START_HOUR * 60 + Math.round(relative * this.timelineTotalMinutes());
    return this.clampTimelineMinutes(this.snapToIncrement(minutes));
  }

  private handleTimelinePointerMove(event: PointerEvent): void {
    if (this.timelineDragStartMinutes == null) {
      return;
    }
    event.preventDefault();
    const current = this.minutesFromPointer(event);
    const start = Math.min(this.timelineDragStartMinutes, current);
    const end = Math.max(this.timelineDragStartMinutes, current);
    const visualEnd = Math.max(start + MIN_SELECTION_MINUTES, end);
    this.timelineSelection.set({
      startMinutes: start,
      endMinutes: visualEnd,
    });
    const adjusted = this.applySelectionOffset(start, visualEnd);
    this.calendarGroup.controls.startTime.setValue(this.minutesToTimeString(adjusted.start));
    this.calendarGroup.controls.endTime.setValue(this.minutesToTimeString(adjusted.end));
    this.evaluateTimelineConflict(start, visualEnd);
  }

  private handleTimelinePointerUp(): void {
    const selection = this.timelineSelection();
    this.stopTimelineDragListeners();
    if (!selection) {
      return;
    }
    this.applyTimelineSelectionMinutes(selection.startMinutes, selection.endMinutes);
  }

  private stopTimelineDragListeners(): void {
    this.timelineDragStartMinutes = null;
    window.removeEventListener('pointermove', this.onTimelinePointerMove);
    window.removeEventListener('pointerup', this.onTimelinePointerUp);
  }

  protected applyTimelineSelectionMinutes(startMinutes: number, endMinutes: number): void {
    this.timelineSelection.set({ startMinutes, endMinutes });
    const adjusted = this.applySelectionOffset(startMinutes, endMinutes);
    this.calendarGroup.controls.startTime.setValue(this.minutesToTimeString(adjusted.start));
    this.calendarGroup.controls.endTime.setValue(this.minutesToTimeString(adjusted.end));
    this.selectedSlotId.set(null);
    this.evaluateTimelineConflict(startMinutes, endMinutes);
  }

  private setTimelineSelectionFromTimes(startTime: string, endTime: string): void {
    const start = this.snapToIncrement(this.timeStringToMinutes(startTime));
    const end = this.snapToIncrement(this.timeStringToMinutes(endTime));
    this.timelineSelection.set({ startMinutes: start, endMinutes: end });
    this.evaluateTimelineConflict(start, end);
  }

  private evaluateTimelineConflict(startMinutes: number, endMinutes: number): void {
    const conflict = this.timelineEvents().find(
      (event) => startMinutes < event.endMinutes && endMinutes > event.startMinutes,
    );
    this.selectionConflict.set(!!conflict);
    this.conflictSummary.set(conflict?.summary ?? null);
    this.conflictConfirmed.set(false);
  }

  private evaluateConflictForCurrentTimeRange(): void {
    const { startTime, endTime } = this.calendarGroup.getRawValue();
    if (!startTime || !endTime) {
      this.selectionConflict.set(false);
      this.conflictSummary.set(null);
      this.conflictConfirmed.set(false);
      return;
    }
    const start = this.timeStringToMinutes(startTime);
    const end = this.timeStringToMinutes(endTime);
    this.evaluateTimelineConflict(start, end);
  }

  private timelineTotalMinutes(): number {
    return (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  }

  private clampTimelineMinutes(minutes: number): number {
    const start = TIMELINE_START_HOUR * 60;
    const end = TIMELINE_END_HOUR * 60;
    return Math.min(end, Math.max(start, minutes));
  }

  private minutesToTimeString(totalMinutes: number): string {
    const snapped = this.snapToIncrement(totalMinutes);
    const hrs = Math.floor(snapped / 60);
    const mins = snapped % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private timeStringToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  }

  private snapToIncrement(minutes: number): number {
    const snapped = Math.round(minutes / TIMELINE_INCREMENT) * TIMELINE_INCREMENT;
    return snapped;
  }

  private applySelectionOffset(startMinutes: number, endMinutes: number): { start: number; end: number } {
    const minStart = TIMELINE_START_HOUR * 60;
    const maxEnd = TIMELINE_END_HOUR * 60;
    let adjustedStart = Math.max(minStart, startMinutes - TIMELINE_SELECTION_OFFSET);
    let adjustedEnd = Math.max(minStart, endMinutes - TIMELINE_SELECTION_OFFSET);
    if (adjustedEnd < adjustedStart + MIN_SELECTION_MINUTES) {
      adjustedEnd = adjustedStart + MIN_SELECTION_MINUTES;
    }
    if (adjustedEnd > maxEnd) {
      adjustedEnd = maxEnd;
      adjustedStart = Math.max(minStart, adjustedEnd - MIN_SELECTION_MINUTES);
    }
    return { start: adjustedStart, end: adjustedEnd };
  }

  private rebuildTimelineEvents(date: string, events: CalendarEventSummary[]): void {
    const startBoundary = TIMELINE_START_HOUR * 60;
    const endBoundary = TIMELINE_END_HOUR * 60;
    const totalMinutes = this.timelineTotalMinutes();
    const normalized = events
      .map((event) => ({
        id: event.id,
        summary: event.summary,
        location: event.location,
        startMinutes: this.isoToLocalMinutes(event.start) + TIMELINE_SELECTION_OFFSET,
        endMinutes: this.isoToLocalMinutes(event.end) + TIMELINE_SELECTION_OFFSET,
      }))
      .filter((event) => event.endMinutes > startBoundary && event.startMinutes < endBoundary)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const active: TimelineEventBlock[] = [];
    const blocks: TimelineEventBlock[] = [];

    for (const event of normalized) {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        if (active[i].endMinutes <= event.startMinutes) {
          active.splice(i, 1);
        }
      }
      const usedColumns = active.map((block) => block.column);
      let column = 0;
      while (usedColumns.includes(column)) {
        column += 1;
      }
      const visibleStart = Math.max(event.startMinutes, startBoundary);
      const visibleEnd = Math.min(event.endMinutes, endBoundary);
      const block: TimelineEventBlock = {
        id: event.id,
        summary: event.summary,
        location: event.location,
        startMinutes: event.startMinutes,
        endMinutes: event.endMinutes,
        column,
        columns: active.length + 1,
        topPercent: ((visibleStart - startBoundary) / totalMinutes) * 100,
        heightPercent: ((visibleEnd - visibleStart) / totalMinutes) * 100,
        leftPercent: 0,
        widthPercent: 100,
      };
      active.push(block);
      const columnCount = active.length;
      active.forEach((activeBlock) => {
        activeBlock.columns = Math.max(activeBlock.columns, columnCount);
      });
      blocks.push(block);
    }

    blocks.forEach((block) => {
      const visibleStart = Math.max(block.startMinutes, startBoundary);
      const visibleEnd = Math.min(block.endMinutes, endBoundary);
      block.topPercent = ((visibleStart - startBoundary) / totalMinutes) * 100;
      block.heightPercent = Math.max(
        ((visibleEnd - visibleStart) / totalMinutes) * 100,
        (MIN_SELECTION_MINUTES / totalMinutes) * 100,
      );
      block.widthPercent = 100 / block.columns;
      block.leftPercent = block.column * block.widthPercent;
    });

    this.timelineEvents.set(blocks);
  }

  private isoToLocalMinutes(value: string): number {
    const date = new Date(value);
    return date.getHours() * 60 + date.getMinutes();
  }

  private syncCurrentTimeTicker(): void {
    const date = this.calendarGroup.controls.date.value;
    if (!date || date !== this.todayIsoDate()) {
      this.currentTimeMinutes.set(null);
      this.clearCurrentTimeTicker();
      return;
    }
    this.updateCurrentTimeMinutes();
    if (this.currentTimeTicker == null) {
      this.currentTimeTicker = window.setInterval(() => this.updateCurrentTimeMinutes(), 60000);
    }
  }

  private updateCurrentTimeMinutes(): void {
    const date = this.calendarGroup.controls.date.value;
    if (date !== this.todayIsoDate()) {
      this.currentTimeMinutes.set(null);
      this.clearCurrentTimeTicker();
      return;
    }
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < TIMELINE_START_HOUR * 60 || minutes > TIMELINE_END_HOUR * 60) {
      this.currentTimeMinutes.set(null);
      return;
    }
    this.currentTimeMinutes.set(minutes);
  }

  private clearCurrentTimeTicker(): void {
    if (this.currentTimeTicker != null) {
      clearInterval(this.currentTimeTicker);
      this.currentTimeTicker = null;
    }
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

  protected timelineHourPosition(index: number): number {
    const totalMarks = Math.max(1, this.timelineHours.length - 1);
    return (index / totalMarks) * 100;
  }

  protected timelineSelectionStyle():
    | { topPercent: number; heightPercent: number; conflict: boolean }
    | null {
    const selection = this.timelineSelection();
    if (!selection) {
      return null;
    }
    const clampedStart = Math.max(selection.startMinutes, TIMELINE_START_HOUR * 60);
    const clampedEnd = Math.min(selection.endMinutes, TIMELINE_END_HOUR * 60);
    if (clampedEnd <= clampedStart) {
      return null;
    }
    const total = this.timelineTotalMinutes();
    return {
      topPercent: ((clampedStart - TIMELINE_START_HOUR * 60) / total) * 100,
      heightPercent: ((clampedEnd - clampedStart) / total) * 100,
      conflict: this.selectionConflict(),
    };
  }

  protected timelineNowLineStyle(): { topPercent: number } | null {
    const minutes = this.currentTimeMinutes();
    if (minutes == null) {
      return null;
    }
    const adjustedMinutes = Math.min(
      Math.max(minutes + 15, TIMELINE_START_HOUR * 60),
      TIMELINE_END_HOUR * 60,
    );
    const total = this.timelineTotalMinutes();
    return {
      topPercent: ((adjustedMinutes - TIMELINE_START_HOUR * 60) / total) * 100,
    };
  }

  protected onTimelinePointerDown(event: PointerEvent): void {
    if (!this.requiresCalendar()) {
      return;
    }
    const date = this.calendarGroup.controls.date.value;
    if (!date || !this.timelineGrid) {
      this.calendarGroup.controls.date.markAsTouched();
      return;
    }
    event.preventDefault();
    const minutes = this.minutesFromPointer(event);
    this.timelineDragStartMinutes = minutes;
    const endMinutes = minutes + MIN_SELECTION_MINUTES;
    this.timelineSelection.set({
      startMinutes: minutes,
      endMinutes,
    });
    const adjusted = this.applySelectionOffset(minutes, endMinutes);
    this.calendarGroup.controls.startTime.setValue(this.minutesToTimeString(adjusted.start));
    this.calendarGroup.controls.endTime.setValue(this.minutesToTimeString(adjusted.end));
    this.selectedSlotId.set(null);
    this.evaluateTimelineConflict(minutes, endMinutes);
    window.addEventListener('pointermove', this.onTimelinePointerMove);
    window.addEventListener('pointerup', this.onTimelinePointerUp, { once: true });
  }

  protected confirmTimelineConflict(): void {
    this.conflictConfirmed.set(true);
  }

  protected conflictWarningText(): string | null {
    return this.conflictSummary();
  }

  protected conflictConfirmedFlag(): boolean {
    return this.conflictConfirmed();
  }

  protected isPrimaryDisabled(): boolean {
    return this.requiresCalendar() && this.selectionConflict() && !this.conflictConfirmed();
  }

  protected beginPanelDrag(event: PointerEvent): void {
    this.syncCanvasHost();
    this.panelStore.beginPanelDrag(event);
  }

  protected selectCalendarSlot(slotId: string): void {
    const slot = this.calendarSlots().find((candidate) => candidate.id === slotId);
    if (!slot || slot.status === 'booked') {
      return;
    }
    this.selectedSlotId.set(slot.id);
    this.calendarGroup.controls.startTime.setValue(slot.startTime);
    this.calendarGroup.controls.endTime.setValue(slot.endTime);
    this.setTimelineSelectionFromTimes(slot.startTime, slot.endTime);
  }

  protected handleManualTimeChange(): void {
    this.selectedSlotId.set(null);
    this.timelineSelection.set(null);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
    this.evaluateConflictForCurrentTimeRange();
  }

  protected cancelCalendarEdit(): void {
    this.setEditingCalendarEvent(null);
  }

  protected editCalendarEvent(event: CalendarEventSummary): void {
    this.setEditingCalendarEvent(event);
    const startTime = this.isoToTimeString(event.start);
    const endTime = this.isoToTimeString(event.end);
    const date = this.isoToDateString(event.start);
    this.calendarGroup.patchValue(
      {
        date,
        startTime,
        endTime,
      },
      { emitEvent: false },
    );
    this.selectedSlotId.set(null);
    this.timelineSelection.set(null);
    this.setTimelineSelectionFromTimes(startTime, endTime);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
  }

  protected async deleteCalendarEvent(event: CalendarEventSummary): Promise<void> {
    if (!event.id) {
      return;
    }
    this.calendarEventsError.set(null);
    try {
      this.calendarEventsLoading.set(true);
      await this.calendarService.deleteEvent(event.id);
      const date = this.calendarGroup.controls.date.value;
      if (date) {
        await this.refreshCalendarEventsForDate(date);
      } else {
        this.calendarEvents.set(this.calendarEvents().filter((candidate) => candidate.id !== event.id));
        const currentEditing = this.editingCalendarEvent();
        if (currentEditing && currentEditing.id === event.id) {
          this.setEditingCalendarEvent(null);
        }
      }
    } catch (error) {
      /* c8 ignore next */
      console.error('Failed to delete calendar event', error);
      this.calendarEventsError.set('Unable to delete calendar event. Please retry.');
    } finally {
      this.calendarEventsLoading.set(false);
    }
  }

  private rebuildCalendarSlots(date: string, events: CalendarEventSummary[]): void {
    const normalizedEvents = events.map((event) => ({
      ...event,
      startMs: new Date(event.start).getTime(),
      endMs: new Date(event.end).getTime(),
    }));
    const slots: CalendarSlot[] = CALENDAR_SLOT_TEMPLATES.map((template) => {
      const slotStartIso = this.combineDateTime(date, template.start);
      const slotEndIso = this.combineDateTime(date, template.end);
      const slotStartMs = new Date(slotStartIso).getTime();
      const slotEndMs = new Date(slotEndIso).getTime();
      const conflict = normalizedEvents.find(
        (event) => slotStartMs < event.endMs && slotEndMs > event.startMs,
      );
      return {
        id: template.id,
        startTime: template.start,
        endTime: template.end,
        label: `${this.eventTimeFormatter.format(new Date(slotStartIso))} – ${this.eventTimeFormatter.format(new Date(slotEndIso))}`,
        status: conflict ? 'booked' : 'available',
        conflictSummary: conflict?.summary,
      };
    });
    this.calendarSlots.set(slots);
    const currentStart = this.calendarGroup.controls.startTime.value;
    const currentEnd = this.calendarGroup.controls.endTime.value;
    const matchingSlot = slots.find(
      (slot) => slot.startTime === currentStart && slot.endTime === currentEnd && slot.status === 'available',
    );
    this.selectedSlotId.set(matchingSlot?.id ?? null);
  }

  protected editingUpdateDisabled(): boolean {
    if (!this.editingCalendarEvent()) {
      return true;
    }
    if (this.calendarEventsLoading()) {
      return true;
    }
    const { date, startTime, endTime } = this.calendarGroup.getRawValue();
    const missingFields = !(date && startTime && endTime);
    return missingFields || (this.selectionConflict() && !this.conflictConfirmed());
  }

  protected async updateCalendarEvent(): Promise<void> {
    const editing = this.editingCalendarEvent();
    if (!editing) {
      return;
    }
    if (!this.validationService.validateCalendarRange(this.calendarGroup, this.requiresCalendar())) {
      return;
    }
    if (this.selectionConflict() && !this.conflictConfirmed()) {
      return;
    }
    const { date, startTime, endTime } = this.calendarGroup.getRawValue();
    const startIso = this.combineDateTime(date, startTime);
    const endIso = this.combineDateTime(date, endTime);
    const { summary, notes } = this.editingCalendarForm.getRawValue();
    const summaryOverride = summary?.trim() ?? '';
    const notesOverride = notes?.trim() ?? '';
    const request: UpdateCalendarEventRequest = {
      summary: summaryOverride ? summaryOverride : editing.summary,
      description: notesOverride ? notesOverride : editing.description,
      location: editing.location,
      start: startIso,
      end: endIso,
      timeZone: this.calendarTimeZone,
    };

    this.calendarEventsLoading.set(true);
    this.calendarEventsError.set(null);

    try {
      const updated = await this.calendarService.updateEvent(editing.id, request);
      this.setEditingCalendarEvent(updated);
      await this.refreshCalendarEventsForDate(date);
      this.setTimelineSelectionFromTimes(this.isoToTimeString(startIso), this.isoToTimeString(endIso));
      this.selectionConflict.set(false);
      this.conflictSummary.set(null);
      this.conflictConfirmed.set(false);
      this.selectedSlotId.set(null);
    } catch (error) {
      console.error('Failed to update calendar event', error);
      this.calendarEventsError.set('Unable to update calendar event. Please retry.');
    } finally {
      this.calendarEventsLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.formChangesSub.unsubscribe();
    this.panelStore.destroy();
    this.stopTimelineDragListeners();
    this.clearCurrentTimeTicker();
  }
}



