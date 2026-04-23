import { Injectable } from '@nestjs/common';
import {
  QuoApiRequestError,
  QuoChatClientService,
} from './quo-chat-client.service';
import type { QuoChatProviderHealth } from './quo-chat.types';

const QUO_RATE_LIMIT_PER_SECOND = 10;

@Injectable()
export class CommunicationsChatsService {
  constructor(private readonly quoClient: QuoChatClientService) {}

  async getProviderHealth(): Promise<QuoChatProviderHealth> {
    if (!this.quoClient.isConfigured()) {
      return {
        provider: 'quo',
        configured: false,
        connected: false,
        checkedAt: new Date().toISOString(),
        rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
        phoneNumber: null,
        details:
          'QUO API credentials are missing. Configure QUO_* environment variables.',
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
        rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
        phoneNumber:
          first?.formattedNumber ??
          first?.number ??
          this.quoClient.getFromNumber(),
        details: 'Connection successful. Quo chat provider is reachable.',
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
          rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
          phoneNumber: this.quoClient.getFromNumber(),
          details,
        };
      }

      return {
        provider: 'quo',
        configured: true,
        connected: false,
        checkedAt: new Date().toISOString(),
        rateLimitPerSecond: QUO_RATE_LIMIT_PER_SECOND,
        phoneNumber: this.quoClient.getFromNumber(),
        details: `${defaultDetails} ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`,
      };
    }
  }
}
