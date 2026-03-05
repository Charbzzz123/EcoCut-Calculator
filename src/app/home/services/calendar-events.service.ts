import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CalendarEventSummary {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface CreateCalendarEventRequest {
  summary: string;
  description?: string;
  start: string;
  end: string;
  timeZone?: string;
  location?: string;
  attendees?: string[];
}

export type UpdateCalendarEventRequest = Partial<CreateCalendarEventRequest>;

@Injectable({ providedIn: 'root' })
export class CalendarEventsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/calendar/events`;

  async listEventsForDate(date: string): Promise<CalendarEventSummary[]> {
    const timeMin = new Date(`${date}T00:00:00`).toISOString();
    const timeMax = new Date(`${date}T23:59:59`).toISOString();
    const params = { timeMin, timeMax };
    return firstValueFrom(this.http.get<CalendarEventSummary[]>(this.baseUrl, { params }));
  }

  async createEvent(request: CreateCalendarEventRequest): Promise<CalendarEventSummary> {
    return firstValueFrom(this.http.post<CalendarEventSummary>(this.baseUrl, request));
  }

  async updateEvent(eventId: string, request: UpdateCalendarEventRequest): Promise<CalendarEventSummary> {
    return firstValueFrom(this.http.patch<CalendarEventSummary>(`${this.baseUrl}/${eventId}`, request));
  }

  async deleteEvent(eventId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${eventId}`));
  }
}
