import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

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

interface ListRangeOptions {
  forceRefresh?: boolean;
}

interface CachedRange {
  events: CalendarEventSummary[];
  expiresAt: number;
}

const RANGE_CACHE_TTL_MS = 5 * 60 * 1000;
const RANGE_CACHE_LIMIT = 24;

@Injectable({ providedIn: 'root' })
export class CalendarEventsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/calendar/events`;
  private readonly rangeCache = new Map<string, CachedRange>();
  private readonly inflightRanges = new Map<string, Promise<CalendarEventSummary[]>>();

  async listEventsForRange(
    startDate: string,
    endDate: string,
    options: ListRangeOptions = {},
  ): Promise<CalendarEventSummary[]> {
    const key = this.rangeKey(startDate, endDate);
    const cached = this.getCachedRangeValue(key);
    if (cached && !options.forceRefresh) {
      return cached;
    }

    const inflight = this.inflightRanges.get(key);
    if (inflight) {
      return inflight;
    }

    const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
    const timeMax = new Date(`${endDate}T23:59:59`).toISOString();
    const params = { timeMin, timeMax };
    const request = firstValueFrom(this.http.get<CalendarEventSummary[]>(this.baseUrl, { params }))
      .then((events) => {
        this.setCachedRangeValue(key, events);
        return events;
      })
      .finally(() => {
        this.inflightRanges.delete(key);
      });

    this.inflightRanges.set(key, request);
    return request;
  }

  async listEventsForDate(date: string): Promise<CalendarEventSummary[]> {
    return this.listEventsForRange(date, date);
  }

  getCachedEventsForRange(startDate: string, endDate: string): CalendarEventSummary[] | null {
    return this.getCachedRangeValue(this.rangeKey(startDate, endDate));
  }

  async prefetchAroundDate(date: string, monthRadius = 1): Promise<void> {
    const anchor = new Date(`${date}T00:00:00`);
    const start = new Date(anchor.getFullYear(), anchor.getMonth() - monthRadius, 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + monthRadius + 1, 0);
    const startIso = this.toIsoDate(start);
    const endIso = this.toIsoDate(end);
    await this.listEventsForRange(startIso, endIso);
  }

  async createEvent(request: CreateCalendarEventRequest): Promise<CalendarEventSummary> {
    const created = await firstValueFrom(this.http.post<CalendarEventSummary>(this.baseUrl, request));
    this.clearRangeCache();
    return created;
  }

  async updateEvent(eventId: string, request: UpdateCalendarEventRequest): Promise<CalendarEventSummary> {
    const updated = await firstValueFrom(
      this.http.patch<CalendarEventSummary>(`${this.baseUrl}/${eventId}`, request),
    );
    this.clearRangeCache();
    return updated;
  }

  async deleteEvent(eventId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.baseUrl}/${eventId}`));
    this.clearRangeCache();
  }

  private rangeKey(startDate: string, endDate: string): string {
    return `${startDate}::${endDate}`;
  }

  private getCachedRangeValue(key: string): CalendarEventSummary[] | null {
    const cached = this.rangeCache.get(key);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      this.rangeCache.delete(key);
      return null;
    }
    this.rangeCache.delete(key);
    this.rangeCache.set(key, cached);
    return cached.events.map((event) => ({ ...event }));
  }

  private setCachedRangeValue(key: string, events: CalendarEventSummary[]): void {
    this.rangeCache.delete(key);
    this.rangeCache.set(key, {
      events: events.map((event) => ({ ...event })),
      expiresAt: Date.now() + RANGE_CACHE_TTL_MS,
    });
    while (this.rangeCache.size > RANGE_CACHE_LIMIT) {
      const oldestKey = this.rangeCache.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.rangeCache.delete(oldestKey);
    }
  }

  private clearRangeCache(): void {
    this.rangeCache.clear();
    this.inflightRanges.clear();
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
