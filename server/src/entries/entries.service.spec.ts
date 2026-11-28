import type { CreateEntryDto } from './dto/create-entry.dto';
import { EntriesService } from './entries.service';
import type { EntriesRepository } from './entries.repository';
import type { StoredEntry } from './entries.types';

class FakeEntriesRepository {
  snapshot: StoredEntry[] = [];

  loadEntries(): Promise<StoredEntry[]> {
    return Promise.resolve(this.snapshot);
  }

  saveEntries(entries: StoredEntry[]): Promise<void> {
    this.snapshot = [...entries];
    return Promise.resolve();
  }
}

describe('EntriesService', () => {
  let service: EntriesService;
  let repository: FakeEntriesRepository;
  const syncClientContact = jest.fn();

  const createPayload = (
    overrides: Partial<CreateEntryDto> = {},
  ): CreateEntryDto => ({
    variant: 'customer',
    form: {
      firstName: 'Alex',
      lastName: 'Stone',
      address: '123 Pine',
      phone: '(438) 555-1111',
      jobType: 'Trim',
      jobValue: '1200',
      ...overrides.form,
    },
    hedges: {},
    calendar: overrides.calendar,
    ...overrides,
  });

  beforeEach(async () => {
    syncClientContact.mockReset();
    repository = new FakeEntriesRepository();
    service = new EntriesService(
      repository as unknown as EntriesRepository,
      {
        syncClientContact,
      } as never,
    );
    await service.onModuleInit();
  });

  it('stores entries and exposes them via listEntries', async () => {
    const created = await service.createEntry(
      createPayload({
        calendar: {
          start: '2026-03-05T10:00:00Z',
          end: '2026-03-05T11:30:00Z',
          eventId: 'evt-123',
        },
      }),
    );

    const entries = service.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(created.id);
    expect(repository.snapshot).toHaveLength(1);
    expect(syncClientContact).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: '4385551111::123 pine',
        firstName: 'Alex',
        lastName: 'Stone',
        source: 'entries-create',
      }),
    );
  });

  it('marks an existing opportunity accepted without changing its details or execution', async () => {
    const created = await service.createEntry(
      createPayload({
        variant: 'warm-lead',
        form: {
          ...createPayload().form,
          additionalDetails: 'Call after acceptance',
        },
        execution: {
          status: 'scheduled',
          startedAt: '2026-03-05T10:00:00Z',
          endedAt: '2026-03-05T11:00:00Z',
          totalHours: 1,
          crew: [],
          updatedAt: '2026-03-05T11:00:00Z',
        },
      }),
    );
    const accepted = await service.updateSalesStatus(created.id, {
      salesStatus: 'accepted',
    });
    expect(accepted).toMatchObject({
      id: created.id,
      createdAt: created.createdAt,
      variant: 'warm-lead',
      salesStatus: 'accepted',
      acceptedAt: expect.any(String),
      form: created.form,
      execution: created.execution,
    });
    expect(repository.snapshot).toHaveLength(1);
    expect(
      service.getClientDetails('4385551111::123 pine').history[0].salesStatus,
    ).toBe('accepted');
    expect(service.listClients()[0].relationshipStatus).toBe('customer');
    expect(service.listClients()[0].openOpportunityCount).toBe(0);
    expect(syncClientContact).toHaveBeenCalledTimes(1);
  });

  it('derives Lead, Customer, and Inactive from current opportunity statuses', async () => {
    const created = await service.createEntry(
      createPayload({ variant: 'warm-lead' }),
    );
    syncClientContact.mockClear();

    await service.updateSalesStatus(created.id, {
      salesStatus: 'not-proceeding',
    });
    expect(service.listClients()[0]).toMatchObject({
      relationshipStatus: 'inactive',
      openOpportunityCount: 0,
    });
    expect(service.listEntries('not-proceeding')).toHaveLength(1);

    await service.updateSalesStatus(created.id, { salesStatus: 'open' });
    expect(service.listClients()[0]).toMatchObject({
      relationshipStatus: 'lead',
      openOpportunityCount: 1,
    });
    await service.updateSalesStatus(created.id, { salesStatus: 'accepted' });
    const acceptedAt = service.listEntries()[0].acceptedAt;
    await service.updateSalesStatus(created.id, { salesStatus: 'open' });

    expect(service.listEntries('accepted')).toHaveLength(0);
    expect(service.listEntries('open')[0].acceptedAt).toBeNull();
    expect(service.listClients()[0]).toMatchObject({
      relationshipStatus: 'lead',
      openOpportunityCount: 1,
    });
    expect(acceptedAt).toEqual(expect.any(String));
    expect(syncClientContact).not.toHaveBeenCalled();
  });

  it('backfills legacy entry variants into structured sales lifecycle fields', async () => {
    const legacyWarm = {
      ...createPayload({ variant: 'warm-lead' }),
      id: 'legacy-warm',
      createdAt: '2026-01-01T10:00:00.000Z',
    } as StoredEntry;
    const legacyCustomer = {
      ...createPayload({ variant: 'customer' }),
      id: 'legacy-customer',
      createdAt: '2026-01-02T10:00:00.000Z',
    } as StoredEntry;
    repository.snapshot = [legacyWarm, legacyCustomer];

    const freshService = new EntriesService(
      repository as unknown as EntriesRepository,
    );
    await freshService.onModuleInit();

    expect(freshService.listEntries()).toEqual([
      expect.objectContaining({
        id: 'legacy-warm',
        salesStatus: 'open',
        salesStatusChangedAt: legacyWarm.createdAt,
        acceptedAt: null,
      }),
      expect.objectContaining({
        id: 'legacy-customer',
        salesStatus: 'accepted',
        salesStatusChangedAt: legacyCustomer.createdAt,
        acceptedAt: null,
      }),
    ]);
    expect(freshService.listClients()[0].relationshipStatus).toBe('customer');
    await freshService.updateSalesStatus('legacy-customer', {
      salesStatus: 'open',
    });
    expect(freshService.listClients()[0].relationshipStatus).toBe('lead');
  });

  it('counts accepted jobs without dates as To schedule and stores their notes', async () => {
    const created = await service.createEntry(
      createPayload({ variant: 'warm-lead' }),
    );
    await service.updateSalesStatus(created.id, {
      salesStatus: 'accepted',
      followUpNote: 'Prefers next month; call back.',
    });
    expect(service.listClients()[0]).toMatchObject({
      relationshipStatus: 'customer',
      toScheduleCount: 1,
    });
    expect(
      service.getClientDetails('4385551111::123 pine').history[0].followUpNote,
    ).toBe('Prefers next month; call back.');
    await service.updateSalesStatus(created.id, {
      salesStatus: 'accepted',
      calendar: {
        start: '2027-03-05T10:00:00Z',
        end: '2027-03-05T12:00:00Z',
        eventId: 'calendar-job',
      },
    });
    expect(service.listClients()[0].toScheduleCount).toBe(0);
  });

  it('rejects unsupported sales statuses and filters entries by stable status values', async () => {
    const open = await service.createEntry(
      createPayload({ variant: 'warm-lead' }),
    );
    const accepted = await service.createEntry(
      createPayload({ variant: 'customer' }),
    );
    expect(service.listEntries('open').map((entry) => entry.id)).toEqual([
      open.id,
    ]);
    expect(service.listEntries('accepted').map((entry) => entry.id)).toEqual([
      accepted.id,
    ]);
    expect(() => service.listEntries('maybe')).toThrow('Invalid salesStatus');
    await expect(
      service.updateSalesStatus(open.id, { salesStatus: 'maybe' as never }),
    ).rejects.toThrow('Invalid salesStatus');
  });

  it('deduplicates clients by email/phone when listing summaries', async () => {
    await service.createEntry(
      createPayload({
        form: {
          firstName: 'Alex',
          lastName: 'Stone',
          address: '123 Pine',
          phone: '(438) 555-1111',
          email: 'alex@example.com',
          jobType: 'Trim',
          jobValue: '1200',
        },
      }),
    );
    await service.createEntry(
      createPayload({
        form: {
          firstName: 'Alex',
          lastName: 'Stone',
          address: '123 Pine',
          phone: '(438) 555-1111',
          email: 'alex@example.com',
          jobType: 'Rabattage',
          jobValue: '900',
        },
      }),
    );

    const clients = service.listClients();
    expect(clients).toHaveLength(1);
    expect(clients[0].jobsCount).toBe(2);
  });

  it('keeps separate clients when phone matches but address differs', async () => {
    await service.createEntry(
      createPayload({
        form: {
          firstName: 'Alex',
          lastName: 'Stone',
          address: '123 Pine',
          phone: '(438) 555-1111',
          jobType: 'Trim',
          jobValue: '1200',
        },
      }),
    );
    await service.createEntry(
      createPayload({
        form: {
          firstName: 'Jamie',
          lastName: 'Brook',
          address: '987 Maple',
          phone: '(438) 555-1111',
          jobType: 'Rabattage',
          jobValue: '900',
        },
      }),
    );

    const clients = service.listClients();
    expect(clients).toHaveLength(2);
  });

  it('boots from the persisted snapshot on init', async () => {
    const persisted: StoredEntry = {
      ...createPayload(),
      id: 'persisted',
      createdAt: '2026-03-04T12:00:00Z',
    };
    repository.snapshot = [persisted];

    const freshService = new EntriesService(
      repository as unknown as EntriesRepository,
    );
    await freshService.onModuleInit();

    expect(freshService.listEntries()).toHaveLength(1);
    expect(freshService.listClients()[0].jobsCount).toBe(1);
  });

  it('matches clients by email and phone/address combos', async () => {
    await service.createEntry(
      createPayload({
        form: {
          firstName: 'Alex',
          lastName: 'Stone',
          address: '123 Pine',
          phone: '(438) 555-1111',
          email: 'alex@example.com',
          jobType: 'Trim',
          jobValue: '1200',
        },
      }),
    );
    await service.createEntry(
      createPayload({
        form: {
          firstName: 'Jamie',
          lastName: 'Brook',
          address: '77 Cedar',
          phone: '(438) 555-9999',
          jobType: 'Trim',
          jobValue: '900',
        },
      }),
    );

    const emailMatch = service.findClientMatch({
      firstName: 'New',
      lastName: 'Person',
      address: '000 Test',
      phone: '(438) 111-1111',
      email: 'Alex@example.com',
      jobType: 'Trim',
      jobValue: '500',
    });
    expect(emailMatch?.matchedBy).toBe('email');
    expect(emailMatch?.client.fullName).toBe('Alex Stone');

    const phoneAddressMatch = service.findClientMatch({
      firstName: 'Another',
      lastName: 'Client',
      address: '77 Cedar',
      phone: '(438) 555-9999',
      jobType: 'Trim',
      jobValue: '500',
    });
    expect(phoneAddressMatch?.matchedBy).toBe('phone-address');
    expect(phoneAddressMatch?.client.fullName).toBe('Jamie Brook');
  });

  it('returns null when no client matches', () => {
    const result = service.findClientMatch({
      firstName: 'Nobody',
      lastName: 'Here',
      address: '999 Nowhere',
      phone: '111',
      jobType: 'Trim',
      jobValue: '100',
    });
    expect(result).toBeNull();
  });

  it('applies completion execution metadata to a linked entry', async () => {
    const created = await service.createEntry(
      createPayload({
        form: {
          firstName: 'Alex',
          lastName: 'Stone',
          address: '123 Pine',
          phone: '(438) 555-1111',
          email: 'alex@example.com',
          jobType: 'Trim',
          jobValue: '1200',
        },
        calendar: {
          start: '2026-03-06T13:00:00Z',
          end: '2026-03-06T16:00:00Z',
        },
      }),
    );

    await service.applyExecutionCompletion(created.id, {
      startedAt: '2026-03-06T13:05:00Z',
      endedAt: '2026-03-06T16:22:00Z',
      completionNote: 'Customer asked for extra cleanup around gate.',
      completedByRole: 'owner',
      crew: [
        { employeeId: 'emp-1', fullName: 'Alex Stone', hoursWorked: 3.25 },
        { employeeId: 'emp-2', fullName: 'Jamie Brook', hoursWorked: 3.25 },
      ],
    });

    const detail = service.getClientDetails('alex@example.com');
    const execution = detail.history[0]?.execution;
    expect(execution?.status).toBe('completed');
    expect(execution?.totalHours).toBe(6.5);
    expect(execution?.completionNote).toContain('extra cleanup');
    expect(execution?.crew).toHaveLength(2);
  });
});
