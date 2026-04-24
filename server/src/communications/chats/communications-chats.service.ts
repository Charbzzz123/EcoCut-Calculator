import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadWebhookSignatureConfig } from '../communications.config';
import {
  QuoApiRequestError,
  QuoChatClientService,
} from './quo-chat-client.service';
import { CommunicationsChatsRepository } from './communications-chats.repository';
import type {
  ChatConversationSummary,
  ChatMessageView,
  ListChatConversationsRequest,
  ListChatConversationsResult,
  ListChatMessagesRequest,
  ListChatMessagesResult,
  MarkConversationReadDto,
  MarkConversationReadResult,
  QuoChatProviderHealth,
  QuoChatSyncRequest,
  QuoChatSyncResult,
  QuoChatWebhookEventType,
  QuoChatWebhookIngestResult,
  SendChatMessageDto,
  SendChatMessageResult,
} from './quo-chat.types';
import type {
  ConversationSummaryRow,
  MessageMirrorRow,
} from './communications-chats.repository';

const QUO_RATE_LIMIT_PER_SECOND = 10;
const DEFAULT_CONVERSATION_PAGE_SIZE = 40;
const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const DEFAULT_MAX_CONVERSATIONS = 200;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CONVERSATION_LIST_LIMIT = 30;
const DEFAULT_MESSAGE_LIST_LIMIT = 50;

const CONVERSATION_CURSOR_KEY = 'conversations.lastMessageAt';
const MESSAGE_CURSOR_KEY = 'messages.lastCreatedAt';
const LAST_SYNC_AT_CURSOR_KEY = 'sync.lastCompletedAt';

type SyncMode = 'incremental' | 'backfill' | 'reset';

interface QuoNormalizedWebhookEvent {
  providerEventId: string;
  eventType: QuoChatWebhookEventType;
  messageId: string | null;
  conversationId: string | null;
  occurredAt: string;
  message: {
    id: string;
    conversationId: string;
    content: string | undefined;
    direction: 'inbound' | 'outbound';
    createdAt: string;
    from: string | undefined;
    to: string | undefined;
  };
  conversation: {
    id: string;
    lastMessageAt: string;
  };
}

@Injectable()
export class CommunicationsChatsService {
  private readonly webhookConfig = loadWebhookSignatureConfig();

  constructor(
    private readonly quoClient: QuoChatClientService,
    private readonly chatsRepository: CommunicationsChatsRepository,
  ) {}

  async getProviderHealth(): Promise<QuoChatProviderHealth> {
    const mirror = this.chatsRepository.getMirrorStats();
    const lastSyncAt = this.chatsRepository.getSyncCursor(
      LAST_SYNC_AT_CURSOR_KEY,
    );
    if (!this.quoClient.isConfigured()) {
      return {
        provider: 'quo',
        configured: false,
        connected: false,
        checkedAt: new Date().toISOString(),
        lastSyncAt,
        rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
        phoneNumber: null,
        details:
          'QUO API credentials are missing. Configure QUO_* environment variables.',
        mirror,
      };
    }

    try {
      const phoneNumbers = await this.quoClient.listPhoneNumbers(1);
      const first = phoneNumbers.data[0];
      return {
        provider: 'quo',
        configured: true,
        connected: true,
        checkedAt: new Date().toISOString(),
        lastSyncAt,
        rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
        phoneNumber:
          first?.formattedNumber ??
          first?.number ??
          this.quoClient.getFromNumber(),
        details: 'Connection successful. Quo chat provider is reachable.',
        mirror,
      };
    } catch (error) {
      const defaultDetails = 'Unable to reach Quo provider.';
      if (error instanceof QuoApiRequestError) {
        const details =
          error.status === 401 || error.status === 403
            ? 'Authentication failed. Verify QUO_API_KEY and number/user IDs.'
            : `${defaultDetails} (${error.status})`;
        return {
          provider: 'quo',
          configured: true,
          connected: false,
          checkedAt: new Date().toISOString(),
          lastSyncAt,
          rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
          phoneNumber: this.quoClient.getFromNumber(),
          details,
          mirror,
        };
      }

      return {
        provider: 'quo',
        configured: true,
        connected: false,
        checkedAt: new Date().toISOString(),
        lastSyncAt,
        rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
        phoneNumber: this.quoClient.getFromNumber(),
        details: `${defaultDetails} ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`,
        mirror,
      };
    }
  }

  listConversations(
    request: ListChatConversationsRequest = {},
  ): ListChatConversationsResult {
    const limit = this.normalizeListLimit(
      request.limit,
      DEFAULT_CONVERSATION_LIST_LIMIT,
    );
    const offset = this.normalizeOffset(request.offset);
    const query = request.query?.trim() ?? '';
    const rows = this.chatsRepository.listMirrorConversations({
      limit,
      offset,
      query,
    });
    const total = this.chatsRepository.countMirrorConversations(query);
    return {
      items: rows.map((row) => this.toConversationSummary(row)),
      total,
      limit,
      offset,
    };
  }

  searchConversations(
    request: ListChatConversationsRequest = {},
  ): ListChatConversationsResult {
    return this.listConversations({
      ...request,
      query: request.query?.trim() ?? '',
    });
  }

  listConversationMessages(
    conversationId: string,
    request: ListChatMessagesRequest = {},
  ): ListChatMessagesResult {
    this.ensureConversationExists(conversationId);
    const limit = this.normalizeListLimit(
      request.limit,
      DEFAULT_MESSAGE_LIST_LIMIT,
    );
    const offset = this.normalizeOffset(request.offset);
    const rows = this.chatsRepository.listMirrorMessages({
      conversationId,
      limit,
      offset,
    });
    const total = this.chatsRepository.countMirrorMessages(conversationId);
    return {
      conversationId,
      items: rows.map((row) => this.toMessageView(row)),
      total,
      limit,
      offset,
    };
  }

  markConversationRead(
    conversationId: string,
    dto: MarkConversationReadDto = {},
  ): MarkConversationReadResult {
    this.ensureConversationExists(conversationId);
    const readAt = this.normalizeReadTimestamp(dto.readAt);
    this.chatsRepository.markConversationRead(conversationId, readAt);
    return {
      conversationId,
      readAt,
    };
  }

  async sendMessage(
    conversationId: string,
    dto: SendChatMessageDto,
  ): Promise<SendChatMessageResult> {
    this.ensureConversationExists(conversationId);
    const content = dto.content?.trim();
    if (!content) {
      throw new BadRequestException('Message content is required.');
    }

    const recipient =
      this.normalizePhone(dto.to) ??
      this.resolveConversationRecipient(conversationId);
    if (!recipient) {
      throw new BadRequestException(
        'Recipient phone is missing for this conversation.',
      );
    }

    const messageId = await this.quoClient.sendTextMessage({
      to: recipient,
      content,
    });
    const sentAt = new Date().toISOString();
    this.chatsRepository.upsertMessages(conversationId, [
      {
        id: messageId,
        conversationId,
        content,
        direction: 'outbound',
        from: this.quoClient.getFromNumber() ?? undefined,
        to: recipient,
        createdAt: sentAt,
      },
    ]);
    this.chatsRepository.upsertConversations([
      {
        id: conversationId,
        lastMessageAt: sentAt,
      },
    ]);
    this.bumpCursorIfNewer(MESSAGE_CURSOR_KEY, sentAt);
    this.bumpCursorIfNewer(CONVERSATION_CURSOR_KEY, sentAt);
    this.bumpCursorIfNewer(LAST_SYNC_AT_CURSOR_KEY, sentAt);

    return {
      conversationId,
      messageId,
      sentAt,
    };
  }

  async syncMirror(request?: QuoChatSyncRequest): Promise<QuoChatSyncResult> {
    const mode = this.normalizeMode(request?.mode);
    const forceFullBackfill = mode === 'backfill' || mode === 'reset';
    const startedAt = new Date().toISOString();

    if (mode === 'reset') {
      this.chatsRepository.clearMirrorData({ preserveClientLinks: true });
    }

    const previousConversationCursor = forceFullBackfill
      ? null
      : this.chatsRepository.getSyncCursor(CONVERSATION_CURSOR_KEY);
    const previousMessageCursor = forceFullBackfill
      ? null
      : this.chatsRepository.getSyncCursor(MESSAGE_CURSOR_KEY);
    const previousSyncAt = this.chatsRepository.getSyncCursor(
      LAST_SYNC_AT_CURSOR_KEY,
    );

    const conversationCursorDate = this.parseCursorDate(
      previousConversationCursor,
    );
    const messageCursorDate = this.parseCursorDate(previousMessageCursor);

    const conversationPageSize = this.normalizePageSize(
      request?.conversationPageSize,
      DEFAULT_CONVERSATION_PAGE_SIZE,
    );
    const messagePageSize = this.normalizePageSize(
      request?.messagePageSize,
      DEFAULT_MESSAGE_PAGE_SIZE,
    );
    const maxConversations = this.normalizeMaxConversations(
      request?.maxConversations,
    );

    const conversationIds = new Set<string>();
    const scanned = { conversations: 0, messages: 0 };
    const mirrored = { conversations: 0, messages: 0 };
    const pages = { conversations: 0, messages: 0 };
    let truncated = false;
    let reachedConversationWatermark = false;

    let newestConversationDate = conversationCursorDate;
    let conversationPageToken: string | undefined;
    while (true) {
      const response = await this.quoClient.listConversations(
        conversationPageToken,
        conversationPageSize,
      );
      pages.conversations += 1;
      const batch = response.data ?? [];
      if (batch.length === 0) {
        break;
      }

      scanned.conversations += batch.length;
      const freshConversations: typeof batch = [];
      for (const conversation of batch) {
        const conversationDate = this.parseCursorDate(
          conversation.lastMessageAt,
        );
        if (
          conversationCursorDate &&
          conversationDate &&
          conversationDate <= conversationCursorDate
        ) {
          reachedConversationWatermark = true;
          continue;
        }

        if (conversation.id.length === 0) {
          continue;
        }

        freshConversations.push(conversation);
        conversationIds.add(conversation.id);
        if (
          conversationDate &&
          (!newestConversationDate || conversationDate > newestConversationDate)
        ) {
          newestConversationDate = conversationDate;
        }
      }

      mirrored.conversations +=
        this.chatsRepository.upsertConversations(freshConversations);

      if (conversationIds.size >= maxConversations) {
        truncated = true;
        break;
      }

      if (reachedConversationWatermark) {
        break;
      }

      if (!response.hasNextPage || !response.nextPageToken) {
        break;
      }
      conversationPageToken = response.nextPageToken;
    }

    let newestMessageDate = messageCursorDate;
    const selectedConversationIds = Array.from(conversationIds).slice(
      0,
      maxConversations,
    );
    if (selectedConversationIds.length < conversationIds.size) {
      truncated = true;
    }

    for (const conversationId of selectedConversationIds) {
      let messagePageToken: string | undefined;
      let reachedMessageWatermark = false;
      while (true) {
        const response = await this.quoClient.listMessages(
          conversationId,
          messagePageToken,
          messagePageSize,
        );
        pages.messages += 1;
        const batch = response.data ?? [];
        if (batch.length === 0) {
          break;
        }

        scanned.messages += batch.length;
        const freshMessages: typeof batch = [];
        for (const message of batch) {
          const messageDate = this.parseCursorDate(message.createdAt);
          if (
            messageCursorDate &&
            messageDate &&
            messageDate <= messageCursorDate
          ) {
            reachedMessageWatermark = true;
            continue;
          }

          freshMessages.push(message);
          if (
            messageDate &&
            (!newestMessageDate || messageDate > newestMessageDate)
          ) {
            newestMessageDate = messageDate;
          }
        }

        mirrored.messages += this.chatsRepository.upsertMessages(
          conversationId,
          freshMessages,
        );

        if (reachedMessageWatermark) {
          break;
        }

        if (!response.hasNextPage || !response.nextPageToken) {
          break;
        }
        messagePageToken = response.nextPageToken;
      }
    }

    const completedAt = new Date().toISOString();
    if (newestConversationDate) {
      this.chatsRepository.saveSyncCursor(
        CONVERSATION_CURSOR_KEY,
        newestConversationDate.toISOString(),
      );
    }
    if (newestMessageDate) {
      this.chatsRepository.saveSyncCursor(
        MESSAGE_CURSOR_KEY,
        newestMessageDate.toISOString(),
      );
    }
    this.chatsRepository.saveSyncCursor(LAST_SYNC_AT_CURSOR_KEY, completedAt);

    const nextConversationCursor = this.chatsRepository.getSyncCursor(
      CONVERSATION_CURSOR_KEY,
    );
    const nextMessageCursor =
      this.chatsRepository.getSyncCursor(MESSAGE_CURSOR_KEY);

    return {
      mode,
      startedAt,
      completedAt,
      durationMs:
        new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      truncated,
      scanned,
      mirrored,
      pages,
      cursors: {
        previousConversationCursor,
        nextConversationCursor,
        previousMessageCursor,
        nextMessageCursor,
        previousSyncAt,
        lastSyncAt: completedAt,
      },
      mirror: this.chatsRepository.getMirrorStats(),
    };
  }

  ingestQuoWebhook(
    payload: unknown,
    signature: string | undefined,
  ): QuoChatWebhookIngestResult {
    this.ensureWebhookSignature(payload, signature);
    const normalized = this.normalizeQuoWebhookEvent(payload);

    const persisted = this.chatsRepository.recordWebhookEvent({
      provider: 'quo',
      providerEventId: normalized.providerEventId,
      eventType: normalized.eventType,
      messageId: normalized.messageId,
      conversationId: normalized.conversationId,
      occurredAt: normalized.occurredAt,
      payload,
    });

    if (!persisted.inserted) {
      return {
        accepted: true,
        provider: 'quo',
        duplicate: true,
        providerEventId: normalized.providerEventId,
        eventType: normalized.eventType,
        conversationId: normalized.conversationId,
        messageId: normalized.messageId,
        receivedAt: persisted.receivedAt,
        mirrored: {
          conversations: 0,
          messages: 0,
        },
      };
    }

    const mirroredConversations = this.chatsRepository.upsertConversations([
      normalized.conversation,
    ]);
    const mirroredMessages = this.chatsRepository.upsertMessages(
      normalized.conversation.id,
      [normalized.message],
    );
    this.bumpCursorIfNewer(CONVERSATION_CURSOR_KEY, normalized.occurredAt);
    this.bumpCursorIfNewer(MESSAGE_CURSOR_KEY, normalized.occurredAt);
    this.bumpCursorIfNewer(LAST_SYNC_AT_CURSOR_KEY, persisted.receivedAt);

    return {
      accepted: true,
      provider: 'quo',
      duplicate: false,
      providerEventId: normalized.providerEventId,
      eventType: normalized.eventType,
      conversationId: normalized.conversationId,
      messageId: normalized.messageId,
      receivedAt: persisted.receivedAt,
      mirrored: {
        conversations: mirroredConversations,
        messages: mirroredMessages,
      },
    };
  }

  private ensureConversationExists(conversationId: string): void {
    if (!conversationId || conversationId.trim().length === 0) {
      throw new BadRequestException('Conversation id is required.');
    }
    if (!this.chatsRepository.hasConversation(conversationId)) {
      throw new NotFoundException(
        `Conversation "${conversationId}" was not found in chat mirror.`,
      );
    }
  }

  private resolveConversationRecipient(conversationId: string): string | null {
    const recentRows = this.chatsRepository.listMirrorMessages({
      conversationId,
      limit: 25,
      offset: 0,
    });
    for (const row of recentRows) {
      const message = this.toMessageView(row);
      if (message.direction === 'inbound') {
        const inboundNumber = this.normalizePhone(message.from);
        if (inboundNumber) {
          return inboundNumber;
        }
      }
      if (message.direction === 'outbound') {
        const outboundNumber = this.normalizePhone(message.to);
        if (outboundNumber) {
          return outboundNumber;
        }
      }
    }

    const conversation =
      this.chatsRepository.getMirrorConversationById(conversationId);
    if (!conversation) {
      return null;
    }
    const payload = this.parseJsonRecord(conversation.conversation_payload);
    const candidates = [
      this.readString(payload.phoneNumber),
      this.readString(payload.phone),
      this.readString(payload.participantPhone),
      this.readString(payload.number),
    ];
    for (const candidate of candidates) {
      const normalized = this.normalizePhone(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private toConversationSummary(
    row: ConversationSummaryRow,
  ): ChatConversationSummary {
    const conversationPayload = this.parseJsonRecord(row.conversation_payload);
    const lastMessagePayload = this.parseJsonRecord(row.last_message_payload);
    const lastMessageDirection = this.normalizeDirection(
      this.readString(lastMessagePayload.direction),
    );
    const participantPhone = this.resolveParticipantFromPayloads(
      conversationPayload,
      lastMessagePayload,
      lastMessageDirection,
    );
    const displayName =
      this.readString(conversationPayload.displayName) ??
      this.readString(conversationPayload.name) ??
      this.readString(conversationPayload.contactName);
    const preview =
      this.readString(lastMessagePayload.content) ??
      this.readString(lastMessagePayload.body);

    return {
      conversationId: row.conversation_id,
      displayName,
      participantPhone,
      lastMessageAt: row.last_message_at ?? row.last_message_created_at ?? null,
      lastMessagePreview: preview,
      lastMessageDirection,
      unreadCount: Math.max(0, row.unread_count ?? 0),
    };
  }

  private resolveParticipantFromPayloads(
    conversationPayload: Record<string, unknown>,
    lastMessagePayload: Record<string, unknown>,
    direction: 'inbound' | 'outbound' | 'unknown',
  ): string | null {
    if (direction === 'inbound') {
      const inbound = this.normalizePhone(
        this.readString(lastMessagePayload.from),
      );
      if (inbound) {
        return inbound;
      }
    }
    if (direction === 'outbound') {
      const outbound = this.normalizePhone(
        this.readString(lastMessagePayload.to),
      );
      if (outbound) {
        return outbound;
      }
    }
    const conversationCandidates = [
      this.readString(conversationPayload.phoneNumber),
      this.readString(conversationPayload.phone),
      this.readString(conversationPayload.participantPhone),
      this.readString(conversationPayload.number),
    ];
    for (const candidate of conversationCandidates) {
      const normalized = this.normalizePhone(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private toMessageView(row: MessageMirrorRow): ChatMessageView {
    const payload = this.parseJsonRecord(row.payload);
    return {
      messageId: row.message_id,
      conversationId: row.conversation_id,
      direction: this.normalizeDirection(this.readString(payload.direction)),
      content:
        this.readString(payload.content) ??
        this.readString(payload.body) ??
        null,
      from: this.readString(payload.from),
      to: this.readString(payload.to),
      createdAt: row.created_at ?? this.readString(payload.createdAt),
    };
  }

  private parseJsonRecord(value: string | null): Record<string, unknown> {
    if (!value) {
      return {};
    }
    try {
      return this.toRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  private normalizeDirection(
    value: string | null,
  ): 'inbound' | 'outbound' | 'unknown' {
    const normalized = value?.toLowerCase();
    if (normalized === 'inbound') {
      return 'inbound';
    }
    if (normalized === 'outbound') {
      return 'outbound';
    }
    return 'unknown';
  }

  private normalizePhone(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const normalized = trimmed.replace(/[^\d+]/g, '');
    if (normalized.length < 7) {
      return null;
    }
    return normalized;
  }

  private normalizeReadTimestamp(value: string | undefined): string {
    if (!value || value.trim().length === 0) {
      return new Date().toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('readAt must be an ISO date.');
    }
    return parsed.toISOString();
  }

  private normalizeMode(mode: QuoChatSyncRequest['mode']): SyncMode {
    if (mode === 'backfill' || mode === 'reset') {
      return mode;
    }
    return 'incremental';
  }

  private normalizePageSize(
    value: number | undefined,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
  }

  private normalizeMaxConversations(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return DEFAULT_MAX_CONVERSATIONS;
    }
    return Math.max(1, Math.floor(value));
  }

  private normalizeListLimit(
    value: number | undefined,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
  }

  private normalizeOffset(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.floor(value));
  }

  private parseCursorDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private ensureWebhookSignature(
    payload: unknown,
    signature: string | undefined,
  ): void {
    const secret = this.webhookConfig.quoSecret;
    if (!secret) {
      return;
    }

    if (!signature) {
      throw new BadRequestException('Missing webhook signature for Quo chats.');
    }

    const expected = this.createWebhookSignature(secret, payload);
    const received = signature.trim().toLowerCase();
    if (!this.constantTimeEqual(expected, received)) {
      throw new BadRequestException('Invalid webhook signature for Quo chats.');
    }
  }

  private createWebhookSignature(secret: string, payload: unknown): string {
    return createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  }

  private normalizeQuoWebhookEvent(
    payload: unknown,
  ): QuoNormalizedWebhookEvent {
    const source = this.toRecord(payload);
    const data = this.toRecord(source.data);
    const eventName =
      this.readString(source.event) ??
      this.readString(source.type) ??
      'message.unknown';
    const status = this.readString(data.status);
    const eventType = this.mapWebhookEventType(eventName, status);
    const occurredAt =
      this.readString(data.timestamp) ??
      this.readString(source.timestamp) ??
      new Date().toISOString();
    const messageId =
      this.readString(data.messageId) ??
      this.readString(data.id) ??
      this.readString(source.messageId);
    const conversationId =
      this.readString(data.conversationId) ??
      this.readString(source.conversationId) ??
      this.readString(data.threadId) ??
      this.readString(source.threadId);
    const from =
      this.readString(data.from) ??
      this.readString(source.from) ??
      this.readString(data.phoneNumber);
    const to =
      this.readString(data.to) ??
      this.readString(source.to) ??
      this.quoClient.getFromNumber() ??
      undefined;

    const resolvedConversationId =
      conversationId ??
      (messageId ? `message:${messageId}` : `conversation:${occurredAt}`);
    const resolvedMessageId =
      messageId ?? `${resolvedConversationId}:${eventType}:${occurredAt}`;
    const providerEventId =
      this.readString(source.id) ??
      this.readString(data.eventId) ??
      `${resolvedMessageId}:${eventType}`;
    const direction: 'inbound' | 'outbound' =
      eventType === 'message.received' ? 'inbound' : 'outbound';

    return {
      providerEventId,
      eventType,
      messageId: messageId ?? null,
      conversationId: conversationId ?? null,
      occurredAt,
      message: {
        id: resolvedMessageId,
        conversationId: resolvedConversationId,
        content:
          this.readString(data.content) ??
          this.readString(data.body) ??
          this.readString(source.content) ??
          undefined,
        direction,
        createdAt: occurredAt,
        from: from ?? undefined,
        to: to ?? undefined,
      },
      conversation: {
        id: resolvedConversationId,
        lastMessageAt: occurredAt,
      },
    };
  }

  private mapWebhookEventType(
    eventName: string,
    status: string | null,
  ): QuoChatWebhookEventType {
    const combined = `${eventName} ${status ?? ''}`.toLowerCase();
    if (
      combined.includes('message.received') ||
      combined.includes('inbound') ||
      combined.includes('received')
    ) {
      return 'message.received';
    }
    if (combined.includes('delivered')) {
      return 'message.delivered';
    }
    if (
      combined.includes('failed') ||
      combined.includes('undeliverable') ||
      combined.includes('errored')
    ) {
      return 'message.failed';
    }
    if (combined.includes('sent') || combined.includes('queued')) {
      return 'message.sent';
    }
    return 'message.unknown';
  }

  private bumpCursorIfNewer(cursorKey: string, candidate: string): void {
    const current = this.parseCursorDate(
      this.chatsRepository.getSyncCursor(cursorKey),
    );
    const next = this.parseCursorDate(candidate);
    if (!next) {
      return;
    }
    if (!current || next > current) {
      this.chatsRepository.saveSyncCursor(cursorKey, next.toISOString());
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }
}
