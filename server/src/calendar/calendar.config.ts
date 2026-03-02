import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

export interface CalendarConfig {
  credentials: ServiceAccountCredentials;
  calendarId: string;
}

function readCredentialsFromEnv(): string | undefined {
  if (process.env.GOOGLE_CALENDAR_CREDENTIALS) {
    return process.env.GOOGLE_CALENDAR_CREDENTIALS;
  }

  const filePath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH;
  if (filePath) {
    return readFileSync(resolve(filePath), 'utf8');
  }

  return undefined;
}

export function loadCalendarConfig(): CalendarConfig {
  const rawCredentials = readCredentialsFromEnv();

  if (!rawCredentials) {
    throw new Error(
      'Google Calendar credentials missing. Provide GOOGLE_CALENDAR_CREDENTIALS (JSON string) or GOOGLE_CALENDAR_CREDENTIALS_PATH (file path).',
    );
  }

  let parsed: Partial<ServiceAccountCredentials>;
  try {
    parsed = JSON.parse(rawCredentials);
  } catch (error) {
    throw new Error('Unable to parse Google Calendar credentials JSON.');
  }

  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error('Google Calendar credentials must include client_email and private_key.');
  }

  return {
    credentials: {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    },
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'ecojcut@gmail.com',
  };
}
