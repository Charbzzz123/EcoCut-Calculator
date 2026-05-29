import type { SmsMessagePayload } from '../communications.types';

export interface SmsProvider {
  send(message: SmsMessagePayload): Promise<string>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
