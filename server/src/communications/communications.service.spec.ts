import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { EMAIL_PROVIDER } from './providers/email-provider';
import { SMS_PROVIDER } from './providers/sms-provider';

describe('CommunicationsService', () => {
  const emailSend = jest.fn<Promise<string>, [unknown]>();
  const smsSend = jest.fn<Promise<string>, [unknown]>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createService = async (): Promise<CommunicationsService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommunicationsService,
        {
          provide: EMAIL_PROVIDER,
          useValue: { send: emailSend },
        },
        {
          provide: SMS_PROVIDER,
          useValue: { send: smsSend },
        },
      ],
    }).compile();

    return moduleRef.get(CommunicationsService);
  };

  it('sends email test campaigns immediately', async () => {
    emailSend.mockResolvedValue('msg-email');
    const service = await createService();

    const result = await service.sendTest({
      channel: 'email',
      scheduleMode: 'now',
      email: {
        to: 'owner@ecocutqc.com',
        subject: 'Test',
        body: 'Body',
      },
    });

    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('completed');
    expect(result.stats).toEqual({
      recipients: 1,
      attempted: 1,
      sent: 1,
      failed: 0,
      suppressed: 0,
    });
  });

  it('marks test campaigns as scheduled when mode is later', async () => {
    const service = await createService();

    const result = await service.sendTest({
      channel: 'sms',
      scheduleMode: 'later',
      scheduleAt: '2026-07-01T09:00',
      sms: {
        to: '+15145550000',
        body: 'Test sms',
      },
    });

    expect(result.status).toBe('scheduled');
    expect(smsSend).toHaveBeenCalledTimes(0);
  });

  it('throws when test payload does not match the selected channel', async () => {
    const service = await createService();

    await expect(
      service.sendTest({
        channel: 'both',
        scheduleMode: 'now',
        email: {
          to: 'owner@ecocutqc.com',
          subject: 'Only email',
          body: 'Body',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dispatches immediately and tracks failures per attempt', async () => {
    emailSend.mockResolvedValue('msg-email');
    smsSend
      .mockRejectedValueOnce(new Error('fail first'))
      .mockResolvedValue('msg-sms');
    const service = await createService();

    const result = await service.dispatch({
      channel: 'both',
      scheduleMode: 'now',
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          phone: '+15145550001',
          emailSubject: 'Subj',
          emailBody: 'Email body',
          smsBody: 'Sms body',
        },
      ],
    });

    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(smsSend).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
    expect(result.stats.sent).toBe(2);
    expect(result.stats.failed).toBe(0);
    expect(result.stats.suppressed).toBe(0);
  });

  it('stores scheduled dispatches without delivering immediately', async () => {
    const service = await createService();

    const result = await service.dispatch({
      channel: 'email',
      scheduleMode: 'later',
      scheduleAt: '2026-07-01T09:00',
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          emailSubject: 'Subj',
          emailBody: 'Email body',
          smsBody: 'Sms body',
        },
      ],
    });

    expect(result.status).toBe('scheduled');
    expect(result.stats.recipients).toBe(1);
    expect(result.stats.suppressed).toBe(0);
    expect(emailSend).toHaveBeenCalledTimes(0);
  });

  it('throws for empty dispatch recipient lists', async () => {
    const service = await createService();
    await expect(
      service.dispatch({
        channel: 'email',
        scheduleMode: 'now',
        recipients: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns campaign list with stored campaigns', async () => {
    const service = await createService();

    const first = await service.sendTest({
      channel: 'email',
      scheduleMode: 'later',
      email: {
        to: 'owner@ecocutqc.com',
        subject: 'First',
        body: 'Body',
      },
    });
    const second = await service.sendTest({
      channel: 'email',
      scheduleMode: 'later',
      email: {
        to: 'owner@ecocutqc.com',
        subject: 'Second',
        body: 'Body',
      },
    });

    const campaigns = service.listCampaigns();
    const ids = campaigns.map((campaign) => campaign.campaignId);
    expect(ids).toContain(first.campaignId);
    expect(ids).toContain(second.campaignId);
  });

  it('skips suppressed recipients during dispatch and counts suppressed sends', async () => {
    emailSend.mockResolvedValue('msg-email');
    smsSend.mockResolvedValue('msg-sms');
    const service = await createService();
    service.upsertSuppressions({
      channel: 'both',
      email: 'alex@ecocutqc.com',
      phone: '(514) 555-0001',
    });

    const result = await service.dispatch({
      channel: 'both',
      scheduleMode: 'now',
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          phone: '+1 (514) 555-0001',
          emailSubject: 'Subj',
          emailBody: 'Email body',
          smsBody: 'Sms body',
        },
        {
          clientId: 'bella',
          clientLabel: 'Bella Stone',
          email: 'bella@ecocutqc.com',
          phone: '+1 (514) 555-0002',
          emailSubject: 'Subj',
          emailBody: 'Email body',
          smsBody: 'Sms body',
        },
      ],
    });

    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(smsSend).toHaveBeenCalledTimes(1);
    expect(result.stats).toEqual({
      recipients: 2,
      attempted: 2,
      sent: 2,
      failed: 0,
      suppressed: 2,
    });
  });

  it('manages suppression records with unsubscribe and resubscribe calls', async () => {
    const service = await createService();

    const records = service.upsertSuppressions({
      channel: 'both',
      email: ' Owner@EcoCutQC.com ',
      phone: '(514) 555-0000',
      reason: 'manual-block',
    });

    expect(records).toHaveLength(2);
    expect(service.listSuppressions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'sms',
          value: '5145550000',
          reason: 'manual-block',
        }),
        expect.objectContaining({
          channel: 'email',
          value: 'owner@ecocutqc.com',
          reason: 'manual-block',
        }),
      ]),
    );

    expect(
      service.removeSuppressions({
        channel: 'email',
        email: 'owner@ecocutqc.com',
      }),
    ).toEqual({ removed: 1 });

    expect(service.listSuppressions()).toEqual([
      expect.objectContaining({
        channel: 'sms',
        value: '5145550000',
      }),
    ]);
  });

  it('validates required values for suppression operations', async () => {
    const service = await createService();

    expect(() => service.upsertSuppressions({ channel: 'email' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.removeSuppressions({
        channel: 'sms',
      }),
    ).toThrow(BadRequestException);
  });

  it('queues manager dispatches for owner approval when required', async () => {
    const service = await createService();

    const result = await service.dispatch({
      channel: 'email',
      scheduleMode: 'now',
      operatorRole: 'manager',
      requiresApproval: true,
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          emailSubject: 'Subj',
          emailBody: 'Body',
          smsBody: 'Sms',
        },
      ],
    });

    expect(result.status).toBe('pending_approval');
    expect(result.approval).toEqual(
      expect.objectContaining({
        required: true,
        requestedBy: 'manager',
      }),
    );
    expect(emailSend).toHaveBeenCalledTimes(0);
  });

  it('approves pending campaigns and executes delivery', async () => {
    emailSend.mockResolvedValue('msg-email');
    const service = await createService();

    const queued = await service.dispatch({
      channel: 'email',
      scheduleMode: 'now',
      operatorRole: 'manager',
      requiresApproval: true,
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          emailSubject: 'Subj',
          emailBody: 'Body',
          smsBody: 'Sms',
        },
      ],
    });

    const approved = await service.approveCampaign(queued.campaignId, 'owner');

    expect(approved.status).toBe('completed');
    expect(approved.approval).toEqual(
      expect.objectContaining({
        required: true,
        requestedBy: 'manager',
        approvedBy: 'owner',
      }),
    );
    expect(emailSend).toHaveBeenCalledTimes(1);

    const audit = service.listCampaignAudit(queued.campaignId);
    expect(audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'pending_approval' }),
        expect.objectContaining({ action: 'approved' }),
        expect.objectContaining({ action: 'completed' }),
      ]),
    );
  });

  it('cancels scheduled campaigns and rejects invalid cancellation states', async () => {
    const service = await createService();

    const scheduled = await service.dispatch({
      channel: 'sms',
      scheduleMode: 'later',
      scheduleAt: '2026-07-10T09:00',
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          phone: '+15145550001',
          emailSubject: 'Subj',
          emailBody: 'Body',
          smsBody: 'Sms',
        },
      ],
    });

    const cancelled = service.cancelCampaign(
      scheduled.campaignId,
      'manual stop',
    );
    expect(cancelled.status).toBe('cancelled');
    expect(service.listCampaignAudit(scheduled.campaignId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'cancelled', detail: 'manual stop' }),
      ]),
    );

    await expect(
      service.approveCampaign(scheduled.campaignId, 'owner'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(() => service.cancelCampaign(scheduled.campaignId)).toThrow(
      BadRequestException,
    );
  });

  it('ingests delivery webhooks and aggregates campaign analytics', async () => {
    const service = await createService();
    const dispatchCampaign = await service.dispatch({
      channel: 'both',
      scheduleMode: 'later',
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          phone: '+15145550000',
          emailSubject: 'Subj',
          emailBody: 'Body',
          smsBody: 'Sms',
        },
      ],
    });

    service.ingestDeliveryWebhook({
      campaignId: dispatchCampaign.campaignId,
      channel: 'email',
      provider: 'hostinger',
      eventType: 'sent',
      recipient: 'alex@ecocutqc.com',
    });
    service.ingestDeliveryWebhook({
      campaignId: dispatchCampaign.campaignId,
      channel: 'email',
      provider: 'hostinger',
      eventType: 'delivered',
      recipient: 'alex@ecocutqc.com',
    });
    service.ingestDeliveryWebhook({
      campaignId: dispatchCampaign.campaignId,
      channel: 'sms',
      provider: 'quo',
      eventType: 'failed',
      recipient: '+15145550000',
      reason: 'carrier timeout',
    });

    const analytics = service.getCampaignAnalytics(dispatchCampaign.campaignId);
    expect(analytics.totals).toEqual({
      queued: 0,
      sent: 1,
      delivered: 1,
      failed: 1,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      resubscribed: 0,
    });
    expect(analytics.byChannel).toEqual({ email: 2, sms: 1 });
    expect(analytics.latestEventAt).not.toBeNull();
  });

  it('syncs suppression state from unsubscribe/resubscribe webhooks', async () => {
    const service = await createService();
    const dispatchCampaign = await service.dispatch({
      channel: 'email',
      scheduleMode: 'later',
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          emailSubject: 'Subj',
          emailBody: 'Body',
          smsBody: 'Sms',
        },
      ],
    });

    service.ingestDeliveryWebhook({
      campaignId: dispatchCampaign.campaignId,
      channel: 'email',
      provider: 'hostinger',
      eventType: 'unsubscribed',
      recipient: 'alex@ecocutqc.com',
    });
    expect(service.listSuppressions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'email',
          value: 'alex@ecocutqc.com',
          reason: 'webhook-unsubscribe',
        }),
      ]),
    );

    service.ingestDeliveryWebhook({
      campaignId: dispatchCampaign.campaignId,
      channel: 'email',
      provider: 'hostinger',
      eventType: 'resubscribed',
      recipient: 'alex@ecocutqc.com',
    });
    expect(service.listSuppressions()).toEqual([]);
  });

  it('throws when requesting an unknown campaign id', async () => {
    const service = await createService();
    expect(() => service.getCampaign('missing-id')).toThrow(
      BadRequestException,
    );
    expect(() => service.listCampaignAudit('missing-id')).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.ingestDeliveryWebhook({
        campaignId: 'missing-id',
        channel: 'email',
        provider: 'hostinger',
        eventType: 'delivered',
        recipient: 'owner@ecocutqc.com',
      }),
    ).toThrow(BadRequestException);
    expect(() => service.getCampaignAnalytics('missing-id')).toThrow(
      BadRequestException,
    );
  });
});
