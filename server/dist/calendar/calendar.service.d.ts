import { calendar_v3 } from 'googleapis';
import type { CreateCalendarEventDto } from './dto/create-calendar-event.dto.js';
import type { CalendarEventDto } from './dto/calendar-event.dto.js';
export declare class CalendarService {
    private readonly logger;
    private calendarId?;
    private calendar?;
    constructor();
    createEvent(payload: CreateCalendarEventDto): Promise<calendar_v3.Schema$Event>;
    deleteEvent(eventId: string): Promise<{
        eventId: string;
        deleted: boolean;
    }>;
    listEvents(params: {
        timeMin: string;
        timeMax: string;
    }): Promise<CalendarEventDto[]>;
    private requireCalendar;
}
