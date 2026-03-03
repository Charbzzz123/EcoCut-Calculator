import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HomeDataService } from './home-data.service.js';
import type { EntryModalPayload } from './models/entry-modal.models.js';
import { HEDGE_IDS, createEmptyHedgeConfigs } from './models/entry-modal.models.js';
import { CalendarEventsService } from './services/calendar-events.service.js';

class CalendarEventsServiceStub {
  createEvent = vi.fn().mockResolvedValue(undefined);
  listEventsForDate = vi.fn();
}

describe('HomeDataService', () => {
  let service: HomeDataService;
  let calendar: CalendarEventsServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HomeDataService,
        { provide: CalendarEventsService, useClass: CalendarEventsServiceStub },
      ],
    });
    service = TestBed.inject(HomeDataService);
    calendar = TestBed.inject(CalendarEventsService) as unknown as CalendarEventsServiceStub;
  });

  it('exposes hero metric snapshots', () => {
    const metrics = service.getHeroMetrics();
    expect(metrics).toHaveLength(4);
    expect(metrics.map((metric) => metric.id)).toContain('jobs-today');
  });

  it('lists all quick actions and commands', () => {
    const quickActions = service.getQuickActions();
    expect(quickActions).toHaveLength(12);
    const commands = quickActions.map((action) => action.command);
    expect(commands).toContain('view-finances');
  });

  it('summarizes weekly hours for every teammate', () => {
    const summaries = service.getWeeklyHourSummaries();
    expect(summaries).toHaveLength(4);
    expect(summaries[0]).toMatchObject({ employee: 'Karam', hours: '32h' });
  });

  it('saves entries by delegating to the console (stub for now)', async () => {
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

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await service.saveEntry(payload);

    expect(infoSpy).toHaveBeenCalledWith('Simulating entry persistence', payload);

    infoSpy.mockRestore();
  });

  it('creates Google Calendar events when customer entries include scheduling data', async () => {
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
        notes: 'Bring ladder',
      },
    };

    await service.saveEntry(payload);

    expect(calendar.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.stringContaining('Alex Stone'),
        start: '2026-03-12T14:00:00Z',
      }),
    );
  });

  it('provides a helper to create empty hedge configs for callers', () => {
    const emptyConfigs = createEmptyHedgeConfigs();
    HEDGE_IDS.forEach((id) => {
      expect(emptyConfigs[id]).toEqual({ state: 'none' });
    });
  });
});
