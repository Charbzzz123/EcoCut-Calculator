import { Injectable, Logger } from '@nestjs/common';
import { calendar_v3, google } from 'googleapis';
import { loadCalendarConfig } from './calendar.config.js';
import type { CreateCalendarEventDto } from './dto/create-calendar-event.dto.js';
import type { CalendarEventDto } from './dto/calendar-event.dto.js';

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
      const auth = new google.auth.JWT({
        email: config.credentials.client_email,
        key: privateKey,
        scopes: CALENDAR_SCOPES,
      });

      this.calendar = google.calendar({ version: 'v3', auth });
      this.logger.log(`Google Calendar ready (target: ${this.calendarId})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Google Calendar disabled: ${message}`);
    }
  }

  async createEvent(
    payload: CreateCalendarEventDto,
  ): Promise<calendar_v3.Schema$Event> {
    const { calendar, calendarId } = this.requireCalendar();
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

    const { data } = await calendar.events.insert({
      calendarId,
      requestBody,
    });

    return data;
  }

  async deleteEvent(
    eventId: string,
  ): Promise<{ eventId: string; deleted: boolean }> {
    const { calendar, calendarId } = this.requireCalendar();
    await calendar.events.delete({
      calendarId,
      eventId,
    });

    this.logger.log(`Deleted calendar event ${eventId}`);

    return { eventId, deleted: true };
  }

  async listEvents(params: {
    timeMin: string;
    timeMax: string;
  }): Promise<CalendarEventDto[]> {
    const { calendar, calendarId } = this.requireCalendar();
    const { data } = await calendar.events.list({
      calendarId,
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (data.items ?? [])
      .filter((event) => !!event.start?.dateTime || !!event.start?.date)
      .map((event) => ({
        id:
          event.id ??
          `${event.start?.dateTime ?? event.start?.date ?? Date.now()}`,
        summary: event.summary ?? 'Scheduled job',
        start: event.start?.dateTime ?? event.start?.date ?? '',
        end: event.end?.dateTime ?? event.end?.date ?? '',
        location: event.location ?? undefined,
        description: event.description ?? undefined,
      }));
  }

  private requireCalendar(): {
    calendar: calendar_v3.Calendar;
    calendarId: string;
  } {
    const calendar = this.calendar;
    const calendarId = this.calendarId;
    if (!calendar || !calendarId) {
      throw new Error(
        'Google Calendar is not configured. Set GOOGLE_CALENDAR_CREDENTIALS or GOOGLE_CALENDAR_CREDENTIALS_PATH before calling this endpoint.',
      );
    }
    return { calendar, calendarId };
  }
}
