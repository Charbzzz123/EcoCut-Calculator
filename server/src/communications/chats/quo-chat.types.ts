type QuoEntityId = string;

interface QuoListResponse<TItem> {
  data: TItem[];
  hasNextPage?: boolean;
  nextPageToken?: string | null;
}

interface QuoPhoneNumber {
  id: QuoEntityId;
  number: string;
  formattedNumber?: string;
  name?: string;
}

interface QuoConversation {
  id: QuoEntityId;
  phoneNumberId?: QuoEntityId;
  contactId?: QuoEntityId;
  displayName?: string;
  lastMessageAt?: string;
}

interface QuoMessage {
  id: QuoEntityId;
  conversationId?: QuoEntityId;
  from?: string;
  to?: string;
  content?: string;
  direction?: 'inbound' | 'outbound';
  createdAt?: string;
}

interface QuoContact {
  id: QuoEntityId;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

interface QuoCreateContactInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  externalId?: string;
}

interface QuoUpdateContactInput extends QuoCreateContactInput {
  archived?: boolean;
}

interface QuoSendMessageInput {
  to: string;
  content: string;
}

interface QuoChatProviderHealth {
  provider: 'quo';
  configured: boolean;
  connected: boolean;
  checkedAt: string;
  lastSyncAt: string | null;
  rateLimitPerSecond: number;
  phoneNumber: string | null;
  details: string;
  mirror: QuoChatMirrorStats;
}

interface QuoChatMirrorStats {
  conversations: number;
  messages: number;
  clientLinks: number;
  cursors: number;
}

type QuoChatSyncMode = 'incremental' | 'backfill' | 'reset';

interface QuoChatSyncRequest {
  mode?: QuoChatSyncMode;
  conversationPageSize?: number;
  messagePageSize?: number;
  maxConversations?: number;
}

interface QuoChatSyncResult {
  mode: QuoChatSyncMode;
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
  pages: {
    conversations: number;
    messages: number;
  };
  cursors: {
    previousConversationCursor: string | null;
    nextConversationCursor: string | null;
    previousMessageCursor: string | null;
    nextMessageCursor: string | null;
    previousSyncAt: string | null;
    lastSyncAt: string;
  };
  mirror: QuoChatMirrorStats;
}

type QuoChatWebhookEventType =
  | 'message.received'
  | 'message.sent'
  | 'message.delivered'
  | 'message.failed'
  | 'message.unknown';

interface QuoChatWebhookIngestResult {
  accepted: true;
  provider: 'quo';
  duplicate: boolean;
  providerEventId: string;
  eventType: QuoChatWebhookEventType;
  conversationId: string | null;
  messageId: string | null;
  receivedAt: string;
  mirrored: {
    conversations: number;
    messages: number;
  };
}

interface ListChatConversationsRequest {
  limit?: number;
  offset?: number;
  query?: string;
}

interface ChatConversationSummary {
  conversationId: string;
  displayName: string | null;
  participantPhone: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: 'inbound' | 'outbound' | 'unknown';
  unreadCount: number;
}

interface ListChatConversationsResult {
  items: ChatConversationSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface ListChatMessagesRequest {
  limit?: number;
  offset?: number;
}

interface ChatMessageView {
  messageId: string;
  conversationId: string;
  direction: 'inbound' | 'outbound' | 'unknown';
  content: string | null;
  from: string | null;
  to: string | null;
  createdAt: string | null;
}

interface ListChatMessagesResult {
  conversationId: string;
  items: ChatMessageView[];
  total: number;
  limit: number;
  offset: number;
}

interface SendChatMessageDto {
  content: string;
  to?: string;
}

interface SendChatMessageResult {
  conversationId: string;
  messageId: string;
  sentAt: string;
}

interface MarkConversationReadDto {
  readAt?: string;
}

interface MarkConversationReadResult {
  conversationId: string;
  readAt: string;
}

export type {
  ChatConversationSummary,
  ChatMessageView,
  ListChatConversationsRequest,
  ListChatConversationsResult,
  ListChatMessagesRequest,
  ListChatMessagesResult,
  MarkConversationReadDto,
  MarkConversationReadResult,
  QuoChatProviderHealth,
  QuoChatMirrorStats,
  QuoChatSyncMode,
  QuoChatSyncRequest,
  QuoChatSyncResult,
  QuoChatWebhookEventType,
  QuoChatWebhookIngestResult,
  QuoContact,
  QuoConversation,
  QuoCreateContactInput,
  QuoListResponse,
  QuoMessage,
  QuoPhoneNumber,
  SendChatMessageDto,
  SendChatMessageResult,
  QuoSendMessageInput,
  QuoUpdateContactInput,
};
