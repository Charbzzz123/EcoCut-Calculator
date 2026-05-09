import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl } from '@angular/forms';
import type {
  ChatConversationSummary,
  ChatMessageView,
  ChatProviderHealth,
  SyncChatsResult,
} from '@shared/domain/communications/chats-api.service.js';
import { ChatsApiService } from '@shared/domain/communications/chats-api.service.js';
import type { ClientDetail } from '@shared/domain/entry/entry-repository.service.js';
import { EntryRepositoryService } from '@shared/domain/entry/entry-repository.service.js';

export type ChatsLoadState = 'idle' | 'loading' | 'ready' | 'error';
export type ChatSendState = 'idle' | 'sending' | 'sent' | 'failed';
export type ChatSyncState = 'idle' | 'syncing' | 'synced' | 'failed';

const CONVERSATION_LIMIT = 40;
const MESSAGE_LIMIT = 80;

@Injectable()
export class ChatsFacade {
  private readonly api = inject(ChatsApiService);
  private readonly entries = inject(EntryRepositoryService);
  private readonly route = inject(ActivatedRoute);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly composerControl = new FormControl('', { nonNullable: true });

  /* c8 ignore start - Angular signal field initializers report synthetic branches. */
  private readonly healthSignal = signal<ChatProviderHealth | null>(null);
  private readonly conversationsSignal = signal<ChatConversationSummary[]>([]);
  private readonly messagesSignal = signal<ChatMessageView[]>([]);
  private readonly selectedConversationIdSignal = signal<string | null>(null);
  private readonly conversationTotalSignal = signal(0);
  private readonly conversationsStateSignal = signal<ChatsLoadState>('idle');
  private readonly threadStateSignal = signal<ChatsLoadState>('idle');
  private readonly sendStateSignal = signal<ChatSendState>('idle');
  private readonly syncStateSignal = signal<ChatSyncState>('idle');
  private readonly selectedClientContextSignal = signal<ClientDetail | null>(null);
  private readonly loadingMoreConversationsSignal = signal(false);
  private readonly lastSyncResultSignal = signal<SyncChatsResult | null>(null);
  private readonly errorSignal = signal<string | null>(null);
  private readonly composerTextSignal = signal('');
  /* c8 ignore stop */

  readonly health = this.healthSignal.asReadonly();
  readonly conversations = this.conversationsSignal.asReadonly();
  readonly messages = this.messagesSignal.asReadonly();
  readonly selectedConversationId = this.selectedConversationIdSignal.asReadonly();
  readonly conversationTotal = this.conversationTotalSignal.asReadonly();
  readonly conversationsState = this.conversationsStateSignal.asReadonly();
  readonly threadState = this.threadStateSignal.asReadonly();
  readonly sendState = this.sendStateSignal.asReadonly();
  readonly syncState = this.syncStateSignal.asReadonly();
  readonly selectedClientContext = this.selectedClientContextSignal.asReadonly();
  readonly loadingMoreConversations = this.loadingMoreConversationsSignal.asReadonly();
  readonly lastSyncResult = this.lastSyncResultSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  /* c8 ignore start - computed signal wrappers create synthetic branch metadata. */
  readonly selectedConversation = computed(() => {
    const selectedId = this.selectedConversationIdSignal();
    return this.conversationsSignal().find((conversation) => conversation.conversationId === selectedId) ?? null;
  });

  readonly hasActiveThread = computed(() => Boolean(this.selectedConversation()));

  readonly unreadTotal = computed(() =>
    this.conversationsSignal().reduce((total, conversation) => total + conversation.unreadCount, 0),
  );

  readonly hasMoreConversations = computed(() => this.conversationsSignal().length < this.conversationTotalSignal());
  readonly canSend = computed(() => this.sendStateSignal() !== 'sending' && this.composerTextSignal().trim().length > 0);
  readonly syncSummary = computed(() => {
    const result = this.lastSyncResultSignal();
    if (!result) {
      return null;
    }

    const details = [
      `Synced ${result.mirrored.conversations} conversation(s)`,
      `${result.mirrored.messages} message(s)`,
    ];

    if (result.contacts.scanned > 0) {
      details.push(`scanned ${result.contacts.scanned} Quo contact(s)`);
    } else if (result.contactCache.reused) {
      details.push(`used ${result.contactCache.phoneNumbers} cached Quo phone(s)`);
    }

    if (result.hydrated.conversationNames > 0) {
      details.push(`updated ${result.hydrated.conversationNames} name(s)`);
    }

    if (
      result.truncated ||
      result.hasMorePages.contacts ||
      result.hasMorePages.conversations ||
      result.hasMorePages.messages
    ) {
      details.push('more Quo pages may be available');
    }

    return `${details.join(', ')}.`;
  });
  /* c8 ignore stop */

  async init(): Promise<void> {
    this.searchControl.valueChanges.subscribe((query) => this.scheduleSearch(query));
    this.composerControl.valueChanges.subscribe((value) => {
      this.composerTextSignal.set(value);
      if (this.sendStateSignal() === 'sent' || this.sendStateSignal() === 'failed') {
        this.sendStateSignal.set('idle');
      }
    });
    await Promise.all([this.refreshHealth(), this.loadConversations()]);
    await this.openRequestedClientThread();
  }

  async refresh(): Promise<void> {
    await Promise.all([this.refreshHealth(), this.loadConversations(this.searchControl.value)]);
  }

  async syncChats(): Promise<void> {
    if (this.syncStateSignal() === 'syncing') {
      return;
    }

    this.syncStateSignal.set('syncing');
    this.lastSyncResultSignal.set(null);
    this.errorSignal.set(null);
    try {
      const result = await this.api.syncChats({ mode: 'backfill', maxConversations: 500 });
      this.lastSyncResultSignal.set(result);
      this.syncStateSignal.set('synced');
      await this.refresh();
    } catch (error) {
      this.syncStateSignal.set('failed');
      this.errorSignal.set(this.resolveSyncErrorMessage(error));
    }
  }

  async loadMoreConversations(): Promise<void> {
    if (
      this.conversationsStateSignal() === 'loading' ||
      this.loadingMoreConversationsSignal() ||
      !this.hasMoreConversations()
    ) {
      return;
    }

    this.loadingMoreConversationsSignal.set(true);
    this.errorSignal.set(null);
    const offset = this.conversationsSignal().length;
    const query = this.searchControl.value.trim();
    try {
      const result = query
        ? await this.api.searchConversations({ query, limit: CONVERSATION_LIMIT, offset })
        : await this.api.listConversations({ limit: CONVERSATION_LIMIT, offset });
      this.conversationsSignal.update((items) => [...items, ...result.items]);
      this.conversationTotalSignal.set(result.total);
      this.conversationsStateSignal.set('ready');
    } catch {
      this.conversationsStateSignal.set('ready');
      this.errorSignal.set('Unable to load more chat conversations right now.');
    } finally {
      this.loadingMoreConversationsSignal.set(false);
    }
  }

  async refreshHealth(): Promise<void> {
    try {
      this.healthSignal.set(await this.api.getHealth());
    } catch {
      this.healthSignal.set(null);
    }
  }

  async loadConversations(query = ''): Promise<void> {
    this.conversationsStateSignal.set('loading');
    this.errorSignal.set(null);
    try {
      const result = query.trim()
        ? await this.api.searchConversations({ query: query.trim(), limit: CONVERSATION_LIMIT })
        : await this.api.listConversations({ limit: CONVERSATION_LIMIT });
      this.conversationsSignal.set(result.items);
      this.conversationTotalSignal.set(result.total);
      this.conversationsStateSignal.set('ready');

      const selectedId = this.selectedConversationIdSignal();
      if (selectedId && !result.items.some((conversation) => conversation.conversationId === selectedId)) {
        this.clearThread();
      }
    } catch {
      this.conversationsStateSignal.set('error');
      this.errorSignal.set('Unable to load chat conversations right now.');
    }
  }

  async selectConversation(conversationId: string): Promise<void> {
    this.selectedConversationIdSignal.set(conversationId);
    this.threadStateSignal.set('loading');
    this.sendStateSignal.set('idle');
    this.errorSignal.set(null);
    const selectedConversation = this.conversationsSignal().find(
      (conversation) => conversation.conversationId === conversationId,
    );
    await this.loadSelectedClientContext(selectedConversation?.linkedClientId ?? null);
    try {
      const result = await this.api.listMessages(conversationId, { limit: MESSAGE_LIMIT });
      this.messagesSignal.set(this.sortMessagesAscending(result.items));
      this.threadStateSignal.set('ready');
      await this.api.markConversationRead(conversationId);
      this.conversationsSignal.update((conversations) =>
        conversations.map((conversation) =>
          conversation.conversationId === conversationId ? { ...conversation, unreadCount: 0 } : conversation,
        ),
      );
    } catch {
      this.threadStateSignal.set('error');
      this.errorSignal.set('Unable to load this conversation right now.');
    }
  }

  clearThread(): void {
    this.selectedConversationIdSignal.set(null);
    this.messagesSignal.set([]);
    this.selectedClientContextSignal.set(null);
    this.threadStateSignal.set('idle');
    this.sendStateSignal.set('idle');
    this.composerControl.setValue('', { emitEvent: false });
    this.composerTextSignal.set('');
  }

  async sendMessage(): Promise<void> {
    const conversation = this.selectedConversation();
    const content = this.composerControl.value.trim();
    if (!conversation || !content || this.sendStateSignal() === 'sending') {
      return;
    }

    this.sendStateSignal.set('sending');
    this.errorSignal.set(null);
    try {
      const result = await this.api.sendMessage(
        conversation.conversationId,
        content,
        conversation.participantPhone,
      );
      const sentMessage: ChatMessageView = {
        messageId: result.messageId,
        conversationId: conversation.conversationId,
        direction: 'outbound',
        content,
        from: null,
        to: conversation.participantPhone,
        createdAt: result.sentAt,
      };
      this.messagesSignal.update((messages) => [...messages, sentMessage]);
      this.conversationsSignal.update((conversations) =>
        conversations.map((item) =>
          item.conversationId === conversation.conversationId
            ? {
                ...item,
                lastMessageAt: result.sentAt,
                lastMessagePreview: content,
                lastMessageDirection: 'outbound',
              }
            : item,
        ),
      );
      this.composerControl.setValue('', { emitEvent: false });
      this.composerTextSignal.set('');
      this.sendStateSignal.set('sent');
    } catch {
      this.sendStateSignal.set('failed');
      this.errorSignal.set('Unable to send this message right now.');
    }
  }

  private scheduleSearch(query: string): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      void this.loadConversations(query);
    }, 300);
  }

  private sortMessagesAscending(messages: ChatMessageView[]): ChatMessageView[] {
    return [...messages].sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
      return leftTime - rightTime;
    });
  }

  private resolveSyncErrorMessage(error: unknown): string {
    const fallback = 'Unable to sync Quo conversations right now.';
    if (!error || typeof error !== 'object' || !('error' in error)) {
      return fallback;
    }

    const payload = (error as { error?: { message?: unknown; details?: unknown } }).error;
    const details =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.details === 'string'
          ? payload.details
          : null;

    return details ? `${fallback} ${details}` : fallback;
  }

  private async openRequestedClientThread(): Promise<void> {
    const clientId = this.route.snapshot.queryParamMap.get('clientId')?.trim();
    if (!clientId) {
      return;
    }

    try {
      let conversation = this.conversationsSignal().find(
        (item) => item.linkedClientId === clientId,
      );
      if (!conversation) {
        const result = await this.api.searchConversations({
          query: clientId,
          limit: CONVERSATION_LIMIT,
        });
        this.conversationsSignal.set(result.items);
        this.conversationTotalSignal.set(result.total);
        conversation = result.items.find((item) => item.linkedClientId === clientId);
      }

      if (conversation) {
        await this.selectConversation(conversation.conversationId);
      } else {
        this.errorSignal.set('No linked chat conversation exists for this client yet.');
      }
    } catch {
      this.errorSignal.set('Unable to open the linked client chat right now.');
    }
  }

  private async loadSelectedClientContext(clientId: string | null): Promise<void> {
    if (!clientId) {
      this.selectedClientContextSignal.set(null);
      return;
    }

    try {
      this.selectedClientContextSignal.set(await this.entries.getClientDetail(clientId));
    } catch {
      this.selectedClientContextSignal.set(null);
    }
  }
}
