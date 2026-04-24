import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveCommunicationsDbPath } from '../communications.db-path';
import type { QuoConversation, QuoMessage } from './quo-chat.types';

interface CountRow {
  count: number;
}

interface CursorRow {
  cursor_value: string;
}

interface ContactLinkRow {
  client_id: string;
  quo_contact_id: string;
  source: string;
  updated_at: string;
}

interface ConversationSummaryRow {
  conversation_id: string;
  last_message_at: string | null;
  conversation_payload: string;
  last_read_at: string;
  last_message_payload: string | null;
  last_message_created_at: string | null;
  unread_count: number;
}

interface ConversationCountRow {
  total: number;
}

interface MessageMirrorRow {
  message_id: string;
  conversation_id: string;
  created_at: string | null;
  payload: string;
}

interface WebhookInsertResult {
  changes: number;
}

interface ChatMirrorStats {
  conversations: number;
  messages: number;
  clientLinks: number;
  cursors: number;
}

interface UpsertClientContactLinkInput {
  clientId: string;
  quoContactId: string;
  source: string;
  updatedAt?: string;
}

interface ClearMirrorDataOptions {
  preserveClientLinks?: boolean;
}

interface RecordWebhookEventInput {
  provider: 'quo';
  providerEventId: string;
  eventType: string;
  messageId: string | null;
  conversationId: string | null;
  occurredAt: string | null;
  payload: unknown;
  receivedAt?: string;
}

interface RecordWebhookEventResult {
  inserted: boolean;
  receivedAt: string;
}

interface ListMirrorConversationsOptions {
  limit: number;
  offset: number;
  query: string;
}

interface ListMirrorMessagesOptions {
  conversationId: string;
  limit: number;
  offset: number;
}

@Injectable()
export class CommunicationsChatsRepository implements OnModuleDestroy {
  private readonly logger = new Logger(CommunicationsChatsRepository.name);
  private readonly dbPath = resolveCommunicationsDbPath();
  private readonly db: Database.Database;
  private readonly upsertConversationStmt: Database.Statement;
  private readonly upsertMessageStmt: Database.Statement;
  private readonly upsertClientLinkStmt: Database.Statement;
  private readonly removeClientLinkStmt: Database.Statement;
  private readonly selectClientLinkStmt: Database.Statement;
  private readonly upsertCursorStmt: Database.Statement;
  private readonly selectCursorStmt: Database.Statement;
  private readonly countConversationsStmt: Database.Statement;
  private readonly countMessagesStmt: Database.Statement;
  private readonly countClientLinksStmt: Database.Statement;
  private readonly countCursorsStmt: Database.Statement;
  private readonly clearMessagesStmt: Database.Statement;
  private readonly clearConversationsStmt: Database.Statement;
  private readonly clearClientLinksStmt: Database.Statement;
  private readonly clearCursorsStmt: Database.Statement;
  private readonly insertWebhookEventStmt: Database.Statement;
  private readonly listConversationSummariesStmt: Database.Statement;
  private readonly countConversationSummariesStmt: Database.Statement;
  private readonly selectConversationSummaryByIdStmt: Database.Statement;
  private readonly listMessagesForConversationStmt: Database.Statement;
  private readonly countMessagesForConversationStmt: Database.Statement;
  private readonly selectConversationExistsStmt: Database.Statement;
  private readonly upsertConversationReadStmt: Database.Statement;

  constructor() {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        conversation_id TEXT PRIMARY KEY,
        last_message_at TEXT,
        payload TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message_at
        ON chat_conversations(last_message_at);

      CREATE TABLE IF NOT EXISTS chat_messages (
        message_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        created_at TEXT,
        payload TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created_at
        ON chat_messages(conversation_id, created_at);

      CREATE TABLE IF NOT EXISTS chat_client_links (
        client_id TEXT PRIMARY KEY,
        quo_contact_id TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_sync_cursors (
        cursor_key TEXT PRIMARY KEY,
        cursor_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_webhook_events (
        provider_event_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message_id TEXT,
        conversation_id TEXT,
        occurred_at TEXT,
        payload TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_webhook_events_conversation
        ON chat_webhook_events(conversation_id, occurred_at);

      CREATE TABLE IF NOT EXISTS chat_conversation_reads (
        conversation_id TEXT PRIMARY KEY,
        last_read_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.upsertConversationStmt = this.db.prepare(
      `INSERT INTO chat_conversations (
         conversation_id,
         last_message_at,
         payload,
         synced_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         last_message_at = excluded.last_message_at,
         payload = excluded.payload,
         synced_at = excluded.synced_at,
         updated_at = excluded.updated_at`,
    );
    this.upsertMessageStmt = this.db.prepare(
      `INSERT INTO chat_messages (
         message_id,
         conversation_id,
         created_at,
         payload,
         synced_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET
         conversation_id = excluded.conversation_id,
         created_at = excluded.created_at,
         payload = excluded.payload,
         synced_at = excluded.synced_at,
         updated_at = excluded.updated_at`,
    );
    this.upsertClientLinkStmt = this.db.prepare(
      `INSERT INTO chat_client_links (
         client_id,
         quo_contact_id,
         source,
         updated_at
       ) VALUES (?, ?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET
         quo_contact_id = excluded.quo_contact_id,
         source = excluded.source,
         updated_at = excluded.updated_at`,
    );
    this.removeClientLinkStmt = this.db.prepare(
      'DELETE FROM chat_client_links WHERE client_id = ?',
    );
    this.selectClientLinkStmt = this.db.prepare(
      `SELECT client_id, quo_contact_id, source, updated_at
       FROM chat_client_links
       WHERE client_id = ?`,
    );
    this.upsertCursorStmt = this.db.prepare(
      `INSERT INTO chat_sync_cursors (
         cursor_key,
         cursor_value,
         updated_at
       ) VALUES (?, ?, ?)
       ON CONFLICT(cursor_key) DO UPDATE SET
         cursor_value = excluded.cursor_value,
         updated_at = excluded.updated_at`,
    );
    this.selectCursorStmt = this.db.prepare(
      'SELECT cursor_value FROM chat_sync_cursors WHERE cursor_key = ?',
    );
    this.countConversationsStmt = this.db.prepare(
      'SELECT COUNT(*) AS count FROM chat_conversations',
    );
    this.countMessagesStmt = this.db.prepare(
      'SELECT COUNT(*) AS count FROM chat_messages',
    );
    this.countClientLinksStmt = this.db.prepare(
      'SELECT COUNT(*) AS count FROM chat_client_links',
    );
    this.countCursorsStmt = this.db.prepare(
      'SELECT COUNT(*) AS count FROM chat_sync_cursors',
    );
    this.clearMessagesStmt = this.db.prepare('DELETE FROM chat_messages');
    this.clearConversationsStmt = this.db.prepare(
      'DELETE FROM chat_conversations',
    );
    this.clearClientLinksStmt = this.db.prepare(
      'DELETE FROM chat_client_links',
    );
    this.clearCursorsStmt = this.db.prepare('DELETE FROM chat_sync_cursors');
    this.insertWebhookEventStmt = this.db.prepare(
      `INSERT INTO chat_webhook_events (
         provider_event_id,
         provider,
         event_type,
         message_id,
         conversation_id,
         occurred_at,
         payload,
         received_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider_event_id) DO NOTHING`,
    );
    this.listConversationSummariesStmt = this.db.prepare(
      `SELECT
         c.conversation_id,
         c.last_message_at,
         c.payload AS conversation_payload,
         COALESCE(rs.last_read_at, '') AS last_read_at,
         lm.payload AS last_message_payload,
         lm.created_at AS last_message_created_at,
         (
           SELECT COUNT(*)
           FROM chat_messages m2
           WHERE m2.conversation_id = c.conversation_id
             AND COALESCE(m2.created_at, '') > COALESCE(rs.last_read_at, '')
             AND lower(COALESCE(json_extract(m2.payload, '$.direction'), '')) = 'inbound'
         ) AS unread_count
       FROM chat_conversations c
       LEFT JOIN chat_conversation_reads rs
         ON rs.conversation_id = c.conversation_id
       LEFT JOIN chat_messages lm
         ON lm.message_id = (
           SELECT m.message_id
           FROM chat_messages m
           WHERE m.conversation_id = c.conversation_id
           ORDER BY COALESCE(m.created_at, '') DESC, m.message_id DESC
           LIMIT 1
         )
       WHERE (? = '' OR lower(c.payload) LIKE ? OR lower(COALESCE(lm.payload, '')) LIKE ?)
       ORDER BY COALESCE(c.last_message_at, lm.created_at, c.updated_at) DESC, c.conversation_id DESC
       LIMIT ? OFFSET ?`,
    );
    this.countConversationSummariesStmt = this.db.prepare(
      `SELECT COUNT(*) AS total
       FROM chat_conversations c
       LEFT JOIN chat_messages lm
         ON lm.message_id = (
           SELECT m.message_id
           FROM chat_messages m
           WHERE m.conversation_id = c.conversation_id
           ORDER BY COALESCE(m.created_at, '') DESC, m.message_id DESC
           LIMIT 1
         )
       WHERE (? = '' OR lower(c.payload) LIKE ? OR lower(COALESCE(lm.payload, '')) LIKE ?)`,
    );
    this.selectConversationSummaryByIdStmt = this.db.prepare(
      `SELECT
         c.conversation_id,
         c.last_message_at,
         c.payload AS conversation_payload,
         COALESCE(rs.last_read_at, '') AS last_read_at,
         lm.payload AS last_message_payload,
         lm.created_at AS last_message_created_at,
         (
           SELECT COUNT(*)
           FROM chat_messages m2
           WHERE m2.conversation_id = c.conversation_id
             AND COALESCE(m2.created_at, '') > COALESCE(rs.last_read_at, '')
             AND lower(COALESCE(json_extract(m2.payload, '$.direction'), '')) = 'inbound'
         ) AS unread_count
       FROM chat_conversations c
       LEFT JOIN chat_conversation_reads rs
         ON rs.conversation_id = c.conversation_id
       LEFT JOIN chat_messages lm
         ON lm.message_id = (
           SELECT m.message_id
           FROM chat_messages m
           WHERE m.conversation_id = c.conversation_id
           ORDER BY COALESCE(m.created_at, '') DESC, m.message_id DESC
           LIMIT 1
         )
       WHERE c.conversation_id = ?
       LIMIT 1`,
    );
    this.listMessagesForConversationStmt = this.db.prepare(
      `SELECT
         message_id,
         conversation_id,
         created_at,
         payload
       FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY COALESCE(created_at, '') DESC, message_id DESC
       LIMIT ? OFFSET ?`,
    );
    this.countMessagesForConversationStmt = this.db.prepare(
      `SELECT COUNT(*) AS total
       FROM chat_messages
       WHERE conversation_id = ?`,
    );
    this.selectConversationExistsStmt = this.db.prepare(
      `SELECT COUNT(*) AS count
       FROM chat_conversations
       WHERE conversation_id = ?`,
    );
    this.upsertConversationReadStmt = this.db.prepare(
      `INSERT INTO chat_conversation_reads (
         conversation_id,
         last_read_at,
         updated_at
       ) VALUES (?, ?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         last_read_at = excluded.last_read_at,
         updated_at = excluded.updated_at`,
    );
  }

  upsertConversations(conversations: QuoConversation[]): number {
    const now = new Date().toISOString();
    const normalized = conversations
      .map((conversation) => ({
        conversationId: conversation.id,
        lastMessageAt: conversation.lastMessageAt ?? null,
        payload: JSON.stringify(conversation),
      }))
      .filter((conversation) => conversation.conversationId.length > 0);

    const run = this.db.transaction(() => {
      for (const conversation of normalized) {
        this.upsertConversationStmt.run(
          conversation.conversationId,
          conversation.lastMessageAt,
          conversation.payload,
          now,
          now,
        );
      }
    });

    try {
      run();
      return normalized.length;
    } catch (error) {
      this.logger.warn(
        `Failed to upsert chat conversations: ${this.stringifyError(error)}`,
      );
      return 0;
    }
  }

  upsertMessages(
    defaultConversationId: string,
    messages: QuoMessage[],
  ): number {
    const now = new Date().toISOString();
    const normalized = messages
      .map((message) => ({
        messageId: message.id,
        conversationId: message.conversationId ?? defaultConversationId,
        createdAt: message.createdAt ?? null,
        payload: JSON.stringify(message),
      }))
      .filter(
        (message) =>
          message.messageId.length > 0 && message.conversationId.length > 0,
      );

    const run = this.db.transaction(() => {
      for (const message of normalized) {
        this.upsertMessageStmt.run(
          message.messageId,
          message.conversationId,
          message.createdAt,
          message.payload,
          now,
          now,
        );
      }
    });

    try {
      run();
      return normalized.length;
    } catch (error) {
      this.logger.warn(
        `Failed to upsert chat messages: ${this.stringifyError(error)}`,
      );
      return 0;
    }
  }

  upsertClientContactLink(input: UpsertClientContactLinkInput): void {
    try {
      this.upsertClientLinkStmt.run(
        input.clientId,
        input.quoContactId,
        input.source,
        input.updatedAt ?? new Date().toISOString(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to upsert chat client link: ${this.stringifyError(error)}`,
      );
    }
  }

  getClientContactLink(clientId: string): UpsertClientContactLinkInput | null {
    try {
      const row = this.selectClientLinkStmt.get(clientId) as
        | ContactLinkRow
        | undefined;
      if (!row) {
        return null;
      }
      return {
        clientId: row.client_id,
        quoContactId: row.quo_contact_id,
        source: row.source,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to load chat client link: ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  removeClientContactLink(clientId: string): void {
    try {
      this.removeClientLinkStmt.run(clientId);
    } catch (error) {
      this.logger.warn(
        `Failed to remove chat client link: ${this.stringifyError(error)}`,
      );
    }
  }

  saveSyncCursor(cursorKey: string, cursorValue: string): void {
    try {
      this.upsertCursorStmt.run(
        cursorKey,
        cursorValue,
        new Date().toISOString(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to save chat sync cursor: ${this.stringifyError(error)}`,
      );
    }
  }

  getSyncCursor(cursorKey: string): string | null {
    try {
      const row = this.selectCursorStmt.get(cursorKey) as CursorRow | undefined;
      return row?.cursor_value ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to read chat sync cursor: ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  getMirrorStats(): ChatMirrorStats {
    return {
      conversations: this.readCount(this.countConversationsStmt),
      messages: this.readCount(this.countMessagesStmt),
      clientLinks: this.readCount(this.countClientLinksStmt),
      cursors: this.readCount(this.countCursorsStmt),
    };
  }

  clearMirrorData(options?: ClearMirrorDataOptions): void {
    const preserveClientLinks = options?.preserveClientLinks ?? true;
    const run = this.db.transaction(() => {
      this.clearMessagesStmt.run();
      this.clearConversationsStmt.run();
      this.clearCursorsStmt.run();
      if (!preserveClientLinks) {
        this.clearClientLinksStmt.run();
      }
    });

    try {
      run();
    } catch (error) {
      this.logger.warn(
        `Failed to clear chat mirror data: ${this.stringifyError(error)}`,
      );
    }
  }

  recordWebhookEvent(input: RecordWebhookEventInput): RecordWebhookEventResult {
    const receivedAt = input.receivedAt ?? new Date().toISOString();
    try {
      const result = this.insertWebhookEventStmt.run(
        input.providerEventId,
        input.provider,
        input.eventType,
        input.messageId,
        input.conversationId,
        input.occurredAt,
        JSON.stringify(input.payload),
        receivedAt,
      ) as WebhookInsertResult;
      return {
        inserted: result.changes > 0,
        receivedAt,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to persist chat webhook event: ${this.stringifyError(error)}`,
      );
      return {
        inserted: false,
        receivedAt,
      };
    }
  }

  listMirrorConversations(
    options: ListMirrorConversationsOptions,
  ): ConversationSummaryRow[] {
    const normalizedQuery = options.query.trim().toLowerCase();
    const wildcard = `%${normalizedQuery}%`;
    try {
      return this.listConversationSummariesStmt.all(
        normalizedQuery,
        wildcard,
        wildcard,
        options.limit,
        options.offset,
      ) as ConversationSummaryRow[];
    } catch (error) {
      this.logger.warn(
        `Failed to list chat conversations: ${this.stringifyError(error)}`,
      );
      return [];
    }
  }

  countMirrorConversations(query: string): number {
    const normalizedQuery = query.trim().toLowerCase();
    const wildcard = `%${normalizedQuery}%`;
    try {
      const row = this.countConversationSummariesStmt.get(
        normalizedQuery,
        wildcard,
        wildcard,
      ) as ConversationCountRow | undefined;
      return row?.total ?? 0;
    } catch (error) {
      this.logger.warn(
        `Failed to count chat conversations: ${this.stringifyError(error)}`,
      );
      return 0;
    }
  }

  listMirrorMessages(options: ListMirrorMessagesOptions): MessageMirrorRow[] {
    try {
      return this.listMessagesForConversationStmt.all(
        options.conversationId,
        options.limit,
        options.offset,
      ) as MessageMirrorRow[];
    } catch (error) {
      this.logger.warn(
        `Failed to list chat messages: ${this.stringifyError(error)}`,
      );
      return [];
    }
  }

  getMirrorConversationById(
    conversationId: string,
  ): ConversationSummaryRow | null {
    try {
      const row = this.selectConversationSummaryByIdStmt.get(conversationId) as
        | ConversationSummaryRow
        | undefined;
      return row ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to load chat conversation: ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  countMirrorMessages(conversationId: string): number {
    try {
      const row = this.countMessagesForConversationStmt.get(conversationId) as
        | ConversationCountRow
        | undefined;
      return row?.total ?? 0;
    } catch (error) {
      this.logger.warn(
        `Failed to count chat messages: ${this.stringifyError(error)}`,
      );
      return 0;
    }
  }

  hasConversation(conversationId: string): boolean {
    try {
      const row = this.selectConversationExistsStmt.get(conversationId) as
        | CountRow
        | undefined;
      return (row?.count ?? 0) > 0;
    } catch (error) {
      this.logger.warn(
        `Failed to check conversation existence: ${this.stringifyError(error)}`,
      );
      return false;
    }
  }

  markConversationRead(conversationId: string, readAt: string): void {
    try {
      this.upsertConversationReadStmt.run(
        conversationId,
        readAt,
        new Date().toISOString(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to mark chat conversation read: ${this.stringifyError(error)}`,
      );
    }
  }

  onModuleDestroy(): void {
    if (this.db.open) {
      this.db.close();
    }
  }

  private readCount(statement: Database.Statement): number {
    try {
      const row = statement.get() as CountRow | undefined;
      return row?.count ?? 0;
    } catch (error) {
      this.logger.warn(
        `Failed to read chat mirror count: ${this.stringifyError(error)}`,
      );
      return 0;
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }
}

export type {
  ChatMirrorStats,
  ClearMirrorDataOptions,
  ConversationSummaryRow,
  ListMirrorConversationsOptions,
  ListMirrorMessagesOptions,
  MessageMirrorRow,
  RecordWebhookEventInput,
  RecordWebhookEventResult,
  UpsertClientContactLinkInput,
};
