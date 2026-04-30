import { computed, inject, Injectable, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import type {
  ChatConversationSummary,
  ChatMessageView,
  ChatProviderHealth,
} from '@shared/domain/communications/chats-api.service.js';
import { ChatsApiService } from '@shared/domain/communications/chats-api.service.js';

export type ChatsLoadState = 'idle' | 'loading' | 'ready' | 'error';
export type ChatSendState = 'idle' | 'sending' | 'sent' | 'failed';

const CONVERSATION_LIMIT = 40;
const MESSAGE_LIMIT = 80;

@Injectable()
export class ChatsFacade {
  private readonly api = inject(ChatsApiService);
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

  readonly canSend = computed(() => this.sendStateSignal() !== 'sending' && this.composerTextSignal().trim().length > 0);
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
  }

  async refresh(): Promise<void> {
    await Promise.all([this.refreshHealth(), this.loadConversations(this.searchControl.value)]);
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
}
