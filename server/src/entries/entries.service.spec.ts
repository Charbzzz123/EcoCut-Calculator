import type { CreateEntryDto } from './dto/create-entry.dto.js';
import { EntriesService } from './entries.service.js';
import type { EntriesRepository } from './entries.repository.js';
import type { StoredEntry } from './entries.types.js';

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
    repository = new FakeEntriesRepository();
    service = new EntriesService(repository as unknown as EntriesRepository);
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
});
