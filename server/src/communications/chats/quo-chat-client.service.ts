import { Injectable, Logger } from '@nestjs/common';
import { loadQuoSmsConfig } from '../communications.config';
import type {
  QuoContact,
  QuoConversation,
  QuoCreateContactInput,
  QuoListResponse,
  QuoMessage,
  QuoPhoneNumber,
  QuoSendMessageInput,
  QuoUpdateContactInput,
} from './quo-chat.types';

interface QuoMutationResponse<TData> {
  data?: TData;
}

interface QuoMessageMutationData {
  id?: string;
}

class QuoApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly details: string,
  ) {
    super(`Quo API request failed (${status}): ${details}`);
  }
}

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 7000;
const MAX_ATTEMPTS = 3;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class QuoChatClientService {
  private readonly logger = new Logger(QuoChatClientService.name);
  private readonly config = loadQuoSmsConfig();

  constructor() {
    if (!this.config) {
      this.logger.warn(
        'Quo chat client disabled: missing QUO_API_BASE_URL/QUO_API_KEY/QUO_FROM_NUMBER/QUO_FROM_NUMBER_ID/QUO_USER_ID.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config);
  }

  getFromNumber(): string | null {
    return this.config?.fromNumber ?? null;
  }

  async listPhoneNumbers(limit = 1): Promise<QuoListResponse<QuoPhoneNumber>> {
    return this.get<QuoListResponse<QuoPhoneNumber>>('/phone-numbers', {
      maxResults: limit,
    });
  }

  async listConversations(
    pageToken?: string,
    limit = 30,
  ): Promise<QuoListResponse<QuoConversation>> {
    return this.get<QuoListResponse<QuoConversation>>('/conversations', {
      pageToken,
      maxResults: limit,
    });
  }

  async listMessages(
    conversation: Pick<
      QuoConversation,
      'id' | 'participants' | 'phoneNumberId'
    >,
    pageToken?: string,
    limit = 50,
  ): Promise<QuoListResponse<QuoMessage>> {
    const participant = conversation.participants?.find(
      (value) => value.trim().length > 0,
    );
    if (!participant || !conversation.phoneNumberId) {
      return { data: [], nextPageToken: null, totalItems: 0 };
    }

    return this.get<QuoListResponse<QuoMessage>>('/messages', {
      phoneNumberId: conversation.phoneNumberId,
      participants: participant,
      pageToken,
      maxResults: limit,
    });
  }

  async listContacts(
    pageToken?: string,
    limit = 100,
  ): Promise<QuoListResponse<QuoContact>> {
    return this.get<QuoListResponse<QuoContact>>('/contacts', {
      pageToken,
      maxResults: limit,
    });
  }

  async createContact(
    input: QuoCreateContactInput,
  ): Promise<QuoContact | null> {
    const response = await this.post<QuoMutationResponse<QuoContact>>(
      '/contacts',
      input,
    );
    return response.data ?? null;
  }

  async updateContact(
    contactId: string,
    input: QuoUpdateContactInput,
  ): Promise<QuoContact | null> {
    const response = await this.patch<QuoMutationResponse<QuoContact>>(
      `/contacts/${encodeURIComponent(contactId)}`,
      input,
    );
    return response.data ?? null;
  }

  async sendTextMessage(input: QuoSendMessageInput): Promise<string> {
    const config = this.requireConfig();
    const response = await this.post<
      QuoMutationResponse<QuoMessageMutationData>
    >('/messages', {
      to: [input.to],
      from: config.fromNumber,
      phoneNumberId: config.fromNumberId,
      userId: config.userId,
      content: input.content,
    });

    return response.data?.id ?? `${Date.now()}`;
  }

  private async get<TResponse>(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<TResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && `${value}`.length > 0) {
        search.set(key, `${value}`);
      }
    }

    const query = search.toString();
    const withQuery = query.length > 0 ? `${path}?${query}` : path;
    return this.request<TResponse>(withQuery, { method: 'GET' });
  }

  private async post<TResponse>(
    path: string,
    body: unknown,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async patch<TResponse>(
    path: string,
    body: unknown,
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  private async request<TResponse>(
    path: string,
    init: RequestInit,
  ): Promise<TResponse> {
    const config = this.requireConfig();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < MAX_ATTEMPTS) {
      attempt += 1;
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS,
        );
        const response = await fetch(`${config.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: config.apiKey,
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
          },
        });
        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const details = await this.readErrorBody(response);
          const error = new QuoApiRequestError(response.status, details);
          if (
            RETRYABLE_STATUSES.has(response.status) &&
            attempt < MAX_ATTEMPTS
          ) {
            await sleep(this.nextBackoffMs(attempt));
            continue;
          }
          throw error;
        }

        const text = await response.text();
        if (text.length === 0) {
          return {} as TResponse;
        }
        return JSON.parse(text) as TResponse;
      } catch (error) {
        if (
          error instanceof QuoApiRequestError &&
          !RETRYABLE_STATUSES.has(error.status)
        ) {
          throw error;
        }
        lastError = error as Error;
        if (attempt >= MAX_ATTEMPTS) {
          break;
        }
        await sleep(this.nextBackoffMs(attempt));
      }
    }

    throw lastError ?? new Error('Quo API request failed unexpectedly.');
  }

  private requireConfig() {
    if (!this.config) {
      throw new Error(
        'Quo API is not configured. Set QUO_API_BASE_URL/QUO_API_KEY/QUO_FROM_NUMBER/QUO_FROM_NUMBER_ID/QUO_USER_ID.',
      );
    }
    return this.config;
  }

  private async readErrorBody(response: Response): Promise<string> {
    const body = await response.text();
    return body.length > 0 ? body : 'No response body.';
  }

  private nextBackoffMs(attempt: number): number {
    return Math.min(1200, 200 * 2 ** (attempt - 1));
  }
}

export { QuoApiRequestError };
