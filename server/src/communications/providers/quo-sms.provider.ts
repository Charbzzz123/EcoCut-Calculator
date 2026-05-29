import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { QuoChatClientService } from '../chats/quo-chat-client.service';
import type { SmsMessagePayload } from '../communications.types';
import type { SmsProvider } from './sms-provider';

@Injectable()
export class QuoSmsProvider implements SmsProvider {
  constructor(private readonly quoClient: QuoChatClientService) {}

  async send(message: SmsMessagePayload): Promise<string> {
    if (!this.quoClient.isConfigured()) {
      throw new ServiceUnavailableException(
        'SMS transport is not configured. Set QUO_* environment variables.',
      );
    }

    return this.quoClient.sendTextMessage({
      to: message.to,
      content: message.body,
    });
  }
}
