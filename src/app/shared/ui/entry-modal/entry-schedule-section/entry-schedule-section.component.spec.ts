import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { vi } from 'vitest';
import {
  EntryScheduleSectionComponent,
  EntryScheduleSectionHandlers,
  EntryScheduleSectionViewModel,
} from './entry-schedule-section.component.js';
import type { CalendarEventSummary } from '@shared/domain/entry/calendar-events.service.js';
import type {
  CalendarOverviewDay,
  CalendarSlot,
  TimelineEventBlock,
} from '../entry-modal-schedule.controller.js';

describe('EntryScheduleSectionComponent', () => {
  let fixture: ComponentFixture<EntryScheduleSectionComponent>;
  let handlers: EntryScheduleSectionHandlers;
  const fb = new FormBuilder();

  const calendarGroup = fb.group({
    date: ['2026-03-05'],
    startTime: ['08:00'],
    endTime: ['10:00'],
  });

  const weekDay: CalendarOverviewDay = {
    date: '2026-03-05',
    dayLabel: 'Thu',
    dayNumberLabel: '5',
    inCurrentMonth: true,
    isToday: false,
    isSelected: true,
    eventCount: 2,
    busyPercent: 75,
    previewText: 'Trim +1',
  };

  const baseViewModel: EntryScheduleSectionViewModel = {
    calendarGroup,
    calendarTimeZone: 'America/Toronto',
    calendarViewMode: 'day',
    calendarRangeLabel: 'Thu, Mar 5, 2026',
    weekOverviewDays: [weekDay],
    monthOverviewWeeks: [[weekDay]],
    calendarOverviewLoading: false,
    calendarOverviewError: null,
    timelineHours: [7, 8, 9],
    timelineEvents: [] as TimelineEventBlock[],
    timelineSelectionStyle: null,
    timelineNowLine: null,
    timelineHelperText: 'helper',
    selectionConflict: true,
    conflictSummary: 'Overlap with Crew A',
    conflictConfirmed: false,
    calendarSlots: [
      { id: 'slot1', startTime: '08:00', endTime: '10:00', label: '8 - 10', status: 'available' },
      {
        id: 'slot2',
        startTime: '10:00',
        endTime: '12:00',
        label: '10 - 12',
        status: 'booked',
        conflictSummary: 'Crew',
      },
    ] as CalendarSlot[],
    selectedSlotId: null,
    calendarEventsLoading: false,
    calendarEventsError: null,
    calendarEvents: [
      { id: 'evt-1', summary: 'Trim', start: '', end: '', location: 'Yard' } as CalendarEventSummary,
    ],
    editingCalendarEvent: { id: 'evt-1', summary: 'Trim', start: '', end: '' } as CalendarEventSummary,
    editingCalendarForm: new FormGroup({
      summary: new FormControl('', { nonNullable: true }),
      notes: new FormControl('', { nonNullable: true }),
    }),
    editingUpdateDisabled: false,
  };

  const buildViewModel = (): EntryScheduleSectionViewModel => ({
    ...baseViewModel,
    calendarSlots: baseViewModel.calendarSlots.map((slot) => ({ ...slot })),
    calendarEvents: baseViewModel.calendarEvents.map((event) => ({ ...event })),
    weekOverviewDays: baseViewModel.weekOverviewDays.map((day) => ({ ...day })),
    monthOverviewWeeks: baseViewModel.monthOverviewWeeks.map((week) =>
      week.map((day) => ({ ...day })),
    ),
    editingCalendarForm: new FormGroup({
      summary: new FormControl('', { nonNullable: true }),
      notes: new FormControl('', { nonNullable: true }),
    }),
  });

  beforeEach(async () => {
    handlers = {
      setCalendarViewMode: vi.fn(),
      shiftCalendarWindow: vi.fn(),
      jumpCalendarToToday: vi.fn(),
      selectCalendarOverviewDate: vi.fn(),
      handleCalendarDateChange: vi.fn(),
      handleManualTimeChange: vi.fn(),
      handleTimelinePointerDown: vi.fn(),
      handleTimelineGridReady: vi.fn(),
      confirmTimelineConflict: vi.fn(),
      selectCalendarSlot: vi.fn(),
      editCalendarEvent: vi.fn(),
      deleteCalendarEvent: vi.fn(),
      updateCalendarEvent: vi.fn(),
      cancelCalendarEdit: vi.fn(),
      formatEventTimeRange: vi.fn().mockReturnValue('8:00 AM - 10:00 AM'),
    };

    await TestBed.configureTestingModule({
      imports: [EntryScheduleSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryScheduleSectionComponent);
    fixture.componentRef.setInput('viewModel', buildViewModel());
    fixture.componentRef.setInput('handlers', handlers);
    fixture.detectChanges();
  });

  it('wires controls and event handlers for day mode', () => {
    const dateInput = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
    dateInput.dispatchEvent(new Event('change'));
    expect(handlers.handleCalendarDateChange).toHaveBeenCalled();

    const startInput = fixture.nativeElement.querySelector('input[type="time"]') as HTMLInputElement;
    startInput.dispatchEvent(new Event('input'));
    expect(handlers.handleManualTimeChange).toHaveBeenCalled();

    const weekToggle = fixture.nativeElement.querySelectorAll('.calendar-mode-toggle button')[1] as HTMLButtonElement;
    weekToggle.click();
    expect(handlers.setCalendarViewMode).toHaveBeenCalledWith('week');

    const prevButton = fixture.nativeElement.querySelector('.calendar-range-nav button') as HTMLButtonElement;
    prevButton.click();
    expect(handlers.shiftCalendarWindow).toHaveBeenCalledWith(-1);

    const slotButton = fixture.nativeElement.querySelector('.slot-chip') as HTMLButtonElement;
    slotButton.click();
    expect(handlers.selectCalendarSlot).toHaveBeenCalledWith('slot1');

    const conflictButton = fixture.nativeElement.querySelector('.conflict-banner button') as HTMLButtonElement;
    conflictButton.click();
    expect(handlers.confirmTimelineConflict).toHaveBeenCalled();

    const editButtons = fixture.nativeElement.querySelectorAll('.event-actions button');
    (editButtons[0] as HTMLButtonElement).click();
    expect(handlers.editCalendarEvent).toHaveBeenCalled();
    (editButtons[1] as HTMLButtonElement).click();
    expect(handlers.deleteCalendarEvent).toHaveBeenCalled();

    const updateButton = fixture.nativeElement.querySelector('.editing-banner__actions button') as HTMLButtonElement;
    updateButton.click();
    expect(handlers.updateCalendarEvent).toHaveBeenCalled();
  });

  it('renders weekly and monthly overview states', () => {
    const updateViewModel = (vm: EntryScheduleSectionViewModel) => {
      fixture.componentRef.setInput('viewModel', vm);
      fixture.detectChanges();
    };

    updateViewModel({
      ...buildViewModel(),
      calendarViewMode: 'week',
    });

    const weekDayButton = fixture.nativeElement.querySelector('.overview-day-card') as HTMLButtonElement;
    weekDayButton.click();
    expect(handlers.selectCalendarOverviewDate).toHaveBeenCalledWith('2026-03-05');

    updateViewModel({
      ...buildViewModel(),
      calendarViewMode: 'month',
      calendarEvents: [],
    });
    expect(fixture.nativeElement.textContent).toContain('Mon');

    updateViewModel({
      ...buildViewModel(),
      calendarViewMode: 'week',
      calendarOverviewLoading: true,
    });
    expect(fixture.nativeElement.textContent).toContain('Loading calendar overview...');

    updateViewModel({
      ...buildViewModel(),
      calendarViewMode: 'week',
      calendarOverviewError: 'Overview failed',
    });
    expect(fixture.nativeElement.textContent).toContain('Overview failed');
  });

  it('renders fallback states for slots and events', () => {
    fixture.componentRef.setInput('viewModel', {
      ...buildViewModel(),
      calendarSlots: [],
      calendarEventsLoading: true,
      selectionConflict: false,
      editingCalendarEvent: null,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pick a date to view suggested slots.');

    fixture.componentRef.setInput('viewModel', {
      ...buildViewModel(),
      calendarEventsLoading: false,
      calendarEventsError: 'Failed',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed');

    fixture.componentRef.setInput('viewModel', {
      ...buildViewModel(),
      calendarEventsError: null,
      calendarEvents: [],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No existing events for this day.');
  });
});
