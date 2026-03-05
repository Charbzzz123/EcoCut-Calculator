import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { EntryModalPayload } from '../models/entry-modal.models.js';
import { createEmptyHedgeConfigs } from '../models/entry-modal.models.js';
import { EntryRepositoryService } from './entry-repository.service.js';

describe('EntryRepositoryService', () => {
  let service: EntryRepositoryService;
  let httpMock: HttpTestingController;

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

    const req = httpMock.expectOne('/api/entries');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...payload, id: 'entry-1', createdAt: '2026-03-04T12:00:00Z' });

    await expect(promise).resolves.toMatchObject({ id: 'entry-1' });
  });

  it('lists clients via the API', async () => {
    const promise = service.listClients();
    const req = httpMock.expectOne('/api/entries/clients');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        clientId: 'alex@example.com',
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
    const req = httpMock.expectOne('/api/entries/clients/alex@example.com');
    expect(req.request.method).toBe('GET');
    req.flush({
      clientId: 'alex@example.com',
      fullName: 'Alex Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobsCount: 2,
      lastJobDate: '2026-03-04T12:00:00Z',
      history: [],
    });

    await expect(promise).resolves.toMatchObject({ clientId: 'alex@example.com' });
  });
});
