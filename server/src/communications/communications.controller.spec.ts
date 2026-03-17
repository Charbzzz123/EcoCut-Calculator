import { Test } from '@nestjs/testing';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

describe('CommunicationsController', () => {
  const sendTest = jest.fn();
  const dispatch = jest.fn();
  const listCampaigns = jest.fn();
  const getCampaign = jest.fn();
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
    const controller = await createController();

    expect(controller.listCampaigns()).toEqual([{ campaignId: 'c-1' }]);
    expect(controller.getCampaign('c-1')).toEqual({ campaignId: 'c-1' });
    expect(getCampaign).toHaveBeenCalledWith('c-1');
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
});
