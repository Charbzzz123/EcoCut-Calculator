import { Test } from '@nestjs/testing';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

describe('CommunicationsController', () => {
  const sendTest = jest.fn();
  const dispatch = jest.fn();
  const listCampaigns = jest.fn();
  const getCampaign = jest.fn();
  const getCampaignAnalytics = jest.fn();
  const listCampaignAudit = jest.fn();
  const approveCampaign = jest.fn();
  const cancelCampaign = jest.fn();
  const ingestDeliveryWebhook = jest.fn();
  const listSuppressions = jest.fn();
  const upsertSuppressions = jest.fn();
  const removeSuppressions = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createController = async (): Promise<CommunicationsController> => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CommunicationsController],
      providers: [
        {
          provide: CommunicationsService,
          useValue: {
            sendTest,
            dispatch,
            listCampaigns,
            getCampaign,
            getCampaignAnalytics,
            listCampaignAudit,
            approveCampaign,
            cancelCampaign,
            ingestDeliveryWebhook,
            listSuppressions,
            upsertSuppressions,
            removeSuppressions,
          },
        },
      ],
    }).compile();

    return moduleRef.get(CommunicationsController);
  };

  it('forwards test requests to the service', async () => {
    sendTest.mockResolvedValue({ campaignId: 'c-1' });
    const controller = await createController();
    const payload = {
      channel: 'email',
      scheduleMode: 'now',
      email: { to: 'owner@ecocutqc.com', subject: 'subj', body: 'body' },
    } as const;

    await expect(controller.sendTest(payload)).resolves.toEqual({
      campaignId: 'c-1',
    });
    expect(sendTest).toHaveBeenCalledWith(payload);
  });

  it('forwards dispatch requests to the service', async () => {
    dispatch.mockResolvedValue({ campaignId: 'c-2' });
    const controller = await createController();
    const payload = {
      channel: 'sms',
      scheduleMode: 'later',
      scheduleAt: '2026-07-01T09:00',
      recipients: [],
    } as const;

    await expect(controller.dispatch(payload)).resolves.toEqual({
      campaignId: 'c-2',
    });
    expect(dispatch).toHaveBeenCalledWith(payload);
  });

  it('returns campaign list and single campaign details', async () => {
    listCampaigns.mockReturnValue([{ campaignId: 'c-1' }]);
    getCampaign.mockReturnValue({ campaignId: 'c-1' });
    getCampaignAnalytics.mockReturnValue({ campaignId: 'c-1', totals: {} });
    const controller = await createController();

    expect(controller.listCampaigns()).toEqual([{ campaignId: 'c-1' }]);
    expect(controller.getCampaign('c-1')).toEqual({ campaignId: 'c-1' });
    expect(controller.getCampaignAnalytics('c-1')).toEqual({
      campaignId: 'c-1',
      totals: {},
    });
    expect(getCampaign).toHaveBeenCalledWith('c-1');
    expect(getCampaignAnalytics).toHaveBeenCalledWith('c-1');
  });

  it('forwards campaign audit, approve, and cancel requests', async () => {
    listCampaignAudit.mockReturnValue([{ action: 'created' }]);
    approveCampaign.mockResolvedValue({
      campaignId: 'c-9',
      status: 'completed',
    });
    cancelCampaign.mockReturnValue({ campaignId: 'c-9', status: 'cancelled' });
    const controller = await createController();

    expect(controller.listCampaignAudit('c-9')).toEqual([
      { action: 'created' },
    ]);
    await expect(
      controller.approveCampaign('c-9', { approvedBy: 'owner' }),
    ).resolves.toEqual({ campaignId: 'c-9', status: 'completed' });
    expect(
      controller.cancelCampaign('c-9', { reason: 'operator stop' }),
    ).toEqual({ campaignId: 'c-9', status: 'cancelled' });

    expect(listCampaignAudit).toHaveBeenCalledWith('c-9');
    expect(approveCampaign).toHaveBeenCalledWith('c-9', 'owner');
    expect(cancelCampaign).toHaveBeenCalledWith('c-9', 'operator stop');
  });

  it('forwards suppression listing and mutation requests', async () => {
    listSuppressions.mockReturnValue([{ channel: 'email', value: 'a@b.com' }]);
    upsertSuppressions.mockReturnValue([
      { channel: 'sms', value: '15145550000' },
    ]);
    removeSuppressions.mockReturnValue({ removed: 1 });
    const controller = await createController();

    expect(controller.listSuppressions()).toEqual([
      { channel: 'email', value: 'a@b.com' },
    ]);
    expect(
      controller.unsubscribe({
        channel: 'sms',
        phone: '(514) 555-0000',
      }),
    ).toEqual([{ channel: 'sms', value: '15145550000' }]);
    expect(
      controller.resubscribe({
        channel: 'email',
        email: 'owner@ecocutqc.com',
      }),
    ).toEqual({ removed: 1 });

    expect(upsertSuppressions).toHaveBeenCalledWith({
      channel: 'sms',
      phone: '(514) 555-0000',
    });
    expect(removeSuppressions).toHaveBeenCalledWith({
      channel: 'email',
      email: 'owner@ecocutqc.com',
    });
  });

  it('forwards delivery webhook events', async () => {
    ingestDeliveryWebhook.mockReturnValue({ accepted: true });
    const controller = await createController();
    const payload = {
      campaignId: 'c-9',
      channel: 'sms',
      provider: 'quo',
      eventType: 'delivered',
      recipient: '+15145550000',
    } as const;

    expect(controller.ingestDeliveryWebhook(payload)).toEqual({
      accepted: true,
    });
    expect(ingestDeliveryWebhook).toHaveBeenCalledWith(payload);
  });
});
