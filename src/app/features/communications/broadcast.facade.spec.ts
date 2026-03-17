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

  it('updates templates and renders merged preview with selected client', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.previewClientIdControl.setValue('bella');
    facade.emailSubjectControl.setValue('Offer for {{firstName}}');
    facade.emailBodyControl.setValue('Address {{address}} and email {{email}}');
    facade.smsBodyControl.setValue('Hello {{fullName}}');
    facade.ctaLinkControl.setValue('https://ecocutqc.com');
    facade.internalNoteControl.setValue('manager note');

    expect(facade.templates()).toEqual({
      emailSubject: 'Offer for {{firstName}}',
      emailBody: 'Address {{address}} and email {{email}}',
      smsBody: 'Hello {{fullName}}',
      ctaLink: 'https://ecocutqc.com',
      internalNote: 'manager note',
    });
    expect(facade.previewPayload()).toEqual({
      clientId: 'bella',
      clientLabel: 'Bella Stone',
      emailSubject: 'Offer for Bella',
      emailBody: 'Address 2 Pine Avenue and email no email on file',
      smsBody: 'Hello Bella Stone',
      activeLayers: ['Base template'],
    });
    expect(facade.smsMetrics()).toEqual({
      characters: 'Hello Bella Stone'.length,
      segments: 1,
    });
  });

  it('resets preview selection when filters remove all recipients', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.previewClientIdControl.setValue('carter');
    facade.queryControl.setValue('nobody');
    vi.advanceTimersByTime(151);

    expect(facade.previewClientIdControl.value).toBe('');
    expect(facade.previewPayload()).toEqual({
      clientId: null,
      clientLabel: 'No recipient selected',
      emailSubject: 'EcoCut update for there',
      emailBody:
        'Hi there,\n\nWe loved servicing your property. Your last visit was not on file.\n\n- EcoCut Team',
      smsBody: 'Hi there - EcoCut here. Want to schedule your next visit at your property?',
      activeLayers: ['Base template'],
    });
    expect(facade.smsMetrics()).toEqual({
      characters: 74,
      segments: 1,
    });
  });

  it('supports merge token insertion for each template target', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.emailSubjectControl.setValue('Subject');
    facade.insertMergeField('emailSubject', '{{firstName}}');
    expect(facade.emailSubjectControl.value).toBe('Subject {{firstName}}');

    facade.emailBodyControl.setValue('Line one\n');
    facade.insertMergeField('emailBody', '{{address}}');
    expect(facade.emailBodyControl.value).toBe('Line one\n{{address}}');

    facade.smsBodyControl.setValue('');
    facade.insertMergeField('smsBody', '{{phone}}');
    expect(facade.smsBodyControl.value).toBe('{{phone}}');
  });

  it('computes multi-segment sms metrics for long messages', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.smsBodyControl.setValue('x'.repeat(321));

    expect(facade.smsMetrics()).toEqual({
      characters: 321,
      segments: 3,
    });
  });

  it('reports zero sms segments for an empty message', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.smsBodyControl.setValue('');

    expect(facade.smsMetrics()).toEqual({
      characters: 0,
      segments: 0,
    });
  });

  it('applies channel variants and segment rules with deterministic layering', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.previewClientIdControl.setValue('alex');
    facade.emailVariantControl.setValue('promo');
    facade.smsVariantControl.setValue('follow-up');
    facade.segmentRuleControl.setValue('high-frequency');

    expect(facade.previewPayload().emailSubject).toBe('Priority update for Alex');
    expect(facade.previewPayload().emailBody).toContain('Thanks for trusting EcoCut for 4 jobs');
    expect(facade.previewPayload().smsBody).toContain('repeat client');
    expect(facade.previewPayload().activeLayers).toEqual([
      'Base template',
      'Email variant: Seasonal promo emphasis',
      'SMS variant: Follow-up SMS',
      'Segment rule: High-frequency clients (3+ jobs)',
    ]);
  });

  it('keeps prior copy when a variant or segment layer omits template fields', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.previewClientIdControl.setValue('alex');
    facade.emailVariantControl.setValue('promo');
    facade.smsVariantControl.setValue('priority-window');
    facade.segmentRuleControl.setValue('subject-only');

    expect(facade.previewPayload().emailSubject).toBe('Priority check-in for Alex');
    expect(facade.previewPayload().emailBody).toContain('Seasonal booking is now open');
    expect(facade.previewPayload().smsBody).toContain('Want to schedule your next visit');
    expect(facade.previewPayload().activeLayers).toEqual([
      'Base template',
      'Email variant: Seasonal promo emphasis',
      'SMS variant: Priority window tag',
      'Segment rule: Subject-only priority layer',
    ]);

    facade.segmentRuleControl.setValue('none');
    facade.emailVariantControl.setValue('priority-tag');
    expect(facade.previewPayload().emailSubject).toBe('EcoCut update for Alex');
    expect(facade.previewPayload().emailBody).toContain('We loved servicing 1 Maple Street');
    expect(facade.previewPayload().activeLayers).toContain('Email variant: Priority tag only');
  });

  it('evaluates inactive and upcoming segment rules against client timelines', async () => {
    listClients.mockResolvedValue(edgeCaseClientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.segmentRuleControl.setValue('inactive-90');
    facade.previewClientIdControl.setValue('evan');
    expect(facade.previewPayload().activeLayers).toContain(
      'Segment rule: Inactive 90+ days',
    );
    expect(facade.previewPayload().smsBody).toContain('returning-client slot');

    facade.previewClientIdControl.setValue('bella');
    expect(facade.previewPayload().activeLayers).not.toContain(
      'Segment rule: Inactive 90+ days',
    );

    facade.previewClientIdControl.setValue('drew');
    expect(facade.previewPayload().activeLayers).not.toContain(
      'Segment rule: Inactive 90+ days',
    );

    facade.segmentRuleControl.setValue('upcoming-30');
    facade.previewClientIdControl.setValue('alex');
    expect(facade.previewPayload().activeLayers).toContain(
      'Segment rule: Upcoming job in next 30 days',
    );
    expect(facade.previewPayload().emailBody).toContain('currently planned for');

    facade.previewClientIdControl.setValue('drew');
    expect(facade.previewPayload().activeLayers).not.toContain(
      'Segment rule: Upcoming job in next 30 days',
    );

    facade.previewClientIdControl.setValue('bella');
    expect(facade.previewPayload().activeLayers).not.toContain(
      'Segment rule: Upcoming job in next 30 days',
    );
  });

  it('applies per-client overrides above all other layers and can clear them', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.previewClientIdControl.setValue('alex');
    facade.emailVariantControl.setValue('promo');
    facade.segmentRuleControl.setValue('high-frequency');
    facade.overrideSubjectControl.setValue('Custom subject for {{firstName}}');
    facade.overrideEmailBodyControl.setValue('Custom email for {{fullName}}');
    facade.overrideSmsBodyControl.setValue('Custom sms for {{firstName}}');
    facade.saveOverrideForPreviewClient();

    expect(facade.previewPayload().emailSubject).toBe('Custom subject for Alex');
    expect(facade.previewPayload().emailBody).toBe('Custom email for Alex North');
    expect(facade.previewPayload().smsBody).toBe('Custom sms for Alex');
    expect(facade.previewPayload().activeLayers.at(-1)).toBe('Client override: Alex North');

    facade.previewClientIdControl.setValue('bella');
    expect(facade.overrideSubjectControl.value).toBe('');

    facade.previewClientIdControl.setValue('alex');
    expect(facade.overrideSubjectControl.value).toBe('Custom subject for {{firstName}}');

    facade.clearOverrideForPreviewClient();
    expect(facade.previewPayload().emailSubject).toBe('Priority update for Alex');
    expect(facade.previewPayload().activeLayers).not.toContain('Client override: Alex North');

    facade.overrideEmailBodyControl.setValue('Partial custom body');
    facade.saveOverrideForPreviewClient();
    expect(facade.previewPayload().emailSubject).toBe('Priority update for Alex');
    expect(facade.previewPayload().emailBody).toBe('Partial custom body');
  });

  it('ignores override actions when no preview client is selected', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.queryControl.setValue('nobody');
    vi.advanceTimersByTime(151);
    facade.overrideSubjectControl.setValue('Should not persist');
    facade.saveOverrideForPreviewClient();
    facade.clearOverrideForPreviewClient();

    expect(facade.previewPayload().clientId).toBeNull();
    facade.queryControl.setValue('');
    vi.advanceTimersByTime(151);
    expect(facade.previewClientIdControl.value).toBe('alex');
    expect(facade.overrideSubjectControl.value).toBe('');
  });

  it('removes an override when save is called with blank override fields', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.previewClientIdControl.setValue('alex');
    facade.overrideSubjectControl.setValue('Custom subject');
    facade.saveOverrideForPreviewClient();
    expect(facade.previewPayload().activeLayers).toContain('Client override: Alex North');

    facade.overrideSubjectControl.setValue('   ');
    facade.overrideEmailBodyControl.setValue('');
    facade.overrideSmsBodyControl.setValue('');
    facade.saveOverrideForPreviewClient();

    expect(facade.previewPayload().activeLayers).not.toContain('Client override: Alex North');
  });

  it('opens and confirms dispatch confirmation payload', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.scheduleModeControl.setValue('later');
    facade.scheduleAtControl.setValue('2026-07-01T09:30');
    facade.openDispatchConfirmation();

    expect(facade.confirmationOpen()).toBe(true);
    expect(facade.confirmationPayload()).toEqual({
      mode: 'dispatch',
      channel: 'both',
      recipients: 3,
      scheduledAtLabel: '2026-07-01T09:30',
    });

    facade.confirmCurrentAction();
    expect(facade.confirmationOpen()).toBe(false);
    expect(facade.confirmationPayload()).toBeNull();
    expect(facade.statusBanner()).toContain('Broadcast scheduled for 3 recipients');
  });

  it('queues dispatch immediately when schedule mode is now', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.scheduleModeControl.setValue('now');
    facade.openDispatchConfirmation();
    facade.confirmCurrentAction();

    expect(facade.statusBanner()).toContain('Broadcast queued for 3 recipients');
  });

  it('marks missing schedule time when dispatch is set to later without a timestamp', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.scheduleModeControl.setValue('later');
    facade.scheduleAtControl.setValue('   ');
    facade.openDispatchConfirmation();

    expect(facade.confirmationPayload()).toEqual({
      mode: 'dispatch',
      channel: 'both',
      recipients: 3,
      scheduledAtLabel: 'Scheduled time missing',
    });
  });

  it('opens and confirms test send payload only with valid destinations', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.openTestConfirmation();
    expect(facade.confirmationOpen()).toBe(false);

    facade.channelControl.setValue('email');
    facade.testEmailControl.setValue('owner@ecocutqc.com');
    facade.openTestConfirmation();
    expect(facade.confirmationPayload()).toEqual({
      mode: 'test',
      channel: 'email',
      recipients: 1,
      scheduledAtLabel: 'Send now',
    });
    facade.confirmCurrentAction();
    expect(facade.statusBanner()).toContain('owner@ecocutqc.com');

    facade.channelControl.setValue('sms');
    facade.testPhoneControl.setValue('(514) 555-0000');
    facade.openTestConfirmation();
    facade.confirmCurrentAction();
    expect(facade.statusBanner()).toContain('(514) 555-0000');

    facade.channelControl.setValue('both');
    facade.testEmailControl.setValue('');
    facade.openTestConfirmation();
    expect(facade.confirmationOpen()).toBe(false);
    facade.testEmailControl.setValue('owner@ecocutqc.com');
    facade.openTestConfirmation();
    expect(facade.confirmationOpen()).toBe(true);
  });

  it('uses combined destination labels for both-channel test sends', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.channelControl.setValue('both');
    facade.testEmailControl.setValue('owner@ecocutqc.com');
    facade.testPhoneControl.setValue('(514) 555-0000');
    facade.openTestConfirmation();
    facade.confirmCurrentAction();

    expect(facade.statusBanner()).toContain('owner@ecocutqc.com + (514) 555-0000');
  });

  it('can close confirmation without confirming and ignores confirm when payload is missing', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.openDispatchConfirmation();
    expect(facade.confirmationOpen()).toBe(true);
    facade.closeConfirmation();
    expect(facade.confirmationOpen()).toBe(false);
    expect(facade.confirmationPayload()).toBeNull();

    facade.confirmCurrentAction();
    expect(facade.statusBanner()).toBeNull();
  });

  it('blocks dispatch confirmation when channel validation is failing', async () => {
    listClients.mockResolvedValue(clientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.channelControl.setValue('both');
    facade.queryControl.setValue('carter');
    vi.advanceTimersByTime(151);
    expect(facade.canDispatch()).toBe(false);

    facade.openDispatchConfirmation();
    expect(facade.confirmationOpen()).toBe(false);
    expect(facade.confirmationPayload()).toBeNull();
  });

  it('falls back when preview client has invalid date values', async () => {
    listClients.mockResolvedValue(edgeCaseClientsFixture);
    const facade = TestBed.inject(BroadcastFacade);
    await facade.loadRecipients();

    facade.previewClientIdControl.setValue('drew');
    facade.emailBodyControl.setValue('Last {{lastJobDate}} / Next {{nextJobDate}}');

    expect(facade.previewPayload().emailBody).toBe('Last not on file / Next not scheduled');
  });
});
