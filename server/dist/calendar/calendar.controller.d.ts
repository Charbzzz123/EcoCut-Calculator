import { CalendarService } from './calendar.service.js';
import type { CreateCalendarEventDto } from './dto/create-calendar-event.dto.js';
export declare class CalendarController {
    private readonly calendarService;
    constructor(calendarService: CalendarService);
    createEvent(body: CreateCalendarEventDto): Promise<import("googleapis").calendar_v3.Schema$Event>;
    listEvents(timeMin?: string, timeMax?: string): Promise<import("./dto/calendar-event.dto.js").CalendarEventDto[]>;
    deleteEvent(eventId: string): Promise<{
        eventId: string;
        deleted: boolean;
    }>;
}
