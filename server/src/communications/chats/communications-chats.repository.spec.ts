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
});
