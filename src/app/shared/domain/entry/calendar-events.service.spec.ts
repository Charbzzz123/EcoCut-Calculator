import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CalendarEventsService } from './calendar-events.service.js';

describe('CalendarEventsService', () => {
  let service: CalendarEventsService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/calendar/events`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(CalendarEventsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches events for a given date', async () => {
    const resultPromise = service.listEventsForDate('2026-03-05');
    const req = httpMock.expectOne(
      (request) => request.method === 'GET' && request.url === baseUrl,
    );
    expect(req.request.params.get('timeMin')).toBe(new Date('2026-03-05T00:00:00').toISOString());
    expect(req.request.params.get('timeMax')).toBe(new Date('2026-03-05T23:59:59').toISOString());
    req.flush([{ id: 'evt-1', summary: 'Job', start: '2026-03-05T10:00:00Z', end: '2026-03-05T11:00:00Z' }]);

    const events = await resultPromise;
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt-1');
  });

  it('fetches events for a date range', async () => {
    const resultPromise = service.listEventsForRange('2026-03-01', '2026-03-07');
    const req = httpMock.expectOne(
      (request) => request.method === 'GET' && request.url === baseUrl,
    );
    expect(req.request.params.get('timeMin')).toBe(new Date('2026-03-01T00:00:00').toISOString());
    expect(req.request.params.get('timeMax')).toBe(new Date('2026-03-07T23:59:59').toISOString());
    req.flush([
      { id: 'evt-1', summary: 'Job', start: '2026-03-05T10:00:00Z', end: '2026-03-05T11:00:00Z' },
    ]);

    const events = await resultPromise;
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt-1');
  });

  it('reuses cached range results until refresh is forced', async () => {
    const firstPromise = service.listEventsForRange('2026-03-01', '2026-03-07');
    const firstReq = httpMock.expectOne(
      (request) => request.method === 'GET' && request.url === baseUrl,
    );
    firstReq.flush([
      { id: 'evt-cache', summary: 'Cached', start: '2026-03-02T10:00:00Z', end: '2026-03-02T11:00:00Z' },
    ]);
    const firstEvents = await firstPromise;
    expect(firstEvents[0].id).toBe('evt-cache');

    const secondEvents = await service.listEventsForRange('2026-03-01', '2026-03-07');
    expect(secondEvents[0].id).toBe('evt-cache');
    httpMock.expectNone((request) => request.method === 'GET' && request.url === baseUrl);

    const refreshPromise = service.listEventsForRange('2026-03-01', '2026-03-07', { forceRefresh: true });
    const refreshReq = httpMock.expectOne(
      (request) => request.method === 'GET' && request.url === baseUrl,
    );
    refreshReq.flush([
      { id: 'evt-fresh', summary: 'Fresh', start: '2026-03-03T10:00:00Z', end: '2026-03-03T11:00:00Z' },
    ]);
    const refreshEvents = await refreshPromise;
    expect(refreshEvents[0].id).toBe('evt-fresh');
  });

  it('prefetches a month window around a date', async () => {
    const prefetchPromise = service.prefetchAroundDate('2026-03-15', 1);
    const req = httpMock.expectOne(
      (request) => request.method === 'GET' && request.url === baseUrl,
    );
    expect(req.request.params.get('timeMin')).toBe(new Date('2026-02-01T00:00:00').toISOString());
    expect(req.request.params.get('timeMax')).toBe(new Date('2026-04-30T23:59:59').toISOString());
    req.flush([]);
    await prefetchPromise;
  });

  it('creates a new calendar event', async () => {
    const requestBody = {
      summary: 'New Job',
      start: '2026-03-06T12:00:00Z',
      end: '2026-03-06T13:00:00Z',
      location: '123 Street',
    };
    const resultPromise = service.createEvent(requestBody);
    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.summary).toBe('New Job');
    req.flush({ ...requestBody, id: 'evt-2' });

    const event = await resultPromise;
    expect(event.id).toBe('evt-2');
  });

  it('updates an existing calendar event', async () => {
    const requestBody = {
      summary: 'Updated Job',
      start: '2026-03-07T09:00:00Z',
      end: '2026-03-07T11:00:00Z',
    };
    const resultPromise = service.updateEvent('evt-9', requestBody);
    const req = httpMock.expectOne(`${baseUrl}/evt-9`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.summary).toBe('Updated Job');
    req.flush({ ...requestBody, id: 'evt-9' });

    const event = await resultPromise;
    expect(event.id).toBe('evt-9');
  });

  it('deletes a calendar event', async () => {
    const deletePromise = service.deleteEvent('evt-10');
    const req = httpMock.expectOne(`${baseUrl}/evt-10`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    await deletePromise;
  });
});
