import { EntriesService } from './entries.service.js';

describe('EntriesService', () => {
  let service: EntriesService;

  beforeEach(() => {
    service = new EntriesService();
  });

  it('stores entries and exposes them via listEntries', () => {
    const created = service.createEntry({
      variant: 'customer',
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        jobType: 'Trim',
        jobValue: '1200',
      },
      hedges: {},
      calendar: {
        start: '2026-03-05T10:00:00Z',
        end: '2026-03-05T11:30:00Z',
        eventId: 'evt-123',
      },
    });

    const entries = service.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(created.id);
  });

  it('deduplicates clients by email/phone when listing summaries', () => {
    service.createEntry({
      variant: 'customer',
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        email: 'alex@example.com',
        jobType: 'Trim',
        jobValue: '1200',
      },
      hedges: {},
    });
    service.createEntry({
      variant: 'customer',
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine',
        phone: '(438) 555-1111',
        email: 'alex@example.com',
        jobType: 'Rabattage',
        jobValue: '900',
      },
      hedges: {},
    });

    const clients = service.listClients();
    expect(clients).toHaveLength(1);
    expect(clients[0].jobsCount).toBe(2);
  });
});
