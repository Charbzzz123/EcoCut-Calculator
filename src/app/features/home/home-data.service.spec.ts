import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HomeDataService } from './home-data.service.js';
import type { EntryModalPayload } from '@shared/domain/entry/entry-modal.models.js';
import { HEDGE_IDS, createEmptyHedgeConfigs } from '@shared/domain/entry/entry-modal.models.js';
import { CalendarEventsService } from '@shared/domain/entry/calendar-events.service.js';
import { EntryRepositoryService } from '@shared/domain/entry/entry-repository.service.js';

class CalendarEventsServiceStub {
  createEvent = vi.fn().mockResolvedValue({
    id: 'evt-created',
    summary: 'Created Job',
    start: '2026-03-12T14:00:00Z',
    end: '2026-03-12T15:00:00Z',
  });
  updateEvent = vi.fn().mockResolvedValue({
    id: 'evt-123',
    summary: 'Updated Job',
    start: '2026-03-12T14:00:00Z',
    end: '2026-03-12T15:30:00Z',
  });
  listEventsForDate = vi.fn();
}

class EntryRepositoryServiceStub {
  create = vi.fn().mockResolvedValue({
    id: 'entry-1',
    createdAt: '2026-03-04T12:00:00Z',
  });
}

describe('HomeDataService', () => {
  let service: HomeDataService;
  let calendar: CalendarEventsServiceStub;
  let repository: EntryRepositoryServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HomeDataService,
        { provide: CalendarEventsService, useClass: CalendarEventsServiceStub },
        { provide: EntryRepositoryService, useClass: EntryRepositoryServiceStub },
      ],
    });
    service = TestBed.inject(HomeDataService);
    calendar = TestBed.inject(CalendarEventsService) as unknown as CalendarEventsServiceStub;
    repository = TestBed.inject(EntryRepositoryService) as unknown as EntryRepositoryServiceStub;
  });

  it('exposes hero metric snapshots', () => {
    const metrics = service.getHeroMetrics();
    expect(metrics).toHaveLength(4);
    expect(metrics.map((metric) => metric.id)).toContain('jobs-today');
  });

  it('lists all quick actions and commands', () => {
    const quickActions = service.getQuickActions();
    expect(quickActions).toHaveLength(8);
    const commands = quickActions.map((action) => action.command);
    expect(commands).toContain('view-finances');
    expect(commands).toContain('manage-employees');
    expect(commands).not.toContain('new-job');
    expect(commands).not.toContain('undo-job');
    expect(commands).not.toContain('view-employee-directory');
    expect(commands).not.toContain('view-upcoming-pay');
  });

  it('summarizes weekly hours for every teammate', () => {
    const summaries = service.getWeeklyHourSummaries();
    expect(summaries).toHaveLength(4);
    expect(summaries[0]).toMatchObject({ employee: 'Karam', hours: '32h' });
  });

  it('persists entries through the repository', async () => {
    const payload: EntryModalPayload = {
      variant: 'warm-lead',
      form: {
        firstName: 'Taylor',
        lastName: 'M',
        address: '1 Test Street',
        phone: '123-456-7890',
        jobType: 'Hedge Trimming',
        jobValue: '2500',
      },
      hedges: createEmptyHedgeConfigs(),
    };

    await service.saveEntry(payload);

    expect(repository.create).toHaveBeenCalledWith(payload);
  });

  it('creates Google Calendar events when customer entries include scheduling data and stores ids for persistence', async () => {
    const payload: EntryModalPayload = {
      variant: 'customer',
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobType: 'Hedge Trimming',
        jobValue: '1200',
        email: 'alex@example.com',
      },
      hedges: createEmptyHedgeConfigs(),
      calendar: {
        start: '2026-03-12T14:00:00Z',
        end: '2026-03-12T15:00:00Z',
        timeZone: 'America/Toronto',
      },
    };

    await service.saveEntry(payload);

    expect(calendar.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining('Alex Stone'),
        start: '2026-03-12T14:00:00Z',
      }),
    );
    const persistedPayload = repository.create.mock.calls[0][0] as EntryModalPayload;
    expect(persistedPayload.calendar?.eventId).toBe('evt-created');
  });

  it('persists payload untouched when the Calendar API omits an event id', async () => {
    calendar.createEvent.mockResolvedValueOnce({
      id: undefined,
      summary: 'Job without id',
      start: '2026-03-15T09:00:00Z',
      end: '2026-03-15T10:00:00Z',
    });
    const payload: EntryModalPayload = {
      variant: 'customer',
      form: {
        firstName: 'NoId',
        lastName: 'Client',
        address: '1 Unknown St',
        phone: '(438) 555-2222',
        jobType: 'Hedge Trimming',
        jobValue: '950',
      },
      hedges: createEmptyHedgeConfigs(),
      calendar: {
        start: '2026-03-15T09:00:00Z',
        end: '2026-03-15T10:00:00Z',
        timeZone: 'America/Toronto',
      },
    };

    await service.saveEntry(payload);

    const persistedPayload = repository.create.mock.calls[0][0] as EntryModalPayload;
    expect(persistedPayload.calendar?.eventId).toBeUndefined();
  });

  it('updates Google Calendar events when an eventId is provided', async () => {
    const payload: EntryModalPayload = {
      variant: 'customer',
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobType: 'Hedge Trimming',
        jobValue: '1200',
      },
      hedges: createEmptyHedgeConfigs(),
      calendar: {
        start: '2026-03-12T14:00:00Z',
        end: '2026-03-12T15:30:00Z',
        eventId: 'evt-123',
      },
    };

    await service.saveEntry(payload);

    expect(calendar.updateEvent).toHaveBeenCalledWith(
      'evt-123',
      expect.objectContaining({
        start: '2026-03-12T14:00:00Z',
        end: '2026-03-12T15:30:00Z',
      }),
    );
    expect(calendar.createEvent).not.toHaveBeenCalled();
    const persistedPayload = repository.create.mock.calls[0][0] as EntryModalPayload;
    expect(persistedPayload.calendar?.eventId).toBe('evt-123');
  });

  it('provides a helper to create empty hedge configs for callers', () => {
    const emptyConfigs = createEmptyHedgeConfigs();
    HEDGE_IDS.forEach((id) => {
      expect(emptyConfigs[id]).toEqual({ state: 'none' });
    });
  });
});
