import type { calendar_v3 } from 'googleapis';
import { CalendarService } from './calendar.service';

const eventsMock = {
  insert: jest.fn<
    Promise<{ data: calendar_v3.Schema$Event }>,
    [calendar_v3.Params$Resource$Events$Insert]
  >(),
  delete: jest.fn<
    Promise<unknown>,
    [calendar_v3.Params$Resource$Events$Delete]
  >(),
  patch: jest.fn<
    Promise<{ data: calendar_v3.Schema$Event }>,
    [calendar_v3.Params$Resource$Events$Patch]
  >(),
  list: jest.fn<
    Promise<{ data: { items?: calendar_v3.Schema$Event[] } }>,
    [calendar_v3.Params$Resource$Events$List]
  >(),
};

jest.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: jest.fn().mockImplementation(() => ({})),
    },
    calendar: jest.fn().mockImplementation(() => ({ events: eventsMock })),
  },
  calendar_v3: {
    Calendar: class {},
  },
}));

describe('CalendarService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CALENDAR_CREDENTIALS = JSON.stringify({
      client_email: 'scheduler@eco.example',
      private_key:
        '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----',
    });
    process.env.GOOGLE_CALENDAR_ID = 'ecocut-calendar';
  });

  afterEach(() => {
    delete process.env.GOOGLE_CALENDAR_CREDENTIALS;
    delete process.env.GOOGLE_CALENDAR_ID;
  });

  it('creates events with the configured calendar id', async () => {
    eventsMock.insert.mockResolvedValue({ data: { id: 'evt-1' } });
    const service = new CalendarService();
    const payload = {
      summary: 'Hedge trim',
      start: '2026-03-07T10:00:00Z',
      end: '2026-03-07T12:00:00Z',
      description: 'Backyard + front',
      location: '123 Pine Ave',
    };

    const created = await service.createEvent(payload);

    const insertArgs = eventsMock.insert.mock.calls[0]?.[0];
    expect(insertArgs?.calendarId).toBe('ecocut-calendar');
    expect(insertArgs?.requestBody?.summary).toBe('Hedge trim');
    expect(insertArgs?.requestBody?.start?.dateTime).toBe(payload.start);
    expect(created).toEqual({ id: 'evt-1' });
  });

  it('updates and deletes events', async () => {
    eventsMock.patch.mockResolvedValue({
      data: { id: 'evt-1', summary: 'Updated' },
    });
    eventsMock.delete.mockResolvedValue({});
    const service = new CalendarService();

    const updated = await service.updateEvent('evt-1', {
      summary: 'Updated',
    });
    const removed = await service.deleteEvent('evt-1');

    const patchArgs = eventsMock.patch.mock.calls[0]?.[0];
    expect(patchArgs?.calendarId).toBe('ecocut-calendar');
    expect(patchArgs?.requestBody?.summary).toBe('Updated');
    expect(eventsMock.delete).toHaveBeenCalledWith({
      calendarId: 'ecocut-calendar',
      eventId: 'evt-1',
    });
    expect(updated).toEqual({ id: 'evt-1', summary: 'Updated' });
    expect(removed).toEqual({ eventId: 'evt-1', deleted: true });
  });

  it('lists normalized events', async () => {
    eventsMock.list.mockResolvedValue({
      data: {
        items: [
          {
            id: 'evt-1',
            summary: 'Job',
            start: { dateTime: '2026-03-05T10:00:00Z' },
            end: { dateTime: '2026-03-05T12:00:00Z' },
          },
          {
            summary: 'All day',
            start: { date: '2026-03-05' },
            end: { date: '2026-03-05' },
            description: 'Note',
          },
          {
            summary: 'ignored',
          },
        ],
      },
    });
    const service = new CalendarService();

    const events = await service.listEvents({
      timeMin: '2026-03-05T00:00:00Z',
      timeMax: '2026-03-05T23:59:59Z',
    });

    expect(eventsMock.list).toHaveBeenCalledWith({
      calendarId: 'ecocut-calendar',
      timeMin: '2026-03-05T00:00:00Z',
      timeMax: '2026-03-05T23:59:59Z',
      orderBy: 'startTime',
      singleEvents: true,
    });
    expect(events).toHaveLength(2);
    expect(events[0]?.id).toBe('evt-1');
    expect(events[1]?.summary).toBe('All day');
  });

  it('throws when Google Calendar is not configured', async () => {
    const service = new CalendarService();
    const internals = service as unknown as {
      calendar?: unknown;
      calendarId?: string;
    };
    internals.calendar = undefined;
    internals.calendarId = undefined;

    await expect(
      service.listEvents({ timeMin: 'a', timeMax: 'b' }),
    ).rejects.toThrow('Google Calendar is not configured');
  });
});

