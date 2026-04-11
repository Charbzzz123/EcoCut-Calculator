import { FormControl, FormGroup } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventsService, CalendarEventSummary } from '@shared/domain/entry/calendar-events.service.js';
import type { EntryModalValidationService } from './entry-modal-validation.service.js';
import type { EntryVariant } from '@shared/domain/entry/entry-modal.models.js';
import { EntryModalScheduleController } from './entry-modal-schedule.controller.js';

const iso = (date: string, time: string) => `${date}T${time}:00`;

const buildController = (initialVariant: EntryVariant = 'customer') => {
  const calendarGroup = new FormGroup({
    date: new FormControl('2026-03-05', { nonNullable: true }),
    startTime: new FormControl('08:00', { nonNullable: true }),
    endTime: new FormControl('10:00', { nonNullable: true }),
  });
  const editingCalendarForm = new FormGroup({
    summary: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  const calendarService = {
    listEventsForDate: vi.fn().mockResolvedValue([] as CalendarEventSummary[]),
    listEventsForRange: vi.fn().mockResolvedValue([] as CalendarEventSummary[]),
    getCachedEventsForRange: vi.fn().mockReturnValue(null),
    prefetchAroundDate: vi.fn().mockResolvedValue(undefined),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    updateEvent: vi.fn().mockResolvedValue({
      id: 'evt-edit',
      summary: 'Updated',
      start: iso('2026-03-05', '07:00'),
      end: iso('2026-03-05', '08:00'),
    }),
  } as unknown as CalendarEventsService;

  const validationService = {
    validateCalendarRange: vi.fn().mockReturnValue(true),
  } as unknown as EntryModalValidationService;

  const controllerRef: { current: EntryModalScheduleController | null } = { current: null };
  const requestRefresh = vi.fn((date: string) =>
    controllerRef.current
      ? controllerRef.current.refreshCalendarEventsForDate(date)
      : Promise.resolve(),
  );
  const requestEnsureCalendarDefaults = vi.fn();

  const controller = new EntryModalScheduleController({
    calendarGroup,
    editingCalendarForm,
    calendarService,
    validationService,
    initialVariant,
    requestRefresh,
    requestEnsureCalendarDefaults,
  });
  controllerRef.current = controller;

  return {
    controller,
    calendarGroup,
    editingCalendarForm,
    calendarService,
    validationService,
    requestRefresh,
    requestEnsureCalendarDefaults,
  };
};

describe('EntryModalScheduleController', () => {
  let deps: ReturnType<typeof buildController>;

  beforeEach(() => {
    deps = buildController();
  });

  it('switches variants by invoking ensure defaults and clearing previews', () => {
    const harness = buildController('warm-lead');
    harness.controller.setVariant('customer', { allowSideEffects: true });
    expect(harness.requestEnsureCalendarDefaults).toHaveBeenCalledTimes(1);

    harness.controller.rebuildCalendarSlots('2026-03-05', []);
    expect(harness.controller.calendarSlotsSignal()()).not.toHaveLength(0);

    harness.controller.setVariant('warm-lead', { allowSideEffects: true });
    expect(harness.controller.calendarSlotsSignal()()).toHaveLength(0);
  });

  it('handles calendar date changes for customers', () => {
    deps.calendarGroup.controls.date.setValue('2026-03-06');
    deps.calendarGroup.controls.startTime.setValue('09:00');
    deps.calendarGroup.controls.endTime.setValue('11:00');

    deps.controller.handleCalendarDateChange();

    expect(deps.calendarGroup.controls.startTime.value).toBe('');
    expect(deps.calendarGroup.controls.endTime.value).toBe('');
    expect(deps.requestRefresh).toHaveBeenCalledWith('2026-03-06');
    expect(deps.controller.timelineSelectionSignal()()).toBeNull();
    expect(deps.controller.selectionConflictSignal()()).toBe(false);
  });

  it('loads weekly/monthly overview and navigates date windows', async () => {
    deps.calendarService.listEventsForRange = vi
      .fn()
      .mockResolvedValue([
        {
          id: 'evt-overview',
          summary: 'Client visit',
          start: iso('2026-03-06', '10:00'),
          end: iso('2026-03-06', '12:00'),
        },
      ]) as CalendarEventsService['listEventsForRange'];

    deps.controller.setCalendarViewMode('week');
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.calendarService.listEventsForRange).toHaveBeenCalled();
    expect(deps.controller.buildViewModel().weekOverviewDays).toHaveLength(7);

    deps.controller.shiftCalendarWindow(1);
    expect(deps.requestRefresh).toHaveBeenCalled();

    deps.controller.setCalendarViewMode('month');
    await Promise.resolve();
    await Promise.resolve();
    expect(deps.controller.buildViewModel().monthOverviewWeeks.length).toBeGreaterThan(3);

    deps.controller.jumpCalendarToToday();
    expect(deps.calendarGroup.controls.date.value).toBe(deps.controller.todayIsoDate());
  });

  it('uses cached overview data immediately and revalidates in background', async () => {
    deps.calendarService.getCachedEventsForRange = vi
      .fn()
      .mockReturnValue([
        {
          id: 'evt-cached',
          summary: 'Cached visit',
          start: iso('2026-03-05', '09:00'),
          end: iso('2026-03-05', '10:00'),
        },
      ]) as CalendarEventsService['getCachedEventsForRange'];
    deps.calendarService.listEventsForRange = vi
      .fn()
      .mockResolvedValue([
        {
          id: 'evt-fresh',
          summary: 'Fresh visit',
          start: iso('2026-03-05', '10:00'),
          end: iso('2026-03-05', '11:00'),
        },
      ]) as CalendarEventsService['listEventsForRange'];

    deps.controller.setCalendarViewMode('week');
    await Promise.resolve();
    await Promise.resolve();

    const viewModel = deps.controller.buildViewModel();
    expect(viewModel.calendarOverviewLoading).toBe(false);
    expect(viewModel.weekOverviewDays).toHaveLength(7);
    expect(deps.calendarService.listEventsForRange).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { forceRefresh: true },
    );
  });

  it('clears previews when the customer removes the calendar date', () => {
    deps.controller.rebuildCalendarSlots('2026-03-05', []);
    deps.controller.applyTimelineSelectionMinutes(480, 540);
    deps.calendarGroup.controls.date.setValue('');

    deps.controller.handleCalendarDateChange();

    expect(deps.requestRefresh).not.toHaveBeenCalled();
    expect(deps.controller.calendarSlotsSignal()()).toHaveLength(0);
    expect(deps.controller.timelineSelectionSignal()()).toBeNull();
  });

  it('selects slots and updates form controls', () => {
    deps.controller.rebuildCalendarSlots('2026-03-05', []);
    deps.controller.selectCalendarSlot('slot-12');

    expect(deps.calendarGroup.controls.startTime.value).toBe('12:00');
    expect(deps.calendarGroup.controls.endTime.value).toBe('14:00');
    expect(deps.controller.selectedSlotIdSignal()()).toBe('slot-12');
    expect(deps.controller.timelineSelectionSignal()()).not.toBeNull();
  });

  it('selects overview dates and returns to day mode', () => {
    deps.controller.setCalendarViewMode('week');
    deps.controller.selectCalendarOverviewDate('2026-03-11');

    expect(deps.calendarGroup.controls.date.value).toBe('2026-03-11');
    expect(deps.controller.buildViewModel().calendarViewMode).toBe('day');
  });

  it('enters editing mode for an existing calendar event', () => {
    const event: CalendarEventSummary = {
      id: 'evt-edit',
      summary: 'Existing job',
      start: iso('2026-03-05', '09:00'),
      end: iso('2026-03-05', '10:30'),
      location: 'Front yard',
    };

    deps.controller.editCalendarEvent(event);

    expect(deps.editingCalendarForm.controls.summary.value).toBe('Existing job');
    expect(deps.calendarGroup.controls.startTime.value).toBe('09:00');
    expect(deps.controller.editingCalendarEventSignal()()).toEqual(event);
  });

  it('deletes events and refreshes availability when a date is selected', async () => {
    const event: CalendarEventSummary = {
      id: 'evt-del',
      summary: 'Delete me',
      start: iso('2026-03-05', '08:00'),
      end: iso('2026-03-05', '09:00'),
    };

    deps.controller.editCalendarEvent(event);
    deps.calendarGroup.controls.date.setValue('2026-03-05');
    await deps.controller.deleteCalendarEvent(event);

    expect(deps.calendarService.deleteEvent).toHaveBeenCalledWith('evt-del');
    expect(deps.requestRefresh).toHaveBeenCalledWith('2026-03-05');
    expect(deps.controller.editingCalendarEventSignal()()).toBeNull();
  });

  it('falls back to local deletion when no calendar date exists', async () => {
    const event: CalendarEventSummary = {
      id: 'evt-local',
      summary: 'Local remove',
      start: iso('2026-03-05', '10:00'),
      end: iso('2026-03-05', '11:00'),
    };

    // Seed calendar events directly then delete without a date set.
    (deps.controller as unknown as { calendarEvents: { set(value: CalendarEventSummary[]): void } }).calendarEvents.set([
      event,
    ]);
    deps.calendarGroup.controls.date.setValue('');
    await deps.controller.deleteCalendarEvent(event);

    expect(deps.requestRefresh).not.toHaveBeenCalled();
    expect(deps.controller.calendarEventsSignal()()).toHaveLength(0);
  });

  it('updates existing events when validation passes', async () => {
    const event: CalendarEventSummary = {
      id: 'evt-update',
      summary: 'Initial',
      start: iso('2026-03-05', '13:00'),
      end: iso('2026-03-05', '14:00'),
    };

    deps.controller.editCalendarEvent(event);
    deps.editingCalendarForm.controls.summary.setValue('Final summary');
    deps.calendarGroup.patchValue({
      date: '2026-03-05',
      startTime: '13:00',
      endTime: '15:00',
    });

    await deps.controller.updateCalendarEvent();

    expect(deps.validationService.validateCalendarRange).toHaveBeenCalled();
    const expectedStart = deps.controller.combineDateTime('2026-03-05', '13:00');
    const expectedEnd = deps.controller.combineDateTime('2026-03-05', '15:00');
    expect(deps.calendarService.updateEvent).toHaveBeenCalledWith(
      'evt-update',
      expect.objectContaining({
        summary: 'Final summary',
        start: expectedStart,
        end: expectedEnd,
      }),
    );
    expect(deps.requestRefresh).toHaveBeenCalledWith('2026-03-05');
  });

  it('blocks updates when conflicts are not confirmed', async () => {
    deps.controller.editCalendarEvent({
      id: 'evt-block',
      summary: 'Blocked',
      start: iso('2026-03-05', '07:00'),
      end: iso('2026-03-05', '08:00'),
    });
    (deps.controller as unknown as { selectionConflict: { set(value: boolean): void } }).selectionConflict.set(true);
    await deps.controller.updateCalendarEvent();
    expect(deps.calendarService.updateEvent).not.toHaveBeenCalled();
  });

  it('syncs timeline selection and clears slot state when manually editing times', () => {
    (deps.controller as unknown as { selectedSlotId: { set(value: string | null): void } }).selectedSlotId.set('slot-10');
    (deps.controller as unknown as { selectionConflict: { set(value: boolean): void } }).selectionConflict.set(true);
    deps.calendarGroup.controls.startTime.setValue('15:15');
    deps.calendarGroup.controls.endTime.setValue('15:45');

    deps.controller.handleManualTimeChange();

    expect(deps.controller.selectedSlotIdSignal()()).toBeNull();
    expect(deps.controller.selectionConflictSignal()()).toBe(false);
    expect(deps.controller.timelineSelectionSignal()()).toEqual({
      startMinutes: 930,
      endMinutes: 960,
    });
  });

  it('clears the timeline selection when manual times are incomplete', () => {
    deps.controller.applyTimelineSelectionMinutes(540, 600);
    deps.calendarGroup.controls.startTime.setValue('14:00');
    deps.calendarGroup.controls.endTime.setValue('');

    deps.controller.handleManualTimeChange();

    expect(deps.controller.timelineSelectionSignal()()).toBeNull();
  });

  it('refreshes events for a date and preserves the editing reference', async () => {
    const refreshed: CalendarEventSummary[] = [
      {
        id: 'evt-keep',
        summary: 'Refreshed',
        start: iso('2026-03-05', '08:00'),
        end: iso('2026-03-05', '09:00'),
        location: 'Yard',
      },
    ];
    deps.calendarService.listEventsForDate = vi.fn().mockResolvedValue(refreshed) as CalendarEventsService['listEventsForDate'];
    deps.controller.editCalendarEvent({
      id: 'evt-keep',
      summary: 'Refreshed',
      start: iso('2026-03-05', '08:00'),
      end: iso('2026-03-05', '09:00'),
    });

    await deps.controller.refreshCalendarEventsForDate('2026-03-05');

    expect(deps.calendarService.listEventsForDate).toHaveBeenCalledWith('2026-03-05');
    expect(deps.controller.calendarEventsSignal()()).toHaveLength(1);
    expect(deps.controller.editingCalendarEventSignal()()).not.toBeNull();
    expect(deps.controller.calendarSlotsSignal()()).toHaveLength(6);
    expect(deps.controller.timelineEventsSignal()()).toHaveLength(1);
  });

  it('formats event time ranges for display', () => {
    const range = deps.controller.formatEventTimeRange({
      id: 'evt-format',
      summary: '',
      start: iso('2026-03-05', '06:00'),
      end: iso('2026-03-05', '07:15'),
    });
    expect(range).toContain('6');
    expect(range).toContain('7');
  });

  it('fills editing form defaults when the event has empty summary/description', () => {
    deps.controller.editCalendarEvent({
      id: 'evt-empty',
      summary: undefined as unknown as string,
      description: undefined,
      start: iso('2026-03-05', '11:00'),
      end: iso('2026-03-05', '12:00'),
    });
    expect(deps.editingCalendarForm.controls.summary.value).toBe('');
    expect(deps.editingCalendarForm.controls.notes.value).toBe('');
  });

  it('exposes drag helpers and pointer callbacks', () => {
    deps.controller.setTimelineDragStartMinutes(480);
    expect(deps.controller.getTimelineDragStartMinutes()).toBe(480);

    const grid = {
      nativeElement: {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      },
    };
    (deps.controller as unknown as { timelineGrid: typeof grid }).timelineGrid = grid;

    const pointerEvent = {
      clientY: 50,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent;

    (deps.controller as unknown as { onTimelinePointerMove: (event: PointerEvent) => void }).onTimelinePointerMove(pointerEvent);
    expect(pointerEvent.preventDefault).toHaveBeenCalled();

    (deps.controller as unknown as { onTimelinePointerUp: () => void }).onTimelinePointerUp();
    expect(deps.calendarGroup.controls.startTime.value).not.toBeNull();

    const ticker = setInterval(() => undefined, 1);
    deps.controller.setCurrentTimeTicker(ticker);
    expect(deps.controller.getCurrentTimeTicker()).toBe(ticker);
    clearInterval(ticker);
  });
});
