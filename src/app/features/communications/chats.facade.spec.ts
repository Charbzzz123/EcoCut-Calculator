import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type {
  ChatConversationListResult,
  ChatConversationSummary,
  ChatMessageListResult,
  ChatProviderHealth,
} from '@shared/domain/communications/chats-api.service.js';
import { ChatsApiService } from '@shared/domain/communications/chats-api.service.js';
import { ChatsFacade } from './chats.facade.js';

const conversations: ChatConversationSummary[] = [
  {
    conversationId: 'conv-1',
    displayName: 'Alex North',
    participantPhone: '+15145550101',
    lastMessageAt: '2026-04-24T12:00:00.000Z',
    lastMessagePreview: 'Can you come tomorrow?',
    lastMessageDirection: 'inbound',
    unreadCount: 2,
  },
  {
    conversationId: 'conv-2',
    displayName: null,
    participantPhone: '+15145550202',
    lastMessageAt: '2026-04-23T12:00:00.000Z',
    lastMessagePreview: 'Thanks',
    lastMessageDirection: 'outbound',
    unreadCount: 0,
  },
];

const conversationResult: ChatConversationListResult = {
  items: conversations,
  total: conversations.length,
  limit: 40,
  offset: 0,
};

const messageResult: ChatMessageListResult = {
  conversationId: 'conv-1',
  total: 2,
  limit: 80,
  offset: 0,
  items: [
    {
      messageId: 'msg-new',
      conversationId: 'conv-1',
      direction: 'inbound',
      content: 'Newer',
      from: '+15145550101',
      to: '+14388007177',
      createdAt: '2026-04-24T12:05:00.000Z',
    },
    {
      messageId: 'msg-old',
      conversationId: 'conv-1',
      direction: 'outbound',
      content: 'Older',
      from: '+14388007177',
      to: '+15145550101',
      createdAt: '2026-04-24T12:01:00.000Z',
    },
  ],
};

const health: ChatProviderHealth = {
  provider: 'quo',
  configured: true,
  connected: true,
  checkedAt: '2026-04-24T12:00:00.000Z',
  lastSyncAt: '2026-04-24T11:00:00.000Z',
  rateLimitPerSecond: 10,
  phoneNumber: '+14388007177',
  details: 'Connection successful.',
  mirror: { conversations: 2, messages: 4, clientLinks: 1, cursors: 2 },
};

const syncResult = {
  mode: 'incremental' as const,
  startedAt: '2026-04-24T12:00:00.000Z',
  completedAt: '2026-04-24T12:00:01.000Z',
  durationMs: 1000,
  truncated: false,
  scanned: { conversations: 3, messages: 9 },
  mirrored: { conversations: 2, messages: 5 },
  mirror: { conversations: 2, messages: 5, clientLinks: 1, cursors: 2 },
};

const createApiMock = () => ({
  getHealth: vi.fn().mockResolvedValue(health),
  syncChats: vi.fn().mockResolvedValue(syncResult),
  listConversations: vi.fn().mockResolvedValue(conversationResult),
  searchConversations: vi.fn().mockResolvedValue(conversationResult),
  listMessages: vi.fn().mockResolvedValue(messageResult),
  markConversationRead: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue({
    conversationId: 'conv-1',
    messageId: 'msg-sent',
    sentAt: '2026-04-24T12:10:00.000Z',
  }),
});

describe('ChatsFacade', () => {
  let facade: ChatsFacade;
  let api: ReturnType<typeof createApiMock>;

  beforeEach(() => {
    api = createApiMock();
    TestBed.configureTestingModule({
      providers: [ChatsFacade, { provide: ChatsApiService, useValue: api }],
    });
    facade = TestBed.inject(ChatsFacade);
  });

  it('loads health and conversations on init', async () => {
    await facade.init();

    expect(api.getHealth).toHaveBeenCalled();
    expect(api.listConversations).toHaveBeenCalledWith({ limit: 40 });
    expect(facade.conversations()).toHaveLength(2);
    expect(facade.conversationTotal()).toBe(2);
    expect(facade.unreadTotal()).toBe(2);
  });

  it('syncs Quo chats and refreshes the mirror state', async () => {
    await facade.init();

    await facade.syncChats();

    expect(api.syncChats).toHaveBeenCalled();
    expect(api.getHealth).toHaveBeenCalledTimes(2);
    expect(api.listConversations).toHaveBeenCalledTimes(2);
    expect(facade.syncState()).toBe('synced');
    expect(facade.lastSyncResult()).toMatchObject({ mirrored: { conversations: 2, messages: 5 } });
  });

  it('does not start a second sync while one is running', async () => {
    let resolveSync: (value: typeof syncResult) => void = () => undefined;
    api.syncChats.mockReturnValueOnce(
      new Promise<typeof syncResult>((resolve) => {
        resolveSync = resolve;
      }),
    );

    const firstSync = facade.syncChats();
    const secondSync = facade.syncChats();

    expect(api.syncChats).toHaveBeenCalledTimes(1);
    resolveSync(syncResult);
    await Promise.all([firstSync, secondSync]);
    expect(facade.syncState()).toBe('synced');
  });

  it('surfaces sync failures', async () => {
    api.syncChats.mockRejectedValueOnce(new Error('sync failed'));

    await facade.syncChats();

    expect(facade.syncState()).toBe('failed');
    expect(facade.lastSyncResult()).toBeNull();
    expect(facade.error()).toContain('Unable to sync');
  });

  it('searches conversations after debounce', async () => {
    await facade.init();
    facade.searchControl.setValue('a');
    facade.searchControl.setValue('alex');
    await new Promise((resolve) => setTimeout(resolve, 320));

    expect(api.searchConversations).toHaveBeenCalledWith({ query: 'alex', limit: 40 });
    expect(api.searchConversations).toHaveBeenCalledTimes(1);
  });

  it('selects a conversation, sorts messages, and marks it read', async () => {
    await facade.init();

    await facade.selectConversation('conv-1');

    expect(api.listMessages).toHaveBeenCalledWith('conv-1', { limit: 80 });
    expect(api.markConversationRead).toHaveBeenCalledWith('conv-1');
    expect(facade.messages().map((message) => message.messageId)).toEqual(['msg-old', 'msg-new']);
    expect(facade.conversations()[0].unreadCount).toBe(0);
  });

  it('sends a reply and appends the sent message', async () => {
    await facade.init();
    await facade.selectConversation('conv-1');
    facade.composerControl.setValue('See you soon');

    await facade.sendMessage();

    expect(api.sendMessage).toHaveBeenCalledWith('conv-1', 'See you soon', '+15145550101');
    expect(facade.sendState()).toBe('sent');
    expect(facade.messages().at(-1)).toMatchObject({ messageId: 'msg-sent', content: 'See you soon' });
    expect(facade.composerControl.value).toBe('');
  });

  it('resets sent state when a new draft starts', async () => {
    await facade.init();
    await facade.selectConversation('conv-1');
    facade.composerControl.setValue('Initial reply');
    await facade.sendMessage();

    facade.composerControl.setValue('Next reply');

    expect(facade.sendState()).toBe('idle');
    expect(facade.canSend()).toBe(true);
  });

  it('does not send without an active conversation or message content', async () => {
    await facade.init();

    await facade.sendMessage();

    expect(api.sendMessage).not.toHaveBeenCalled();

    await facade.selectConversation('conv-1');
    await facade.sendMessage();

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('surfaces load and send failures', async () => {
    api.listConversations.mockRejectedValueOnce(new Error('load failed'));
    await facade.loadConversations();
    expect(facade.conversationsState()).toBe('error');
    expect(facade.error()).toContain('Unable to load');

    api.listConversations.mockResolvedValueOnce(conversationResult);
    await facade.loadConversations();
    await facade.selectConversation('conv-1');
    api.sendMessage.mockRejectedValueOnce(new Error('send failed'));
    facade.composerControl.setValue('Retry me');

    await facade.sendMessage();

    expect(facade.sendState()).toBe('failed');
    expect(facade.error()).toContain('Unable to send');
  });

  it('surfaces health and thread failures without breaking the inbox', async () => {
    api.getHealth.mockRejectedValueOnce(new Error('offline'));
    await facade.refreshHealth();
    expect(facade.health()).toBeNull();

    await facade.init();
    api.listMessages.mockRejectedValueOnce(new Error('messages failed'));

    await facade.selectConversation('conv-1');

    expect(facade.threadState()).toBe('error');
    expect(facade.error()).toContain('Unable to load this conversation');
  });

  it('clears the active thread when refreshed results omit it', async () => {
    await facade.init();
    await facade.selectConversation('conv-1');
    api.listConversations.mockResolvedValueOnce({ items: [conversations[1]], total: 1, limit: 40, offset: 0 });

    await facade.loadConversations();

    expect(facade.selectedConversation()).toBeNull();
    expect(facade.messages()).toEqual([]);
  });

  it('sorts undated messages before dated messages', async () => {
    api.listMessages.mockResolvedValueOnce({
      ...messageResult,
      items: [
        { ...messageResult.items[0], messageId: 'dated', createdAt: '2026-04-24T12:05:00.000Z' },
        { ...messageResult.items[1], messageId: 'undated', createdAt: null },
      ],
    });
    await facade.init();

    await facade.selectConversation('conv-1');

    expect(facade.messages().map((message) => message.messageId)).toEqual(['undated', 'dated']);
  });

  it('sorts dated messages before undated later items when needed', async () => {
    api.listMessages.mockResolvedValueOnce({
      ...messageResult,
      items: [
        { ...messageResult.items[1], messageId: 'undated', createdAt: null },
        { ...messageResult.items[0], messageId: 'dated', createdAt: '2026-04-24T12:05:00.000Z' },
      ],
    });
    await facade.init();

    await facade.selectConversation('conv-1');

    expect(facade.messages().map((message) => message.messageId)).toEqual(['undated', 'dated']);
  });

  it('clears the active thread state', async () => {
    await facade.init();
    await facade.selectConversation('conv-1');
    facade.composerControl.setValue('Draft');

    facade.clearThread();

    expect(facade.selectedConversation()).toBeNull();
    expect(facade.messages()).toEqual([]);
    expect(facade.composerControl.value).toBe('');
  });
});
