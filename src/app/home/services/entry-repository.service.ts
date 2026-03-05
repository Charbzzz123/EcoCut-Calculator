import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EntryModalPayload } from '../models/entry-modal.models.js';

export interface StoredEntry extends EntryModalPayload {
  id: string;
  createdAt: string;
}

export interface ClientSummary {
  clientId: string;
  fullName: string;
  address: string;
  phone: string;
  email?: string;
  jobsCount: number;
  lastJobDate: string;
  lastCalendarEventId?: string;
}

export interface ClientHistoryEntry {
  entryId: string;
  createdAt: string;
  variant: EntryModalPayload['variant'];
  jobValue: string;
  jobType: string;
  location: string;
  contactPhone: string;
  contactEmail?: string;
  desiredBudget?: string;
  additionalDetails?: string;
  calendar?: EntryModalPayload['calendar'];
  hedges: EntryModalPayload['hedges'];
}

export interface ClientDetail extends ClientSummary {
  history: ClientHistoryEntry[];
}

@Injectable({ providedIn: 'root' })
export class EntryRepositoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/entries';

  async create(payload: EntryModalPayload): Promise<StoredEntry> {
    return firstValueFrom(this.http.post<StoredEntry>(this.baseUrl, payload));
  }

  async listClients(): Promise<ClientSummary[]> {
    return firstValueFrom(this.http.get<ClientSummary[]>(`${this.baseUrl}/clients`));
  }

  async getClientDetail(clientId: string): Promise<ClientDetail> {
    return firstValueFrom(this.http.get<ClientDetail>(`${this.baseUrl}/clients/${clientId}`));
  }
}

