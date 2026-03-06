import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import type { EntryModalPayload } from '../models/entry-modal.models.js';
import { createEmptyHedgeConfigs } from '../models/entry-modal.models.js';
import { EntryRepositoryService } from './entry-repository.service.js';

describe('EntryRepositoryService', () => {
  let service: EntryRepositoryService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/entries`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EntryRepositoryService],
    });
    service = TestBed.inject(EntryRepositoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates entries through the API', async () => {
    const payload: EntryModalPayload = {
      variant: 'warm-lead',
      form: {
        firstName: 'Jamie',
        lastName: 'Lee',
        address: '1 Test St',
        phone: '(438) 123-4567',
        jobType: 'Trim',
        jobValue: '500',
      },
      hedges: createEmptyHedgeConfigs(),
    };

    const promise = service.create(payload);

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...payload, id: 'entry-1', createdAt: '2026-03-04T12:00:00Z' });

    await expect(promise).resolves.toMatchObject({ id: 'entry-1' });
  });

  it('lists clients via the API', async () => {
    const promise = service.listClients();
    const req = httpMock.expectOne(`${baseUrl}/clients`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        clientId: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Stone',
        fullName: 'Alex Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobsCount: 1,
        lastJobDate: '2026-03-04T12:00:00Z',
      },
    ]);

    await expect(promise).resolves.toHaveLength(1);
  });

  it('gets client details from the API', async () => {
    const promise = service.getClientDetail('alex@example.com');
    const req = httpMock.expectOne(`${baseUrl}/clients/alex@example.com`);
    expect(req.request.method).toBe('GET');
    req.flush({
      clientId: 'alex@example.com',
      firstName: 'Alex',
      lastName: 'Stone',
      fullName: 'Alex Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobsCount: 2,
      lastJobDate: '2026-03-04T12:00:00Z',
      history: [],
    });

    await expect(promise).resolves.toMatchObject({ clientId: 'alex@example.com' });
  });

  it('updates and deletes entries', async () => {
    const payload: EntryModalPayload = {
      variant: 'customer',
      form: {
        firstName: 'Max',
        lastName: 'Tree',
        address: '77 Cedar',
        phone: '555',
        jobType: 'Trim',
        jobValue: '$900',
      },
      hedges: createEmptyHedgeConfigs(),
      calendar: { start: '2026-03-10T10:00:00Z', end: '2026-03-10T11:00:00Z' },
    };

    const updatePromise = service.updateEntry('entry-123', payload);
    const updateReq = httpMock.expectOne(`${baseUrl}/entry-123`);
    expect(updateReq.request.method).toBe('PATCH');
    updateReq.flush({ ...payload, id: 'entry-123', createdAt: '2026-03-01T12:00:00Z' });
    await expect(updatePromise).resolves.toMatchObject({ id: 'entry-123' });

    const deletePromise = service.deleteEntry('entry-123');
    const deleteReq = httpMock.expectOne(`${baseUrl}/entry-123`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
    await expect(deletePromise).resolves.toBeNull();
  });

  it('updates and deletes clients', async () => {
    const updatePromise = service.updateClient('alex@example.com', { firstName: 'Alexa' });
    const updateReq = httpMock.expectOne(`${baseUrl}/clients/alex@example.com`);
    expect(updateReq.request.method).toBe('PATCH');
    updateReq.flush({
      clientId: 'alex@example.com',
      firstName: 'Alexa',
      lastName: 'Stone',
      fullName: 'Alexa Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobsCount: 2,
      lastJobDate: '2026-03-04T12:00:00Z',
    });
    await expect(updatePromise).resolves.toMatchObject({ firstName: 'Alexa' });

    const deletePromise = service.deleteClient('alex@example.com');
    const deleteReq = httpMock.expectOne(`${baseUrl}/clients/alex@example.com`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
    await expect(deletePromise).resolves.toBeNull();
  });

  it('detects potential client duplicates', async () => {
    const form = {
      firstName: 'Alex',
      lastName: 'Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobType: 'Trim',
      jobValue: '500',
    };
    const promise = service.findClientMatch(form);
    const req = httpMock.expectOne(`${baseUrl}/clients/match`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ form });
    req.flush({
      matchedBy: 'phone-address',
      descriptor: '(438) 555-1111 • 123 Pine',
      client: {
        clientId: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Stone',
        fullName: 'Alex Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobsCount: 2,
        lastJobDate: '2026-03-04T12:00:00Z',
      },
    });
    await expect(promise).resolves.toMatchObject({ matchedBy: 'phone-address' });
  });
});
