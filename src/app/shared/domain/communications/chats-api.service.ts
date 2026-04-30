import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ChatMessageDirection = 'inbound' | 'outbound' | 'unknown';

export interface ChatConversationSummary {
  conversationId: string;
  displayName: string | null;
  participantPhone: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: ChatMessageDirection;
  unreadCount: number;
}

export interface ChatConversationListResult {
  items: ChatConversationSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChatMessageView {
  messageId: string;
  conversationId: string;
  direction: ChatMessageDirection;
  content: string | null;
  from: string | null;
  to: string | null;
  createdAt: string | null;
}

export interface ChatMessageListResult {
  conversationId: string;
  items: ChatMessageView[];
  total: number;
  limit: number;
  offset: number;
}

export interface SendChatMessageResult {
  conversationId: string;
  messageId: string;
  sentAt: string;
}

export interface ChatProviderHealth {
  provider: 'quo';
  configured: boolean;
  connected: boolean;
  checkedAt: string;
  lastSyncAt: string | null;
  rateLimitPerSecond: number;
  phoneNumber: string | null;
  details: string;
  mirror: {
    conversations: number;
    messages: number;
    clientLinks: number;
    cursors: number;
  };
}

export interface SyncChatsResult {
  mode: 'incremental' | 'backfill' | 'reset';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  truncated: boolean;
  scanned: {
    conversations: number;
    messages: number;
  };
  mirrored: {
    conversations: number;
    messages: number;
  };
  mirror: {
    conversations: number;
    messages: number;
    clientLinks: number;
    cursors: number;
  };
}

@Injectable({ providedIn: 'root' })
export class ChatsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/communications/chats`;

  async getHealth(): Promise<ChatProviderHealth> {
    return firstValueFrom(this.http.get<ChatProviderHealth>(`${this.baseUrl}/health`));
  }

  async syncChats(): Promise<SyncChatsResult> {
    return firstValueFrom(
      this.http.post<SyncChatsResult>(`${this.baseUrl}/sync`, {
        mode: 'incremental',
      }),
    );
  }

  async listConversations(options: {
    query?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ChatConversationListResult> {
    return firstValueFrom(
      this.http.get<ChatConversationListResult>(`${this.baseUrl}/conversations`, {
        params: this.toParams(options),
      }),
    );
  }

  async searchConversations(options: {
    query?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ChatConversationListResult> {
    return firstValueFrom(
      this.http.get<ChatConversationListResult>(`${this.baseUrl}/search`, {
        params: this.toParams(options),
      }),
    );
  }

  async listMessages(
    conversationId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<ChatMessageListResult> {
    return firstValueFrom(
      this.http.get<ChatMessageListResult>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages`,
        { params: this.toParams(options) },
      ),
    );
  }

  async sendMessage(conversationId: string, content: string, to?: string | null): Promise<SendChatMessageResult> {
    const payload = to ? { content, to } : { content };
    return firstValueFrom(
      this.http.post<SendChatMessageResult>(
        `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/messages`,
        payload,
      ),
    );
  }

  async markConversationRead(conversationId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}/read`, {}),
    );
  }

  private toParams(options: Record<string, number | string | undefined>): HttpParams {
    let params = new HttpParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}
