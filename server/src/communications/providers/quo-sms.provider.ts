import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { loadQuoSmsConfig } from '../communications.config';
import type { SmsMessagePayload } from '../communications.types';
import type { SmsProvider } from './sms-provider';

interface QuoMessageResponse {
  data?: {
    id?: string;
  };
}

@Injectable()
export class QuoSmsProvider implements SmsProvider {
  private readonly logger = new Logger(QuoSmsProvider.name);
  private readonly config = loadQuoSmsConfig();

  constructor() {
    if (!this.config) {
      this.logger.warn(
        'Quo SMS provider disabled: missing QUO_API_BASE_URL/QUO_API_KEY/QUO_FROM_NUMBER/QUO_FROM_NUMBER_ID/QUO_USER_ID.',
      );
    }
  }

  async send(message: SmsMessagePayload): Promise<string> {
    if (!this.config) {
      throw new ServiceUnavailableException(
        'SMS transport is not configured. Set QUO_* environment variables.',
      );
    }

    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        Authorization: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [message.to],
        from: this.config.fromNumber,
        phoneNumberId: this.config.fromNumberId,
        userId: this.config.userId,
        content: message.body,
      }),
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Quo SMS send failed (${response.status}): ${payload}`);
    }

    const payload = (await response.json()) as QuoMessageResponse;
    return payload.data?.id ?? `${Date.now()}`;
  }
}
