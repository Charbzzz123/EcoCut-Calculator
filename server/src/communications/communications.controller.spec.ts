import { Test } from '@nestjs/testing';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationsChatsService } from './chats/communications-chats.service';

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
  const ingestProviderWebhook = jest.fn();
  const getProviderHealth = jest.fn();
  const syncMirror = jest.fn();
  const ingestQuoWebhook = jest.fn();
  const listConversations = jest.fn();
  const searchConversations = jest.fn();
  const listConversationMessages = jest.fn();
  const sendMessage = jest.fn();
  const markConversationRead = jest.fn();
  const syncClientContact = jest.fn();
  const listClientContactLinks = jest.fn();
  const getClientContactLink = jest.fn();
  const linkClientToContact = jest.fn();
  const unlinkClientContact = jest.fn();
  const listUnlinkedConversations = jest.fn();
  const resolveUnlinkedConversation = jest.fn();

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
            ingestProviderWebhook,
            listSuppressions,
            upsertSuppressions,
            removeSuppressions,
          },
        },
        {
          provide: CommunicationsChatsService,
          useValue: {
            getProviderHealth,
            syncMirror,
            ingestQuoWebhook,
            listConversations,
            searchConversations,
            listConversationMessages,
            sendMessage,
            markConversationRead,
            syncClientContact,
            listClientContactLinks,
            getClientContactLink,
            linkClientToContact,
            unlinkClientContact,
            listUnlinkedConversations,
            resolveUnlinkedConversation,
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

  it('forwards provider webhook events with signature header', async () => {
    ingestProviderWebhook.mockReturnValue({
      accepted: true,
      provider: 'quo',
      campaignId: 'c-9',
      eventType: 'delivered',
    });
    const controller = await createController();
    const payload = {
      event: 'message.delivered',
      data: { campaignId: 'c-9', to: '+15145550000' },
    };

    expect(controller.ingestProviderWebhook('quo', 'abc123', payload)).toEqual({
      accepted: true,
      provider: 'quo',
      campaignId: 'c-9',
      eventType: 'delivered',
    });
    expect(ingestProviderWebhook).toHaveBeenCalledWith(
      'quo',
      payload,
      'abc123',
    );
  });

  it('returns chats provider health status', async () => {
    getProviderHealth.mockResolvedValue({
      provider: 'quo',
      configured: true,
      connected: true,
      mirror: {
        conversations: 0,
        messages: 0,
        clientLinks: 0,
        cursors: 0,
      },
    });
    const controller = await createController();

    await expect(controller.getChatsHealth()).resolves.toMatchObject({
      provider: 'quo',
      configured: true,
      connected: true,
    });
    expect(getProviderHealth).toHaveBeenCalledTimes(1);
  });

  it('forwards manual chat sync requests', async () => {
    syncMirror.mockResolvedValue({
      mode: 'incremental',
      mirrored: { conversations: 1, messages: 2 },
    });
    const controller = await createController();

    await expect(
      controller.syncChats({ mode: 'incremental', maxConversations: 20 }),
    ).resolves.toMatchObject({
      mode: 'incremental',
      mirrored: { conversations: 1, messages: 2 },
    });
    expect(syncMirror).toHaveBeenCalledWith({
      mode: 'incremental',
      maxConversations: 20,
    });
  });

  it('forwards quo chat webhooks with signature header', async () => {
    ingestQuoWebhook.mockReturnValue({
      accepted: true,
      provider: 'quo',
      duplicate: false,
    });
    const controller = await createController();
    const payload = {
      event: 'message.delivered',
      data: { conversationId: 'conv-1', messageId: 'msg-1' },
    };

    expect(controller.ingestQuoChatWebhook('sig-123', payload)).toMatchObject({
      accepted: true,
      provider: 'quo',
      duplicate: false,
    });
    expect(ingestQuoWebhook).toHaveBeenCalledWith(payload, 'sig-123');
  });

  it('forwards chat conversation listing and search queries', async () => {
    listConversations.mockReturnValue({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
    searchConversations.mockReturnValue({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
    const controller = await createController();

    expect(
      controller.listChatConversations({
        limit: 25,
        offset: 0,
        query: 'abi',
      }),
    ).toEqual({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
    expect(
      controller.searchChatConversations({
        limit: 25,
        offset: 10,
        query: 'karam',
      }),
    ).toEqual({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });
    expect(listConversations).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      query: 'abi',
    });
    expect(searchConversations).toHaveBeenCalledWith({
      limit: 25,
      offset: 10,
      query: 'karam',
    });
  });

  it('forwards chat thread, send message, and read-state endpoints', async () => {
    listConversationMessages.mockReturnValue({
      conversationId: 'conv-1',
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });
    sendMessage.mockResolvedValue({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      sentAt: '2026-04-23T15:00:00.000Z',
    });
    markConversationRead.mockReturnValue({
      conversationId: 'conv-1',
      readAt: '2026-04-23T15:00:00.000Z',
    });
    const controller = await createController();

    expect(
      controller.listChatMessages('conv-1', {
        limit: 10,
        offset: 5,
      }),
    ).toEqual({
      conversationId: 'conv-1',
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });
    await expect(
      controller.sendChatMessage('conv-1', {
        content: 'Hello there',
      }),
    ).resolves.toEqual({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      sentAt: '2026-04-23T15:00:00.000Z',
    });
    expect(
      controller.markChatConversationRead('conv-1', {
        readAt: '2026-04-23T15:00:00.000Z',
      }),
    ).toEqual({
      conversationId: 'conv-1',
      readAt: '2026-04-23T15:00:00.000Z',
    });
    expect(listConversationMessages).toHaveBeenCalledWith('conv-1', {
      limit: 10,
      offset: 5,
    });
    expect(sendMessage).toHaveBeenCalledWith('conv-1', {
      content: 'Hello there',
    });
    expect(markConversationRead).toHaveBeenCalledWith('conv-1', {
      readAt: '2026-04-23T15:00:00.000Z',
    });
  });

  it('forwards chat client-link sync and manual link/unlink endpoints', async () => {
    syncClientContact.mockResolvedValue({
      clientId: 'client-1',
      quoContactId: 'contact-1',
      source: 'entries-auto-sync',
      status: 'linked-existing',
    });
    listClientContactLinks.mockReturnValue([
      {
        clientId: 'client-1',
        quoContactId: 'contact-1',
        source: 'manual-link',
        updatedAt: '2026-04-24T15:00:00.000Z',
      },
    ]);
    getClientContactLink.mockReturnValue({
      clientId: 'client-1',
      quoContactId: 'contact-1',
      source: 'manual-link',
      updatedAt: '2026-04-24T15:00:00.000Z',
    });
    linkClientToContact.mockResolvedValue({
      clientId: 'client-1',
      quoContactId: 'contact-2',
      source: 'manual-link',
      updatedAt: '2026-04-24T15:10:00.000Z',
    });
    unlinkClientContact.mockReturnValue({ removed: true });
    const controller = await createController();

    await expect(
      controller.syncChatClientContact({
        clientId: 'client-1',
        firstName: 'Karam',
        phone: '(514) 555-0101',
      }),
    ).resolves.toMatchObject({
      clientId: 'client-1',
      quoContactId: 'contact-1',
      status: 'linked-existing',
    });
    expect(controller.listChatClientLinks()).toHaveLength(1);
    expect(controller.getChatClientLink('client-1')).toMatchObject({
      clientId: 'client-1',
      quoContactId: 'contact-1',
    });
    await expect(
      controller.linkChatClientContact('client-1', {
        quoContactId: 'contact-2',
      }),
    ).resolves.toMatchObject({
      clientId: 'client-1',
      quoContactId: 'contact-2',
    });
    expect(controller.unlinkChatClientContact('client-1')).toEqual({
      removed: true,
    });

    expect(syncClientContact).toHaveBeenCalledWith({
      clientId: 'client-1',
      firstName: 'Karam',
      phone: '(514) 555-0101',
    });
    expect(getClientContactLink).toHaveBeenCalledWith('client-1');
    expect(linkClientToContact).toHaveBeenCalledWith('client-1', {
      quoContactId: 'contact-2',
    });
    expect(unlinkClientContact).toHaveBeenCalledWith('client-1');
  });

  it('forwards unlinked conversation queue and resolve actions', async () => {
    listUnlinkedConversations.mockReturnValue({
      items: [
        {
          conversationId: 'conv-1',
          quoContactId: null,
          displayName: null,
          participantPhone: '+15145550000',
          lastMessageAt: '2026-04-24T12:00:00.000Z',
          unreadCount: 2,
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    });
    resolveUnlinkedConversation.mockResolvedValue({
      conversationId: 'conv-1',
      clientId: 'client-1',
      quoContactId: 'contact-1',
      source: 'manual-resolve',
      linkedAt: '2026-04-24T12:05:00.000Z',
    });
    const controller = await createController();

    expect(
      controller.listUnlinkedChatConversations({
        limit: 10,
        offset: 0,
        query: '514',
      }),
    ).toMatchObject({
      total: 1,
      limit: 10,
      offset: 0,
    });
    await expect(
      controller.resolveUnlinkedChatConversation('conv-1', {
        clientId: 'client-1',
      }),
    ).resolves.toMatchObject({
      conversationId: 'conv-1',
      clientId: 'client-1',
      quoContactId: 'contact-1',
    });

    expect(listUnlinkedConversations).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      query: '514',
    });
    expect(resolveUnlinkedConversation).toHaveBeenCalledWith('conv-1', {
      clientId: 'client-1',
    });
  });
});
