import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { CommunicationsChatsService } from './communications-chats.service';
import { QuoApiRequestError } from './quo-chat-client.service';

const ORIGINAL_ENV = { ...process.env };

describe('CommunicationsChatsService', () => {
  const mirror = {
    conversations: 1,
    messages: 2,
    clientLinks: 3,
    cursors: 4,
  } as const;

  const createRepository = () => ({
    getMirrorStats: jest.fn(() => mirror),
    getSyncCursor: jest.fn((key: string) => {
      if (key === 'sync.lastCompletedAt') {
        return '2026-04-23T12:00:00.000Z';
      }
      if (key === 'conversations.lastMessageAt') {
        return '2026-04-23T11:00:00.000Z';
      }
      if (key === 'messages.lastCreatedAt') {
        return '2026-04-23T11:05:00.000Z';
      }
      return null;
    }),
    saveSyncCursor: jest.fn(),
    upsertConversations: jest.fn((items: unknown[]) => items.length),
    upsertMessages: jest.fn((_: string, items: unknown[]) => items.length),
    clearMirrorData: jest.fn(),
    listMirrorConversations: jest.fn(() => []),
    countMirrorConversations: jest.fn(() => 0),
    listMirrorMessages: jest.fn(() => []),
    countMirrorMessages: jest.fn(() => 0),
    hasConversation: jest.fn(() => true),
    markConversationRead: jest.fn(),
    getMirrorConversationById: jest.fn(() => null),
    recordWebhookEvent: jest.fn(() => ({
      inserted: true,
      receivedAt: '2026-04-23T12:30:00.000Z',
    })),
  });

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.QUO_WEBHOOK_SECRET;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns not configured when QUO credentials are missing', async () => {
    const client = {
      isConfigured: jest.fn(() => false),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => null),
    };
    const repository = createRepository();
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    await expect(service.getProviderHealth()).resolves.toMatchObject({
      provider: 'quo',
      configured: false,
      connected: false,
      phoneNumber: null,
      mirror,
      lastSyncAt: '2026-04-23T12:00:00.000Z',
    });
    expect(client.listPhoneNumbers).not.toHaveBeenCalled();
  });

  it('returns connected status when provider responds', async () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(() =>
        Promise.resolve({
          data: [{ formattedNumber: '(438) 800-7177' }],
        }),
      ),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    await expect(service.getProviderHealth()).resolves.toMatchObject({
      provider: 'quo',
      configured: true,
      connected: true,
      phoneNumber: '(438) 800-7177',
      mirror,
      lastSyncAt: '2026-04-23T12:00:00.000Z',
    });
  });

  it('maps auth errors into actionable health details', async () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(() =>
        Promise.reject(new QuoApiRequestError(401, 'Unauthorized')),
      ),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    await expect(service.getProviderHealth()).resolves.toMatchObject({
      provider: 'quo',
      configured: true,
      connected: false,
      phoneNumber: '+14388007177',
      details: 'Authentication failed. Verify QUO_API_KEY and number/user IDs.',
      mirror,
    });
  });

  it('runs incremental mirror sync with cursor filtering', async () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
      listConversations: jest.fn(() =>
        Promise.resolve({
          data: [
            {
              id: 'conv-fresh',
              lastMessageAt: '2026-04-23T12:10:00.000Z',
            },
            {
              id: 'conv-old',
              lastMessageAt: '2026-04-23T10:00:00.000Z',
            },
          ],
          hasNextPage: false,
          nextPageToken: null,
        }),
      ),
      listMessages: jest.fn(() =>
        Promise.resolve({
          data: [
            {
              id: 'msg-fresh',
              createdAt: '2026-04-23T12:11:00.000Z',
            },
            {
              id: 'msg-old',
              createdAt: '2026-04-23T10:55:00.000Z',
            },
          ],
          hasNextPage: false,
          nextPageToken: null,
        }),
      ),
    };
    const repository = createRepository();
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    const result = await service.syncMirror({
      mode: 'incremental',
      conversationPageSize: 10,
      messagePageSize: 10,
      maxConversations: 20,
    });

    expect(client.listConversations).toHaveBeenCalledWith(undefined, 10);
    expect(client.listMessages).toHaveBeenCalledWith(
      'conv-fresh',
      undefined,
      10,
    );
    expect(repository.upsertConversations).toHaveBeenCalledWith([
      {
        id: 'conv-fresh',
        lastMessageAt: '2026-04-23T12:10:00.000Z',
      },
    ]);
    expect(repository.upsertMessages).toHaveBeenCalledWith('conv-fresh', [
      {
        id: 'msg-fresh',
        createdAt: '2026-04-23T12:11:00.000Z',
      },
    ]);
    expect(repository.saveSyncCursor).toHaveBeenCalledWith(
      'conversations.lastMessageAt',
      '2026-04-23T12:10:00.000Z',
    );
    expect(repository.saveSyncCursor).toHaveBeenCalledWith(
      'messages.lastCreatedAt',
      '2026-04-23T12:11:00.000Z',
    );
    expect(repository.saveSyncCursor).toHaveBeenCalledWith(
      'sync.lastCompletedAt',
      result.completedAt,
    );
    expect(result.mirrored).toEqual({ conversations: 1, messages: 1 });
  });

  it('runs reset mode by clearing mirror data before syncing', async () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
      listConversations: jest.fn(() =>
        Promise.resolve({
          data: [],
          hasNextPage: false,
          nextPageToken: null,
        }),
      ),
      listMessages: jest.fn(),
    };
    const repository = createRepository();
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    const result = await service.syncMirror({ mode: 'reset' });

    expect(repository.clearMirrorData).toHaveBeenCalledWith({
      preserveClientLinks: true,
    });
    expect(result.mode).toBe('reset');
  });

  it('lists mirrored conversations with unread metadata', () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    repository.listMirrorConversations.mockReturnValue([
      {
        conversation_id: 'conv-1',
        last_message_at: '2026-04-23T13:00:00.000Z',
        conversation_payload: JSON.stringify({ displayName: 'Karam' }),
        last_read_at: '2026-04-23T12:00:00.000Z',
        last_message_payload: JSON.stringify({
          content: 'Bonjour',
          direction: 'inbound',
          from: '+15145550000',
        }),
        last_message_created_at: '2026-04-23T13:00:00.000Z',
        unread_count: 2,
      },
    ]);
    repository.countMirrorConversations.mockReturnValue(1);
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    expect(
      service.listConversations({ limit: 20, offset: 0, query: 'karam' }),
    ).toEqual({
      items: [
        {
          conversationId: 'conv-1',
          displayName: 'Karam',
          participantPhone: '+15145550000',
          lastMessageAt: '2026-04-23T13:00:00.000Z',
          lastMessagePreview: 'Bonjour',
          lastMessageDirection: 'inbound',
          unreadCount: 2,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    expect(repository.listMirrorConversations).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      query: 'karam',
    });
  });

  it('lists conversation messages with pagination', () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    repository.listMirrorMessages.mockReturnValue([
      {
        message_id: 'msg-1',
        conversation_id: 'conv-1',
        created_at: '2026-04-23T13:00:00.000Z',
        payload: JSON.stringify({
          content: 'Allo',
          direction: 'outbound',
          from: '+14388007177',
          to: '+15145550000',
        }),
      },
    ]);
    repository.countMirrorMessages.mockReturnValue(1);
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    expect(
      service.listConversationMessages('conv-1', { limit: 10, offset: 0 }),
    ).toEqual({
      conversationId: 'conv-1',
      items: [
        {
          messageId: 'msg-1',
          conversationId: 'conv-1',
          direction: 'outbound',
          content: 'Allo',
          from: '+14388007177',
          to: '+15145550000',
          createdAt: '2026-04-23T13:00:00.000Z',
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    });
  });

  it('marks a mirrored conversation as read', () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    expect(
      service.markConversationRead('conv-1', {
        readAt: '2026-04-23T14:00:00.000Z',
      }),
    ).toEqual({
      conversationId: 'conv-1',
      readAt: '2026-04-23T14:00:00.000Z',
    });
    expect(repository.markConversationRead).toHaveBeenCalledWith(
      'conv-1',
      '2026-04-23T14:00:00.000Z',
    );
  });

  it('sends messages using inferred recipient phone when dto.to is absent', async () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
      sendTextMessage: jest.fn(() => Promise.resolve('msg-out-1')),
    };
    const repository = createRepository();
    repository.listMirrorMessages.mockReturnValue([
      {
        message_id: 'msg-in-1',
        conversation_id: 'conv-1',
        created_at: '2026-04-23T14:00:00.000Z',
        payload: JSON.stringify({
          direction: 'inbound',
          from: '+15145550000',
          content: 'Need quote update',
        }),
      },
    ]);
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    await expect(
      service.sendMessage('conv-1', {
        content: 'We are on our way',
      }),
    ).resolves.toMatchObject({
      conversationId: 'conv-1',
      messageId: 'msg-out-1',
    });
    expect(client.sendTextMessage).toHaveBeenCalledWith({
      to: '+15145550000',
      content: 'We are on our way',
    });
    expect(repository.upsertMessages).toHaveBeenCalledWith(
      'conv-1',
      expect.arrayContaining([
        expect.objectContaining({
          id: 'msg-out-1',
          direction: 'outbound',
        }),
      ]),
    );
  });

  it('throws when attempting chat actions on unknown conversations', () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    repository.hasConversation.mockReturnValue(false);
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    expect(() =>
      service.listConversationMessages('missing-conv', { limit: 10 }),
    ).toThrow('missing-conv');
  });

  it('ingests quo webhook and mirrors message data', () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    repository.getSyncCursor.mockReturnValue(null);
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    const result = service.ingestQuoWebhook(
      {
        id: 'evt-1',
        event: 'message.received',
        data: {
          conversationId: 'conv-1',
          messageId: 'msg-1',
          content: 'Hello',
          timestamp: '2026-04-23T12:20:00.000Z',
          from: '+15145550000',
        },
      },
      undefined,
    );

    expect(repository.recordWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventId: 'evt-1',
        eventType: 'message.received',
        messageId: 'msg-1',
        conversationId: 'conv-1',
      }),
    );
    expect(repository.upsertConversations).toHaveBeenCalledWith([
      {
        id: 'conv-1',
        lastMessageAt: '2026-04-23T12:20:00.000Z',
      },
    ]);
    expect(repository.upsertMessages).toHaveBeenCalledWith('conv-1', [
      expect.objectContaining({
        id: 'msg-1',
        conversationId: 'conv-1',
        direction: 'inbound',
      }),
    ]);
    expect(result.duplicate).toBe(false);
    expect(result.mirrored).toEqual({ conversations: 1, messages: 1 });
  });

  it('returns duplicate result without re-mirroring when webhook already seen', () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    repository.recordWebhookEvent.mockReturnValue({
      inserted: false,
      receivedAt: '2026-04-23T12:20:00.000Z',
    });
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    const result = service.ingestQuoWebhook(
      {
        event: 'message.delivered',
        data: {
          conversationId: 'conv-1',
          messageId: 'msg-1',
          timestamp: '2026-04-23T12:20:00.000Z',
        },
      },
      undefined,
    );

    expect(result.duplicate).toBe(true);
    expect(repository.upsertConversations).not.toHaveBeenCalled();
    expect(repository.upsertMessages).not.toHaveBeenCalled();
  });

  it('enforces signature validation when QUO_WEBHOOK_SECRET is configured', () => {
    process.env.QUO_WEBHOOK_SECRET = 'test-secret';
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = createRepository();
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );
    const payload = {
      event: 'message.received',
      data: { conversationId: 'conv-1', messageId: 'msg-1' },
    };
    const validSignature = createHmac('sha256', 'test-secret')
      .update(JSON.stringify(payload))
      .digest('hex');

    expect(() => service.ingestQuoWebhook(payload, undefined)).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.ingestQuoWebhook(payload, 'invalid-signature'),
    ).toThrow(BadRequestException);
    expect(() =>
      service.ingestQuoWebhook(payload, validSignature),
    ).not.toThrow();
  });
});
