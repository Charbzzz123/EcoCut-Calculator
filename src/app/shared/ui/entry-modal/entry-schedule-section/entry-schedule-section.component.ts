import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ElementRef } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { CalendarEventSummary } from '@shared/domain/entry/calendar-events.service.js';
import type {
  CalendarOverviewDay,
  CalendarSlot,
  CalendarTimelineViewMode,
  TimelineEventBlock,
} from '../entry-modal-schedule.controller.js';
import { EntryTimelineComponent } from '../entry-timeline/entry-timeline.component.js';
import type { TimelineSelectionStyle } from '../entry-timeline/entry-timeline.component.js';

export interface EntryScheduleSectionViewModel {
  calendarGroup: FormGroup;
  calendarTimeZone: string;
  calendarViewMode: CalendarTimelineViewMode;
  calendarRangeLabel: string;
  weekOverviewDays: CalendarOverviewDay[];
  monthOverviewWeeks: CalendarOverviewDay[][];
  calendarOverviewLoading: boolean;
  calendarOverviewError: string | null;
  timelineHours: number[];
  timelineEvents: TimelineEventBlock[];
  timelineSelectionStyle: TimelineSelectionStyle | null;
  timelineNowLine: { topPercent: number } | null;
  timelineHelperText: string;
  selectionConflict: boolean;
  conflictSummary: string | null;
  conflictConfirmed: boolean;
  calendarSlots: CalendarSlot[];
  selectedSlotId: string | null;
  calendarEventsLoading: boolean;
  calendarEventsError: string | null;
  calendarEvents: CalendarEventSummary[];
  editingCalendarEvent: CalendarEventSummary | null;
  editingCalendarForm: FormGroup<{
    summary: FormControl<string>;
    notes: FormControl<string>;
  }>;
  editingUpdateDisabled: boolean;
}

export interface EntryScheduleSectionHandlers {
  setCalendarViewMode(mode: CalendarTimelineViewMode): void;
  shiftCalendarWindow(direction: -1 | 1): void;
  jumpCalendarToToday(): void;
  selectCalendarOverviewDate(date: string): void;
  handleCalendarDateChange(): void;
  handleManualTimeChange(): void;
  handleTimelinePointerDown(event: PointerEvent): void;
  handleTimelineGridReady(ref: ElementRef<HTMLElement>): void;
  confirmTimelineConflict(): void;
  selectCalendarSlot(slotId: string): void;
  editCalendarEvent(event: CalendarEventSummary): void;
  deleteCalendarEvent(event: CalendarEventSummary): void;
  updateCalendarEvent(): void;
  cancelCalendarEdit(): void;
  formatEventTimeRange(event: CalendarEventSummary): string;
}

@Component({
  selector: 'app-entry-schedule-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EntryTimelineComponent],
  templateUrl: './entry-schedule-section.component.html',
  styleUrl: './entry-schedule-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryScheduleSectionComponent {
  @Input({ required: true }) viewModel!: EntryScheduleSectionViewModel;
  @Input({ required: true }) handlers!: EntryScheduleSectionHandlers;
}
