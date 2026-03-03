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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
} from '../../services/calendar-events.service.js';

export { northAmericanPhoneValidator } from './entry-modal-phone.util.js';


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
    if (value === 'customer') {
      this.ensureCalendarDefaults();
    } else {
      this.clearCalendarPreview();
    }
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
  private readonly calendarService = inject(CalendarEventsService);
  protected readonly calendarEvents = signal<CalendarEventSummary[]>([]);
  protected readonly calendarEventsLoading = signal(false);
  protected readonly calendarEventsError = signal<string | null>(null);
  protected readonly calendarTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private readonly eventTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  protected readonly panelStore = new EntryModalPanelStore();
  protected readonly hedgeStates = this.panelStore.hedgeStates;
  protected readonly savedConfigs = this.panelStore.savedConfigs;
  protected readonly panelState: WritableSignal<PanelState | null> = this.panelStore.panelState;
  protected readonly panelPosition = this.panelStore.panelPosition;
  protected readonly panelError = this.panelStore.panelError;
  /* c8 ignore next */
  protected readonly floatingPanelEnabled = this.panelStore.floatingPanelEnabled;
  protected readonly hedges = this.panelStore.hedges;
  protected readonly hedgePoints = this.panelStore.hedgePoints;
  protected panelFloats(): boolean {
    return this.panelStore.panelFloats();
  }

  private readonly jobTypeControl = this.form.controls.jobType;
  protected readonly jobTypeOptions = ['Hedge Trimming', 'Rabattage', 'Both'] as const;
  protected readonly rabattageOptions: RabattageOption[] = ['partial', 'total', 'total_no_roots'];

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

  protected jobTypeSelected(): boolean {
    return this.jobTypeControl.value !== '';
  }

  protected requiresCalendar(): boolean {
    return this.variant === 'customer';
  }

  protected handleCalendarDateChange(): void {
    if (!this.requiresCalendar()) {
      return;
    }
    const date = this.calendarGroup.controls.date.value;
    if (!date) {
      this.clearCalendarPreview();
      return;
    }
    void this.refreshCalendarEventsForDate(date);
  }

  protected formatEventTimeRange(event: CalendarEventSummary): string {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return `${this.eventTimeFormatter.format(start)} – ${this.eventTimeFormatter.format(end)}`;
  }

  constructor() {
    this.syncCalendarValidators();
  }

  protected cycleHedge(event: MouseEvent, hedgeId: HedgeId): void {
    event.stopPropagation();
    this.syncCanvasHost();
    this.panelStore.cycleHedge(event, hedgeId);
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
  }

  protected cancelPanel(): void {
    this.panelStore.cancelPanel();
  }

  protected closePanel(resetSelection = false): void {
    this.panelStore.closePanel(resetSelection);
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

    const hedgesPayload = this.panelStore.buildHedgePayload();
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
    return this.panelStore.getHedgeState(hedgeId);
  }

  protected hasSavedConfig(hedgeId: HedgeId): boolean {
    return this.panelStore.hasSavedConfig(hedgeId);
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
  }

  private async refreshCalendarEventsForDate(date: string): Promise<void> {
    this.calendarEventsLoading.set(true);
    this.calendarEventsError.set(null);
    try {
      const events = await this.calendarService.listEventsForDate(date);
      this.calendarEvents.set(events);
    } catch (error) {
      console.warn('Unable to load calendar availability', error);
      this.calendarEventsError.set('Unable to load Google Calendar availability right now.');
      this.calendarEvents.set([]);
    } finally {
      this.calendarEventsLoading.set(false);
    }
  }

  private todayIsoDate(): string {
    const today = new Date();
    return today.toISOString().slice(0, 10);
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
      timeZone: this.calendarTimeZone,
    };
  }

  private resetModalState(): void {
    this.form.reset();
    this.panelStore.reset();
    this.clearCalendarPreview();
    this.syncCalendarValidators();
  }

  private syncCanvasHost(): void {
    this.panelStore.setCanvasHost(this.canvasHost);
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
    this.syncCanvasHost();
    this.panelStore.beginPanelDrag(event);
  }

  ngOnDestroy(): void {
    this.panelStore.destroy();
  }
}
