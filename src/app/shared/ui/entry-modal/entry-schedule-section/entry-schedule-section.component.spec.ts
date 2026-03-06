import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { vi } from 'vitest';
import { EntryScheduleSectionComponent, EntryScheduleSectionHandlers, EntryScheduleSectionViewModel } from './entry-schedule-section.component.js';
import type { CalendarEventSummary } from '@shared/domain/entry/calendar-events.service.js';
import type { CalendarSlot, TimelineEventBlock } from '../entry-modal-schedule.controller.js';

describe('EntryScheduleSectionComponent', () => {
  let fixture: ComponentFixture<EntryScheduleSectionComponent>;
  let handlers: EntryScheduleSectionHandlers;
  const fb = new FormBuilder();

  const calendarGroup = fb.group({
    date: ['2026-03-05'],
    startTime: ['08:00'],
    endTime: ['10:00'],
  });

  const baseViewModel: EntryScheduleSectionViewModel = {
    calendarGroup,
    calendarTimeZone: 'America/Toronto',
    timelineHours: [7, 8, 9],
    timelineEvents: [] as TimelineEventBlock[],
    timelineSelectionStyle: null,
    timelineNowLine: null,
    timelineHelperText: 'helper',
    selectionConflict: true,
    conflictSummary: 'Overlap with Crew A',
    conflictConfirmed: false,
    calendarSlots: [
      { id: 'slot1', startTime: '08:00', endTime: '10:00', label: '8 – 10', status: 'available' },
      { id: 'slot2', startTime: '10:00', endTime: '12:00', label: '10 – 12', status: 'booked', conflictSummary: 'Crew' },
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
    editingCalendarForm: new FormGroup({
      summary: new FormControl('', { nonNullable: true }),
      notes: new FormControl('', { nonNullable: true }),
    }),
  });

  beforeEach(async () => {
    handlers = {
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
      formatEventTimeRange: vi.fn().mockReturnValue('8:00 AM – 10:00 AM'),
    };

    await TestBed.configureTestingModule({
      imports: [EntryScheduleSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryScheduleSectionComponent);
    fixture.componentRef.setInput('viewModel', buildViewModel());
    fixture.componentRef.setInput('handlers', handlers);
    fixture.detectChanges();
  });

  it('wires inputs and triggers handlers for interactions', () => {
    const dateInput = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
    dateInput.dispatchEvent(new Event('change'));
    expect(handlers.handleCalendarDateChange).toHaveBeenCalled();

    const startInput = fixture.nativeElement.querySelector('input[type="time"]') as HTMLInputElement;
    startInput.dispatchEvent(new Event('input'));
    expect(handlers.handleManualTimeChange).toHaveBeenCalled();

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

  it('renders alternate states for slots and events', () => {
    const updateViewModel = (vm: EntryScheduleSectionViewModel) => {
      fixture.componentRef.setInput('viewModel', vm);
      fixture.detectChanges();
    };

    updateViewModel({
      ...buildViewModel(),
      calendarSlots: [],
      calendarEventsLoading: true,
      selectionConflict: false,
      editingCalendarEvent: null,
    });
    expect(fixture.nativeElement.textContent).toContain('Pick a date to view suggested slots.');

    updateViewModel({
      ...fixture.componentInstance.viewModel,
      calendarEventsLoading: false,
      calendarEventsError: 'Failed',
    });
    expect(fixture.nativeElement.textContent).toContain('Failed');

    updateViewModel({
      ...fixture.componentInstance.viewModel,
      calendarEventsError: null,
      calendarEvents: [],
    });
    expect(fixture.nativeElement.textContent).toContain('No existing events for this day.');
  });
});
