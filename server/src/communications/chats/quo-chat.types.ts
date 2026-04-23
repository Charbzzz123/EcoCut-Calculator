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

export type {
  QuoChatProviderHealth,
  QuoChatMirrorStats,
  QuoContact,
  QuoConversation,
  QuoCreateContactInput,
  QuoListResponse,
  QuoMessage,
  QuoPhoneNumber,
  QuoSendMessageInput,
  QuoUpdateContactInput,
};
