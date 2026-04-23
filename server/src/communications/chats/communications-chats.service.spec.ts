import { CommunicationsChatsService } from './communications-chats.service';
import { QuoApiRequestError } from './quo-chat-client.service';

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
});
