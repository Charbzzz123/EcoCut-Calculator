import { ElementRef, signal, type WritableSignal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import {
  CalendarEventSummary,
  CalendarEventsService,
  type UpdateCalendarEventRequest,
} from '@shared/domain/entry/calendar-events.service.js';
import type { EntryCalendarPayload, EntryVariant } from '@shared/domain/entry/entry-modal.models.js';
import { EntryModalValidationService } from './entry-modal-validation.service.js';
import type { EntryScheduleSectionViewModel } from './entry-schedule-section/entry-schedule-section.component.js';
import type { TimelineSelectionStyle } from './entry-timeline/entry-timeline.component.js';

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

interface ScheduleControllerDeps {
  calendarGroup: FormGroup<{
    date: FormControl<string>;
    startTime: FormControl<string>;
    endTime: FormControl<string>;
  }>;
  editingCalendarForm: FormGroup<{
    summary: FormControl<string>;
    notes: FormControl<string>;
  }>;
  calendarService: CalendarEventsService;
  validationService: EntryModalValidationService;
  initialVariant: EntryVariant;
  calendarTimeZone?: string;
  requestRefresh: (date: string) => Promise<void>;
  requestEnsureCalendarDefaults: () => void;
}

export type CalendarTimelineViewMode = 'day' | 'week' | 'month';

export interface CalendarOverviewDay {
  date: string;
  dayLabel: string;
  dayNumberLabel: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  eventCount: number;
  busyPercent: number;
  previewText: string | null;
}

export class EntryModalScheduleController {
  readonly timelineHours = Array.from(
    { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
    (_, index) => TIMELINE_START_HOUR + index,
  );
  readonly timelineHelperText =
    'Click and drag to choose a slot. Conflicts require confirmation.';

  private variant: EntryVariant;
  private readonly calendarTimeZone: string;
  private readonly requestRefresh: (date: string) => Promise<void>;
  private readonly requestEnsureCalendarDefaults: () => void;

  private readonly calendarEvents: WritableSignal<CalendarEventSummary[]>;
  private readonly calendarEventsLoading: WritableSignal<boolean>;
  private readonly calendarEventsError: WritableSignal<string | null>;
  private readonly calendarSlots: WritableSignal<CalendarSlot[]>;
  private readonly selectedSlotId: WritableSignal<string | null>;
  private readonly timelineEvents: WritableSignal<TimelineEventBlock[]>;
  private readonly timelineSelection: WritableSignal<{ startMinutes: number; endMinutes: number } | null>;
  private readonly selectionConflict: WritableSignal<boolean>;
  private readonly conflictSummary: WritableSignal<string | null>;
  private readonly conflictConfirmed: WritableSignal<boolean>;
  private readonly currentTimeMinutes: WritableSignal<number | null>;
  private readonly editingCalendarEvent: WritableSignal<CalendarEventSummary | null>;
  private readonly calendarViewMode: WritableSignal<CalendarTimelineViewMode>;
  private readonly weekOverviewDays: WritableSignal<CalendarOverviewDay[]>;
  private readonly monthOverviewWeeks: WritableSignal<CalendarOverviewDay[][]>;
  private readonly calendarOverviewLoading: WritableSignal<boolean>;
  private readonly calendarOverviewError: WritableSignal<string | null>;

  private timelineGrid?: ElementRef<HTMLElement>;
  private timelineDragStartMinutes: number | null = null;
  private currentTimeTicker: ReturnType<typeof setInterval> | null = null;
  private overviewRequestVersion = 0;

  /* c8 ignore start */
  constructor(private readonly deps: ScheduleControllerDeps) {
    this.calendarEvents = signal<CalendarEventSummary[]>([]);
    this.calendarEventsLoading = signal(false);
    this.calendarEventsError = signal<string | null>(null);
    this.calendarSlots = signal<CalendarSlot[]>([]);
    this.selectedSlotId = signal<string | null>(null);
    this.timelineEvents = signal<TimelineEventBlock[]>([]);
    this.timelineSelection = signal<{ startMinutes: number; endMinutes: number } | null>(null);
    this.selectionConflict = signal(false);
    this.conflictSummary = signal<string | null>(null);
    this.conflictConfirmed = signal(false);
    this.currentTimeMinutes = signal<number | null>(null);
    this.editingCalendarEvent = signal<CalendarEventSummary | null>(null);
    this.calendarViewMode = signal<CalendarTimelineViewMode>('day');
    this.weekOverviewDays = signal<CalendarOverviewDay[]>([]);
    this.monthOverviewWeeks = signal<CalendarOverviewDay[][]>([]);
    this.calendarOverviewLoading = signal(false);
    this.calendarOverviewError = signal<string | null>(null);
    /* c8 ignore stop */

    this.variant = deps.initialVariant;
    this.calendarTimeZone =
      deps.calendarTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.requestRefresh = deps.requestRefresh;
    this.requestEnsureCalendarDefaults = deps.requestEnsureCalendarDefaults;
  }
  /* c8 ignore stop */

  getTimelineDragStartMinutes(): number | null {
    return this.timelineDragStartMinutes;
  }

  setTimelineDragStartMinutes(value: number | null): void {
    this.timelineDragStartMinutes = value;
  }

  getCurrentTimeTicker(): ReturnType<typeof setInterval> | null {
    return this.currentTimeTicker;
  }

  setCurrentTimeTicker(value: ReturnType<typeof setInterval> | null): void {
    this.currentTimeTicker = value;
  }

  calendarEventsSignal() {
    return this.calendarEvents;
  }

  calendarEventsLoadingSignal() {
    return this.calendarEventsLoading;
  }

  calendarEventsErrorSignal() {
    return this.calendarEventsError;
  }

  calendarSlotsSignal() {
    return this.calendarSlots;
  }

  selectedSlotIdSignal() {
    return this.selectedSlotId;
  }

  timelineEventsSignal() {
    return this.timelineEvents;
  }

  timelineSelectionSignal() {
    return this.timelineSelection;
  }

  selectionConflictSignal() {
    return this.selectionConflict;
  }

  conflictSummarySignal() {
    return this.conflictSummary;
  }

  conflictConfirmedSignal() {
    return this.conflictConfirmed;
  }

  currentTimeMinutesSignal() {
    return this.currentTimeMinutes;
  }

  editingCalendarEventSignal() {
    return this.editingCalendarEvent;
  }

  buildViewModel(): EntryScheduleSectionViewModel {
    return {
      calendarGroup: this.deps.calendarGroup,
      calendarTimeZone: this.calendarTimeZone,
      calendarViewMode: this.calendarViewMode(),
      calendarRangeLabel: this.calendarRangeLabel(),
      weekOverviewDays: this.weekOverviewDays(),
      monthOverviewWeeks: this.monthOverviewWeeks(),
      calendarOverviewLoading: this.calendarOverviewLoading(),
      calendarOverviewError: this.calendarOverviewError(),
      timelineHours: this.timelineHours,
      timelineEvents: this.timelineEvents(),
      timelineSelectionStyle: this.timelineSelectionStyle(),
      timelineNowLine: this.timelineNowLineStyle(),
      timelineHelperText: this.timelineHelperText,
      selectionConflict: this.selectionConflict(),
      conflictSummary: this.conflictSummary(),
      conflictConfirmed: this.conflictConfirmed(),
      calendarSlots: this.calendarSlots(),
      selectedSlotId: this.selectedSlotId(),
      calendarEventsLoading: this.calendarEventsLoading(),
      calendarEventsError: this.calendarEventsError(),
      calendarEvents: this.calendarEvents(),
      editingCalendarEvent: this.editingCalendarEvent(),
      editingCalendarForm: this.deps.editingCalendarForm,
      editingUpdateDisabled: this.editingUpdateDisabled(),
    };
  }

  destroy(): void {
    this.stopTimelineDragListeners();
    this.clearCurrentTimeTicker();
  }

  setVariant(next: EntryVariant, options: { allowSideEffects: boolean }): void {
    this.variant = next;
    if (!options.allowSideEffects) {
      return;
    }
    if (next === 'customer') {
      this.ensureCalendarDefaults();
    } else {
      this.clearPreview();
    }
  }

  ensureCalendarDefaults(): void {
    this.requestEnsureCalendarDefaults();
  }

  reset(): void {
    this.clearPreview();
    this.deps.calendarGroup.patchValue(
      { date: '', startTime: '', endTime: '' },
      { emitEvent: false },
    );
    this.calendarViewMode.set('day');
  }

  setCalendarViewMode(mode: CalendarTimelineViewMode): void {
    if (this.calendarViewMode() === mode) {
      return;
    }
    this.calendarViewMode.set(mode);
    if (mode === 'day') {
      this.calendarOverviewError.set(null);
      return;
    }
    const date = this.deps.calendarGroup.controls.date.value;
    if (date) {
      void this.prefetchCalendarWindow(date);
    }
    void this.refreshCalendarOverview();
  }

  shiftCalendarWindow(direction: -1 | 1): void {
    const currentDate = this.selectedDateOrToday();
    const nextDate = new Date(currentDate.getTime());
    if (this.calendarViewMode() === 'month') {
      nextDate.setMonth(nextDate.getMonth() + direction);
    } else if (this.calendarViewMode() === 'week') {
      nextDate.setDate(nextDate.getDate() + direction * 7);
    } else {
      nextDate.setDate(nextDate.getDate() + direction);
    }
    const nextIso = this.toIsoDate(nextDate);
    this.deps.calendarGroup.controls.date.setValue(nextIso);
    this.handleCalendarDateChange();
  }

  jumpCalendarToToday(): void {
    const today = this.todayIsoDate();
    this.deps.calendarGroup.controls.date.setValue(today);
    this.handleCalendarDateChange();
  }

  selectCalendarOverviewDate(date: string): void {
    this.deps.calendarGroup.controls.date.setValue(date);
    this.calendarViewMode.set('day');
    this.handleCalendarDateChange();
  }

  applyCalendarPayload(payload: EntryCalendarPayload | undefined | null): void {
    if (!payload || this.variant !== 'customer') {
      this.reset();
      return;
    }
    const date = this.isoToDateString(payload.start);
    const startTime = this.isoToTimeString(payload.start);
    const endTime = this.isoToTimeString(payload.end);
    this.deps.calendarGroup.patchValue({ date, startTime, endTime }, { emitEvent: false });
    this.setTimelineSelectionFromTimes(startTime, endTime);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
    this.selectedSlotId.set(null);
    this.syncCurrentTimeTicker();
    void this.requestRefresh(date);
  }

  buildCalendarPayload(): EntryCalendarPayload | undefined {
    if (this.variant !== 'customer') {
      return undefined;
    }
    const { date, startTime, endTime } = this.deps.calendarGroup.getRawValue();
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

  handleCalendarDateChange(): void {
    if (this.variant !== 'customer') {
      return;
    }
    const date = this.deps.calendarGroup.controls.date.value;
    if (!date) {
      this.clearPreview();
      this.deps.calendarGroup.patchValue({ startTime: '', endTime: '' }, { emitEvent: false });
      this.setEditingCalendarEvent(null);
      return;
    }
    this.deps.calendarGroup.patchValue({ startTime: '', endTime: '' }, { emitEvent: false });
    this.selectedSlotId.set(null);
    this.timelineSelection.set(null);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
    this.syncCurrentTimeTicker();
    void this.requestRefresh(date);
    void this.prefetchCalendarWindow(date);
    if (this.calendarViewMode() !== 'day') {
      void this.refreshCalendarOverview();
    }
  }

  handleManualTimeChange(): void {
    this.selectedSlotId.set(null);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
    const { startTime, endTime } = this.deps.calendarGroup.getRawValue();
    if (!startTime || !endTime) {
      this.timelineSelection.set(null);
      return;
    }
    const startMinutes = this.toTimelineMinutes(startTime);
    const endMinutes = this.toTimelineMinutes(endTime);
    if (endMinutes <= startMinutes) {
      this.timelineSelection.set(null);
      this.evaluateConflictForCurrentTimeRange();
      return;
    }
    this.timelineSelection.set({
      startMinutes,
      endMinutes,
    });
    this.evaluateConflictForCurrentTimeRange();
  }

  handleTimelinePointerDown(event: PointerEvent): void {
    if (this.variant !== 'customer') {
      return;
    }
    const date = this.deps.calendarGroup.controls.date.value;
    if (!date || !this.timelineGrid) {
      this.deps.calendarGroup.controls.date.markAsTouched();
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
    this.deps.calendarGroup.controls.startTime.setValue(this.minutesToTimeString(adjusted.start));
    this.deps.calendarGroup.controls.endTime.setValue(this.minutesToTimeString(adjusted.end));
    this.selectedSlotId.set(null);
    this.evaluateTimelineConflict(minutes, endMinutes);
    window.addEventListener('pointermove', this.onTimelinePointerMove);
    window.addEventListener('pointerup', this.onTimelinePointerUp, { once: true });
  }

  handleTimelineGridReady(ref: ElementRef<HTMLElement>): void {
    this.timelineGrid = ref;
  }

  confirmTimelineConflict(): void {
    this.conflictConfirmed.set(true);
  }

  selectCalendarSlot(slotId: string): void {
    const slot = this.calendarSlots().find((candidate) => candidate.id === slotId);
    if (!slot || slot.status === 'booked') {
      return;
    }
    this.selectedSlotId.set(slot.id);
    this.deps.calendarGroup.controls.startTime.setValue(slot.startTime);
    this.deps.calendarGroup.controls.endTime.setValue(slot.endTime);
    this.setTimelineSelectionFromTimes(slot.startTime, slot.endTime);
  }

  editCalendarEvent(event: CalendarEventSummary): void {
    this.setEditingCalendarEvent(event);
    const startTime = this.isoToTimeString(event.start);
    const endTime = this.isoToTimeString(event.end);
    const date = this.isoToDateString(event.start);
    this.deps.calendarGroup.patchValue({ date, startTime, endTime }, { emitEvent: false });
    this.selectedSlotId.set(null);
    this.timelineSelection.set(null);
    this.setTimelineSelectionFromTimes(startTime, endTime);
    this.selectionConflict.set(false);
    this.conflictSummary.set(null);
    this.conflictConfirmed.set(false);
  }

  async deleteCalendarEvent(event: CalendarEventSummary): Promise<void> {
    if (!event.id) {
      return;
    }
    this.calendarEventsError.set(null);
    try {
      this.calendarEventsLoading.set(true);
      await this.deps.calendarService.deleteEvent(event.id);
      const date = this.deps.calendarGroup.controls.date.value;
      if (date) {
        await this.requestRefresh(date);
      } else {
        this.calendarEvents.set(this.calendarEvents().filter((candidate) => candidate.id !== event.id));
        const currentEditing = this.editingCalendarEvent();
        if (currentEditing && currentEditing.id === event.id) {
          this.setEditingCalendarEvent(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete calendar event', error);
      this.calendarEventsError.set('Unable to delete calendar event. Please retry.');
    } finally {
      this.calendarEventsLoading.set(false);
    }
  }

  cancelCalendarEdit(): void {
    this.setEditingCalendarEvent(null);
  }

  async updateCalendarEvent(): Promise<void> {
    const editing = this.editingCalendarEvent();
    if (!editing) {
      return;
    }
    if (
      !this.deps.validationService.validateCalendarRange(
        this.deps.calendarGroup,
        this.variant === 'customer',
      )
    ) {
      return;
    }
    if (this.selectionConflict() && !this.conflictConfirmed()) {
      return;
    }
    const { date, startTime, endTime } = this.deps.calendarGroup.getRawValue();
    const startIso = this.combineDateTime(date, startTime);
    const endIso = this.combineDateTime(date, endTime);
    const { summary, notes } = this.deps.editingCalendarForm.getRawValue();
    const summaryOverride = summary.trim();
    const notesOverride = notes.trim();
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
      const updated = await this.deps.calendarService.updateEvent(editing.id, request);
      this.setEditingCalendarEvent(updated);
      await this.requestRefresh(date);
      this.setTimelineSelectionFromTimes(
        this.isoToTimeString(startIso),
        this.isoToTimeString(endIso),
      );
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

  formatEventTimeRange(event: CalendarEventSummary): string {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return `${this.eventTimeFormatter.format(start)} - ${this.eventTimeFormatter.format(end)}`;
  }

  private readonly onTimelinePointerMove = (event: PointerEvent) => this.handleTimelinePointerMove(event);
  private readonly onTimelinePointerUp = () => this.handleTimelinePointerUp();

  handleTimelinePointerMove(event: PointerEvent): void {
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
    this.deps.calendarGroup.controls.startTime.setValue(this.minutesToTimeString(adjusted.start));
    this.deps.calendarGroup.controls.endTime.setValue(this.minutesToTimeString(adjusted.end));
    this.evaluateTimelineConflict(start, visualEnd);
  }

  handleTimelinePointerUp(): void {
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

  applyTimelineSelectionMinutes(startMinutes: number, endMinutes: number): void {
    this.timelineSelection.set({ startMinutes, endMinutes });
    const adjusted = this.applySelectionOffset(startMinutes, endMinutes);
    this.deps.calendarGroup.controls.startTime.setValue(this.minutesToTimeString(adjusted.start));
    this.deps.calendarGroup.controls.endTime.setValue(this.minutesToTimeString(adjusted.end));
    this.selectedSlotId.set(null);
    this.evaluateTimelineConflict(startMinutes, endMinutes);
  }

  private setTimelineSelectionFromTimes(startTime: string, endTime: string): void {
    const start = this.toTimelineMinutes(startTime);
    const end = this.toTimelineMinutes(endTime);
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
    const { startTime, endTime } = this.deps.calendarGroup.getRawValue();
    if (!startTime || !endTime) {
      this.selectionConflict.set(false);
      this.conflictSummary.set(null);
      this.conflictConfirmed.set(false);
      return;
    }
    const start = this.toTimelineMinutes(startTime);
    const end = this.toTimelineMinutes(endTime);
    this.evaluateTimelineConflict(start, end);
  }

  private timelineSelectionStyle(): TimelineSelectionStyle | null {
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

  private timelineNowLineStyle(): { topPercent: number } | null {
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

  private editingUpdateDisabled(): boolean {
    if (!this.editingCalendarEvent()) {
      return true;
    }
    if (this.calendarEventsLoading()) {
      return true;
    }
    const { date, startTime, endTime } = this.deps.calendarGroup.getRawValue();
    const missingFields = !(date && startTime && endTime);
    return missingFields || (this.selectionConflict() && !this.conflictConfirmed());
  }

  hasBlockingConflict(): boolean {
    return this.selectionConflict() && !this.conflictConfirmed();
  }

  getConflictSummary(): string | null {
    return this.conflictSummary();
  }

  isConflictConfirmed(): boolean {
    return this.conflictConfirmed();
  }

  async refreshCalendarEventsForDate(date: string): Promise<void> {
    this.calendarEventsLoading.set(true);
    this.calendarEventsError.set(null);
    try {
      const events = await this.deps.calendarService.listEventsForDate(date);
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
      if (this.calendarViewMode() !== 'day') {
        await this.refreshCalendarOverview();
      }
      void this.prefetchCalendarWindow(date);
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

  clearPreview(): void {
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
    this.calendarOverviewLoading.set(false);
    this.calendarOverviewError.set(null);
    this.weekOverviewDays.set([]);
    this.monthOverviewWeeks.set([]);
  }

  rebuildCalendarSlots(date: string, events: CalendarEventSummary[]): void {
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
        label: `${this.eventTimeFormatter.format(new Date(slotStartIso))} - ${this.eventTimeFormatter.format(
          new Date(slotEndIso),
        )}`,
        status: conflict ? 'booked' : 'available',
        conflictSummary: conflict?.summary,
      };
    });
    this.calendarSlots.set(slots);
    const currentStart = this.deps.calendarGroup.controls.startTime.value;
    const currentEnd = this.deps.calendarGroup.controls.endTime.value;
    const matchingSlot = slots.find(
      (slot) => slot.startTime === currentStart && slot.endTime === currentEnd && slot.status === 'available',
    );
    this.selectedSlotId.set(matchingSlot?.id ?? null);
  }

  rebuildTimelineEvents(date: string, events: CalendarEventSummary[]): void {
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

  syncCurrentTimeTicker(): void {
    const date = this.deps.calendarGroup.controls.date.value;
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

  updateCurrentTimeMinutes(): void {
    const date = this.deps.calendarGroup.controls.date.value;
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

  clearCurrentTimeTicker(): void {
    if (this.currentTimeTicker != null) {
      clearInterval(this.currentTimeTicker);
      this.currentTimeTicker = null;
    }
  }

  private setEditingCalendarEvent(event: CalendarEventSummary | null): void {
    this.editingCalendarEvent.set(event);
    if (!event) {
      this.deps.editingCalendarForm.reset({ summary: '', notes: '' });
      return;
    }
    this.deps.editingCalendarForm.patchValue(
      {
        summary: event.summary ?? '',
        notes: event.description ?? '',
      },
      { emitEvent: false },
    );
  }

  private calendarRangeLabel(): string {
    const selectedDate = this.selectedDateOrToday();
    const mode = this.calendarViewMode();
    if (mode === 'month') {
      return selectedDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }
    if (mode === 'week') {
      const weekStart = this.startOfWeek(selectedDate);
      const weekEnd = this.endOfWeek(selectedDate);
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      const startLabel = weekStart.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const endLabel = weekEnd.toLocaleDateString(undefined, {
        month: sameMonth ? undefined : 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startLabel} - ${endLabel}`;
    }
    return selectedDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private async refreshCalendarOverview(): Promise<void> {
    if (this.variant !== 'customer') {
      this.weekOverviewDays.set([]);
      this.monthOverviewWeeks.set([]);
      this.calendarOverviewError.set(null);
      this.calendarOverviewLoading.set(false);
      return;
    }
    const selectedDate = this.selectedDateOrToday();
    const mode = this.calendarViewMode();
    if (mode === 'day') {
      this.weekOverviewDays.set([]);
      this.monthOverviewWeeks.set([]);
      this.calendarOverviewError.set(null);
      this.calendarOverviewLoading.set(false);
      return;
    }

    const selectedIso = this.toIsoDate(selectedDate);
    const range =
      mode === 'week'
        ? { start: this.startOfWeek(selectedDate), end: this.endOfWeek(selectedDate) }
        : { start: this.startOfWeek(this.startOfMonth(selectedDate)), end: this.endOfWeek(this.endOfMonth(selectedDate)) };
    const startIso = this.toIsoDate(range.start);
    const endIso = this.toIsoDate(range.end);

    const requestVersion = ++this.overviewRequestVersion;
    const applyOverview = (events: CalendarEventSummary[]) => {
      if (requestVersion !== this.overviewRequestVersion) {
        return;
      }
      if (mode === 'week') {
        this.weekOverviewDays.set(this.buildWeekOverview(range.start, selectedIso, events));
        this.monthOverviewWeeks.set([]);
      } else {
        this.monthOverviewWeeks.set(
          this.buildMonthOverview(range.start, range.end, selectedIso, selectedDate, events),
        );
        this.weekOverviewDays.set([]);
      }
      this.calendarOverviewError.set(null);
    };

    const cached = this.deps.calendarService.getCachedEventsForRange(startIso, endIso);
    if (cached) {
      applyOverview(cached);
      this.calendarOverviewLoading.set(false);
      void this.deps.calendarService
        .listEventsForRange(startIso, endIso, { forceRefresh: true })
        .then((events) => {
          applyOverview(events);
        })
        .catch((error) => {
          console.warn('Unable to refresh calendar overview', error);
        });
      return;
    }

    this.calendarOverviewLoading.set(true);
    this.calendarOverviewError.set(null);
    try {
      const events = await this.deps.calendarService.listEventsForRange(startIso, endIso);
      applyOverview(events);
    } catch (error) {
      console.warn('Unable to load calendar overview', error);
      if (requestVersion !== this.overviewRequestVersion) {
        return;
      }
      this.calendarOverviewError.set('Unable to load weekly/monthly overview right now.');
      this.weekOverviewDays.set([]);
      this.monthOverviewWeeks.set([]);
    } finally {
      if (requestVersion === this.overviewRequestVersion) {
        this.calendarOverviewLoading.set(false);
      }
    }
  }

  private buildWeekOverview(
    weekStart: Date,
    selectedIso: string,
    events: CalendarEventSummary[],
  ): CalendarOverviewDay[] {
    const eventsByDate = this.eventsByDate(events);
    return Array.from({ length: 7 }, (_, offset) => {
      const day = this.addDays(weekStart, offset);
      const dayIso = this.toIsoDate(day);
      return this.buildOverviewDay(day, dayIso, selectedIso, eventsByDate, true);
    });
  }

  private buildMonthOverview(
    rangeStart: Date,
    rangeEnd: Date,
    selectedIso: string,
    selectedDate: Date,
    events: CalendarEventSummary[],
  ): CalendarOverviewDay[][] {
    const eventsByDate = this.eventsByDate(events);
    const weeks: CalendarOverviewDay[][] = [];
    const current = new Date(rangeStart.getTime());
    while (current <= rangeEnd) {
      const row: CalendarOverviewDay[] = [];
      for (let i = 0; i < 7; i += 1) {
        const day = new Date(current.getTime());
        const dayIso = this.toIsoDate(day);
        const inCurrentMonth = day.getMonth() === selectedDate.getMonth();
        row.push(this.buildOverviewDay(day, dayIso, selectedIso, eventsByDate, inCurrentMonth));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(row);
    }
    return weeks;
  }

  private buildOverviewDay(
    date: Date,
    iso: string,
    selectedIso: string,
    eventsByDate: Map<string, CalendarEventSummary[]>,
    inCurrentMonth: boolean,
  ): CalendarOverviewDay {
    const events = eventsByDate.get(iso) ?? [];
    const firstSummary = events[0]?.summary?.trim() ?? null;
    const previewText =
      events.length > 1 && firstSummary ? `${firstSummary} +${events.length - 1}` : firstSummary;
    return {
      date: iso,
      dayLabel: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumberLabel: date.toLocaleDateString(undefined, { day: 'numeric' }),
      inCurrentMonth,
      isToday: iso === this.todayIsoDate(),
      isSelected: iso === selectedIso,
      eventCount: events.length,
      busyPercent: this.busyPercentForDay(events),
      previewText,
    };
  }

  private eventsByDate(events: CalendarEventSummary[]): Map<string, CalendarEventSummary[]> {
    const grouped = new Map<string, CalendarEventSummary[]>();
    for (const event of events) {
      const key = this.isoToDateString(event.start);
      const list = grouped.get(key) ?? [];
      list.push(event);
      grouped.set(key, list);
    }
    return grouped;
  }

  private busyPercentForDay(events: CalendarEventSummary[]): number {
    if (!events.length) {
      return 0;
    }
    const startBoundary = TIMELINE_START_HOUR * 60;
    const endBoundary = TIMELINE_END_HOUR * 60;
    const totalMinutes = this.timelineTotalMinutes();
    let busyMinutes = 0;
    for (const event of events) {
      const start = this.isoToLocalMinutes(event.start) + TIMELINE_SELECTION_OFFSET;
      const end = this.isoToLocalMinutes(event.end) + TIMELINE_SELECTION_OFFSET;
      const visibleStart = Math.max(startBoundary, start);
      const visibleEnd = Math.min(endBoundary, end);
      if (visibleEnd > visibleStart) {
        busyMinutes += visibleEnd - visibleStart;
      }
    }
    return Math.min(100, (busyMinutes / totalMinutes) * 100);
  }

  private selectedDateOrToday(): Date {
    const value = this.deps.calendarGroup.controls.date.value;
    if (!value) {
      return new Date(`${this.todayIsoDate()}T00:00:00`);
    }
    return new Date(`${value}T00:00:00`);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addDays(date: Date, offset: number): Date {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + offset);
    return result;
  }

  private startOfWeek(date: Date): Date {
    const copy = new Date(date.getTime());
    const day = copy.getDay();
    const diff = (day + 6) % 7;
    copy.setDate(copy.getDate() - diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private endOfWeek(date: Date): Date {
    const start = this.startOfWeek(date);
    start.setDate(start.getDate() + 6);
    return start;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  private async prefetchCalendarWindow(date: string): Promise<void> {
    try {
      await this.deps.calendarService.prefetchAroundDate(date, 1);
    } catch (error) {
      console.warn('Unable to prefetch calendar window', error);
    }
  }

  todayIsoDate(): string {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }

  combineDateTime(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }

  isoToDateString(value: string): string {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isoToTimeString(value: string): string {
    const date = new Date(value);
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  private isoToLocalMinutes(value: string): number {
    const date = new Date(value);
    return date.getHours() * 60 + date.getMinutes();
  }

  minutesFromPointer(event: PointerEvent): number {
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

  timelineTotalMinutes(): number {
    return (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  }

  clampTimelineMinutes(minutes: number): number {
    const start = TIMELINE_START_HOUR * 60;
    const end = TIMELINE_END_HOUR * 60;
    return Math.min(end, Math.max(start, minutes));
  }

  minutesToTimeString(totalMinutes: number): string {
    const snapped = this.snapToIncrement(totalMinutes);
    const hrs = Math.floor(snapped / 60);
    const mins = snapped % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  timeStringToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  }

  private snapToIncrement(minutes: number): number {
    return Math.round(minutes / TIMELINE_INCREMENT) * TIMELINE_INCREMENT;
  }

  private toTimelineMinutes(time: string): number {
    const minutes = this.snapToIncrement(this.timeStringToMinutes(time));
    return this.clampTimelineMinutes(minutes + TIMELINE_SELECTION_OFFSET);
  }

  applySelectionOffset(startMinutes: number, endMinutes: number): { start: number; end: number } {
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

  private readonly eventTimeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
