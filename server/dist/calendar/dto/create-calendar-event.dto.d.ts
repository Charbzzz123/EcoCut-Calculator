export interface CreateCalendarEventDto {
    summary: string;
    description?: string;
    start: string;
    end: string;
    timeZone?: string;
    location?: string;
    attendees?: string[];
}
