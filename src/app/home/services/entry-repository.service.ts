import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { EntryModalPayload } from '../models/entry-modal.models.js';
import { environment } from '../../../environments/environment';

export interface StoredEntry extends EntryModalPayload {
  id: string;
  createdAt: string;
}

export interface ClientSummary {
  clientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  address: string;
  phone: string;
  email?: string;
  jobsCount: number;
  lastJobDate: string | null;
  nextJobDate?: string | null;
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
  hedgePlan: string[];
  form: EntryModalPayload['form'];
}

export interface ClientDetail extends ClientSummary {
  history: ClientHistoryEntry[];
}

export interface UpdateClientPayload {
  firstName?: string;
  lastName?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export type ClientMatchReason =
  | 'email'
  | 'phone-address'
  | 'phone-name'
  | 'name-address';

export interface ClientMatchResult {
  client: ClientSummary;
  matchedBy: ClientMatchReason;
  descriptor: string;
}

@Injectable({ providedIn: 'root' })
export class EntryRepositoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/entries`;

  async create(payload: EntryModalPayload): Promise<StoredEntry> {
    return firstValueFrom(this.http.post<StoredEntry>(this.baseUrl, payload));
  }

  async updateEntry(entryId: string, payload: EntryModalPayload): Promise<StoredEntry> {
    return firstValueFrom(
      this.http.patch<StoredEntry>(`${this.baseUrl}/${entryId}`, payload),
    );
  }

  async deleteEntry(entryId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/${entryId}`));
  }

  async listClients(): Promise<ClientSummary[]> {
    return firstValueFrom(this.http.get<ClientSummary[]>(`${this.baseUrl}/clients`));
  }

  async getClientDetail(clientId: string): Promise<ClientDetail> {
    return firstValueFrom(this.http.get<ClientDetail>(`${this.baseUrl}/clients/${clientId}`));
  }

  async findClientMatch(form: EntryModalPayload['form']): Promise<ClientMatchResult | null> {
    return firstValueFrom(
      this.http.post<ClientMatchResult | null>(`${this.baseUrl}/clients/match`, { form }),
    );
  }

  async updateClient(
    clientId: string,
    payload: UpdateClientPayload,
  ): Promise<ClientSummary> {
    return firstValueFrom(
      this.http.patch<ClientSummary>(`${this.baseUrl}/clients/${clientId}`, payload),
    );
  }

  async deleteClient(clientId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.baseUrl}/clients/${clientId}`));
  }
}
