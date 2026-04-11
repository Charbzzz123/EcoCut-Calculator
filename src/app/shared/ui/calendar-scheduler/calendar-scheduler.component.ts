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
} from '../entry-modal/entry-modal-schedule.controller.js';
import { EntryTimelineComponent } from '../entry-modal/entry-timeline/entry-timeline.component.js';
import type { TimelineSelectionStyle } from '../entry-modal/entry-timeline/entry-timeline.component.js';

export interface CalendarSchedulerViewModel {
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

export interface CalendarSchedulerHandlers {
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
  selector: 'app-calendar-scheduler',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EntryTimelineComponent],
  templateUrl: './calendar-scheduler.component.html',
  styleUrl: './calendar-scheduler.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarSchedulerComponent {
  @Input({ required: true }) viewModel!: CalendarSchedulerViewModel;
  @Input({ required: true }) handlers!: CalendarSchedulerHandlers;
}
