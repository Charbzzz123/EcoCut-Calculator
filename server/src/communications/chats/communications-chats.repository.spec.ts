import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommunicationsChatsRepository } from './communications-chats.repository';

describe('CommunicationsChatsRepository', () => {
  const originalDbPath = process.env.COMMUNICATIONS_DB_PATH;

  let tempDir: string;
  let repository: CommunicationsChatsRepository;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ecocut-chats-'));
    process.env.COMMUNICATIONS_DB_PATH = join(tempDir, 'communications.db');
    repository = new CommunicationsChatsRepository();
  });

  afterEach(() => {
    repository.onModuleDestroy();
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDbPath) {
      process.env.COMMUNICATIONS_DB_PATH = originalDbPath;
      return;
    }
    delete process.env.COMMUNICATIONS_DB_PATH;
  });

  it('upserts conversations and messages idempotently', () => {
    expect(
      repository.upsertConversations([
        {
          id: 'conv-1',
          displayName: 'Client thread',
          lastMessageAt: '2026-04-23T10:00:00.000Z',
        },
      ]),
    ).toBe(1);
    expect(
      repository.upsertConversations([
        {
          id: 'conv-1',
          displayName: 'Client thread (renamed)',
          lastMessageAt: '2026-04-23T11:00:00.000Z',
        },
      ]),
    ).toBe(1);

    expect(
      repository.upsertMessages('conv-1', [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'hello',
          createdAt: '2026-04-23T10:00:00.000Z',
        },
      ]),
    ).toBe(1);
    expect(
      repository.upsertMessages('conv-1', [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          content: 'updated',
          createdAt: '2026-04-23T10:00:00.000Z',
        },
      ]),
    ).toBe(1);

    expect(repository.getMirrorStats()).toEqual({
      conversations: 1,
      messages: 1,
      clientLinks: 0,
      cursors: 0,
    });
  });

  it('stores client links and sync cursors', () => {
    repository.upsertClientContactLink({
      clientId: 'client-1',
      quoContactId: 'contact-1',
      source: 'auto',
    });
    repository.upsertClientContactLink({
      clientId: 'client-1',
      quoContactId: 'contact-2',
      source: 'manual',
    });

    expect(repository.getClientContactLink('client-1')).toMatchObject({
      clientId: 'client-1',
      quoContactId: 'contact-2',
      source: 'manual',
    });

    repository.saveSyncCursor('conversations:global', 'cursor-123');
    expect(repository.getSyncCursor('conversations:global')).toBe('cursor-123');

    expect(repository.getMirrorStats()).toEqual({
      conversations: 0,
      messages: 0,
      clientLinks: 1,
      cursors: 1,
    });

    repository.removeClientContactLink('client-1');
    expect(repository.getClientContactLink('client-1')).toBeNull();
    expect(repository.getMirrorStats().clientLinks).toBe(0);
  });

  it('clears mirror rows and optionally preserves client links', () => {
    repository.upsertConversations([
      { id: 'conv-1', lastMessageAt: '2026-04-23T10:00:00.000Z' },
    ]);
    repository.upsertMessages('conv-1', [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        createdAt: '2026-04-23T10:01:00.000Z',
      },
    ]);
    repository.upsertClientContactLink({
      clientId: 'client-1',
      quoContactId: 'contact-1',
      source: 'auto',
    });
    repository.saveSyncCursor('cursor-key', 'cursor-value');

    repository.clearMirrorData({ preserveClientLinks: true });
    expect(repository.getMirrorStats()).toEqual({
      conversations: 0,
      messages: 0,
      clientLinks: 1,
      cursors: 0,
    });

    repository.clearMirrorData({ preserveClientLinks: false });
    expect(repository.getMirrorStats()).toEqual({
      conversations: 0,
      messages: 0,
      clientLinks: 0,
      cursors: 0,
    });
  });

  it('deduplicates webhook events by provider event id', () => {
    const first = repository.recordWebhookEvent({
      provider: 'quo',
      providerEventId: 'evt-1',
      eventType: 'message.received',
      messageId: 'msg-1',
      conversationId: 'conv-1',
      occurredAt: '2026-04-23T12:00:00.000Z',
      payload: { event: 'message.received' },
    });
    const second = repository.recordWebhookEvent({
      provider: 'quo',
      providerEventId: 'evt-1',
      eventType: 'message.received',
      messageId: 'msg-1',
      conversationId: 'conv-1',
      occurredAt: '2026-04-23T12:00:00.000Z',
      payload: { event: 'message.received' },
    });

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
  });

  it('lists conversations/messages and tracks read state', () => {
    repository.upsertConversations([
      {
        id: 'conv-1',
        displayName: 'Karam',
        lastMessageAt: '2026-04-23T13:00:00.000Z',
      },
      {
        id: 'conv-2',
        displayName: 'Maryam',
        lastMessageAt: '2026-04-23T14:00:00.000Z',
      },
    ]);
    repository.upsertMessages('conv-1', [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        direction: 'inbound',
        from: '+15145550000',
        content: 'Hi',
        createdAt: '2026-04-23T13:00:00.000Z',
      },
    ]);
    repository.upsertMessages('conv-2', [
      {
        id: 'msg-2',
        conversationId: 'conv-2',
        direction: 'outbound',
        to: '+15145551111',
        content: 'Hello',
        createdAt: '2026-04-23T14:00:00.000Z',
      },
    ]);

    expect(repository.countMirrorConversations('')).toBe(2);
    expect(
      repository.listMirrorConversations({
        limit: 10,
        offset: 0,
        query: 'karam',
      }),
    ).toHaveLength(1);
    expect(
      repository.listMirrorMessages({
        conversationId: 'conv-1',
        limit: 10,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(repository.countMirrorMessages('conv-1')).toBe(1);
    expect(repository.hasConversation('conv-1')).toBe(true);
    expect(repository.hasConversation('conv-missing')).toBe(false);

    repository.markConversationRead('conv-1', '2026-04-23T13:10:00.000Z');
    const row = repository.getMirrorConversationById('conv-1');
    expect(row?.unread_count).toBe(0);
  });
});
