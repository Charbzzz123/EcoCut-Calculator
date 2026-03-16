import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EntryRepositoryService, type ClientSummary } from '@shared/domain/entry/entry-repository.service.js';
import { BroadcastFacade } from './broadcast.facade.js';

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const daysAhead = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const clientsFixture: ClientSummary[] = [
  {
    clientId: 'alex',
    firstName: 'Alex',
    lastName: 'North',
    fullName: 'Alex North',
    address: '1 Maple Street',
    phone: '(514) 555-1111',
    email: 'alex@ecocutqc.com',
    jobsCount: 4,
    lastJobDate: daysAgo(45),
    nextJobDate: daysAhead(20),
  },
  {
    clientId: 'bella',
    firstName: 'Bella',
    lastName: 'Stone',
    fullName: 'Bella Stone',
    address: '2 Pine Avenue',
    phone: '(438) 555-2222',
    jobsCount: 2,
    lastJobDate: null,
    nextJobDate: null,
  },
  {
    clientId: 'carter',
    firstName: 'Carter',
    lastName: 'West',
    fullName: 'Carter West',
    address: '3 Elm Road',
    phone: '555',
    email: 'carter@ecocutqc.com',
    jobsCount: 1,
    lastJobDate: daysAgo(430),
    nextJobDate: daysAhead(80),
  },
];

const edgeCaseClientsFixture: ClientSummary[] = [
  ...clientsFixture,
  {
    clientId: 'drew',
    firstName: 'Drew',
    lastName: 'Invalid',
    fullName: 'Drew Invalid',
    address: '4 Birch Street',
    phone: '(450) 555-3333',
    email: 'drew@ecocutqc.com',
    jobsCount: 1,
    lastJobDate: 'not-a-date',
    nextJobDate: 'not-a-date',
  },
  {
    clientId: 'evan',
    firstName: 'Evan',
    lastName: 'Past',
    fullName: 'Evan Past',
    address: '5 Cedar Street',
    phone: '(450) 555-4444',
    email: 'evan@ecocutqc.com',
    jobsCount: 1,
    lastJobDate: daysAgo(91),
    nextJobDate: daysAgo(1),
  },
];

describe('BroadcastFacade', () => {
  const listClients = vi.fn<() => Promise<ClientSummary[]>>();

  beforeEach(() => {
    vi.useFakeTimers();
    listClients.mockReset();
    TestBed.configureTestingModule({
      providers: [
        BroadcastFacade,
        {
          provide: EntryRepositoryService,
          useValue: {
            listClients,
          } satisfies Partial<EntryRepositoryService>,
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads recipients and computes counts', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);

    await facade.loadRecipients();

    expect(facade.loadState()).toBe('ready');
    expect(facade.filteredRecipientsSnapshot().length).toBe(3);
    expect(facade.countsSnapshot()).toEqual({
      total: 3,
      emailEligible: 2,
      smsEligible: 2,
      bothEligible: 1,
    });
  });

  it('sets error state when loading fails', async () => {
    listClients.mockRejectedValue(new Error('boom'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const facade = TestBed.inject(BroadcastFacade);

    await facade.loadRecipients();

    expect(facade.loadState()).toBe('error');
    expect(facade.filteredRecipientsSnapshot()).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('Failed to load broadcast recipients', expect.any(Error));
  });

  it('filters by query and email/phone toggles', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.queryControl.setValue('bella');
    vi.advanceTimersByTime(151);
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual(['bella']);

    facade.queryControl.setValue('');
    vi.advanceTimersByTime(151);
    facade.requireEmailControl.setValue(true);
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual([
      'alex',
      'carter',
    ]);

    facade.requirePhoneControl.setValue(true);
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual(['alex']);
  });

  it('filters by service and upcoming windows', async () => {
    listClients.mockResolvedValue(edgeCaseClientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.serviceWindowControl.setValue('no-history');
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual(['bella']);

    facade.serviceWindowControl.setValue('last-90');
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual(['alex']);

    facade.serviceWindowControl.setValue('last-365');
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual([
      'alex',
      'evan',
    ]);

    facade.serviceWindowControl.setValue('any');
    facade.upcomingWindowControl.setValue('next-30');
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual(['alex']);

    facade.upcomingWindowControl.setValue('next-90');
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual([
      'alex',
      'carter',
    ]);

    facade.upcomingWindowControl.setValue('no-upcoming');
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual(['bella']);
  });

  it('supports digit-based query matches and empty-filter validation', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.queryControl.setValue('4385552222');
    vi.advanceTimersByTime(151);
    expect(facade.filteredRecipientsSnapshot().map((client) => client.clientId)).toEqual(['bella']);

    facade.queryControl.setValue('missing-client');
    vi.advanceTimersByTime(151);
    expect(facade.filteredRecipientsSnapshot()).toEqual([]);
    expect(facade.channelValidationMessage()).toBe('No recipients match the current filters.');
  });

  it('computes exclusion summaries and channel validation messages', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    expect(facade.exclusionSummarySnapshot()).toEqual({
      missingEmail: 1,
      missingPhone: 1,
      missingBoth: 0,
      excludedForSelectedChannel: 2,
    });
    expect(facade.channelValidationMessage()).toBeNull();

    facade.queryControl.setValue('alex');
    vi.advanceTimersByTime(151);
    facade.channelControl.setValue('sms');
    expect(facade.channelValidationMessage()).toBeNull();

    facade.queryControl.setValue('carter');
    vi.advanceTimersByTime(151);
    expect(facade.channelValidationMessage()).toBe(
      'No recipients have an SMS-capable phone number for the selected filters.',
    );
    expect(facade.canDispatch()).toBe(false);
    expect(facade.exclusionSummarySnapshot().excludedForSelectedChannel).toBe(1);

    facade.queryControl.setValue('bella');
    vi.advanceTimersByTime(151);
    facade.channelControl.setValue('email');
    expect(facade.channelValidationMessage()).toBe(
      'No recipients have an email address for the selected filters.',
    );
    expect(facade.exclusionSummarySnapshot().excludedForSelectedChannel).toBe(1);

    facade.channelControl.setValue('both');
    expect(facade.channelValidationMessage()).toBe(
      'No recipients can receive both email and SMS for the selected filters.',
    );
  });
});
