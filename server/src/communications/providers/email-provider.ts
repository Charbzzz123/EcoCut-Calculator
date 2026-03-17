import type { EmailMessagePayload } from '../communications.types';

export interface EmailProvider {
  send(message: EmailMessagePayload): Promise<string>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
