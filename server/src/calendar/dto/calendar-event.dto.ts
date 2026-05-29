export interface CalendarEventDto {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}
