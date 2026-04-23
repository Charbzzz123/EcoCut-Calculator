import { Injectable } from '@nestjs/common';
import {
  QuoApiRequestError,
  QuoChatClientService,
} from './quo-chat-client.service';
import { CommunicationsChatsRepository } from './communications-chats.repository';
import type {
  QuoChatProviderHealth,
  QuoChatSyncRequest,
  QuoChatSyncResult,
} from './quo-chat.types';

const QUO_RATE_LIMIT_PER_SECOND = 10;
const DEFAULT_CONVERSATION_PAGE_SIZE = 40;
const DEFAULT_MESSAGE_PAGE_SIZE = 50;
const DEFAULT_MAX_CONVERSATIONS = 200;
const MAX_PAGE_SIZE = 100;

const CONVERSATION_CURSOR_KEY = 'conversations.lastMessageAt';
const MESSAGE_CURSOR_KEY = 'messages.lastCreatedAt';
const LAST_SYNC_AT_CURSOR_KEY = 'sync.lastCompletedAt';

type SyncMode = 'incremental' | 'backfill' | 'reset';

@Injectable()
export class CommunicationsChatsService {
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
}
