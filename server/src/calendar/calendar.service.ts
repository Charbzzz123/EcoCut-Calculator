import { Injectable, Logger } from '@nestjs/common';
import { calendar_v3, google } from 'googleapis';
import { loadCalendarConfig } from './calendar.config.js';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto.js';

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private calendarId?: string;
  private calendar?: calendar_v3.Calendar;

  constructor() {
    try {
      const config = loadCalendarConfig();
      this.calendarId = config.calendarId;

      const privateKey = config.credentials.private_key.replace(/\\n/g, '\n');
      const auth = new google.auth.JWT(
        config.credentials.client_email,
        undefined,
        privateKey,
        CALENDAR_SCOPES,
      );

      this.calendar = google.calendar({ version: 'v3', auth });
      this.logger.log(`Google Calendar ready (target: ${this.calendarId})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Google Calendar disabled: ${message}`);
    }
  }

  async createEvent(payload: CreateCalendarEventDto): Promise<calendar_v3.Schema$Event> {
    this.ensureConfigured();

    const requestBody: calendar_v3.Schema$Event = {
      summary: payload.summary,
      description: payload.description ?? undefined,
      location: payload.location,
      start: {
        dateTime: payload.start,
        timeZone: payload.timeZone ?? 'America/Toronto',
      },
      end: {
        dateTime: payload.end,
        timeZone: payload.timeZone ?? 'America/Toronto',
      },
      attendees: payload.attendees?.map((email) => ({ email })),
    };

    this.logger.log(`Creating calendar event for "${payload.summary}"`);

    const { data } = await this.calendar!.events.insert({
      calendarId: this.calendarId!,
      requestBody,
    });

    return data;
  }

  async deleteEvent(eventId: string): Promise<{ eventId: string; deleted: boolean }> {
    this.ensureConfigured();

    await this.calendar!.events.delete({
      calendarId: this.calendarId!,
      eventId,
    });

    this.logger.log(`Deleted calendar event ${eventId}`);

    return { eventId, deleted: true };
  }

  private ensureConfigured(): asserts this is {
    calendarId: string;
    calendar: calendar_v3.Calendar;
  } & CalendarService {
    if (!this.calendar || !this.calendarId) {
      throw new Error(
        'Google Calendar is not configured. Set GOOGLE_CALENDAR_CREDENTIALS or GOOGLE_CALENDAR_CREDENTIALS_PATH before calling this endpoint.',
      );
    }
  }
}
