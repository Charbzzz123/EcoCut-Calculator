import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateEntryDto,
  EntryCalendarDto,
  EntryVariant,
  HedgeConfigDto,
} from './dto/create-entry.dto.js';

export interface StoredEntry extends CreateEntryDto {
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
}export interface ClientHistoryEntry {
  entryId: string;
  createdAt: string;
  variant: EntryVariant;
  jobValue: string;
  jobType: string;
  desiredBudget?: string;
  additionalDetails?: string;
  calendar?: EntryCalendarDto;
  hedges: Record<string, HedgeConfigDto>;
}

export interface ClientDetail extends ClientSummary {
  history: ClientHistoryEntry[];
}


@Injectable()
export class EntriesService {
  private readonly entries: StoredEntry[] = [];
  private readonly clients = new Map<string, ClientSummary>();

  createEntry(payload: CreateEntryDto): StoredEntry {
    const created: StoredEntry = {
      ...payload,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.entries.push(created);
    this.upsertClientSummary(created);
    return created;
  }

  listEntries(): StoredEntry[] {
    return [...this.entries];
  }

  listClients(): ClientSummary[] {
    return Array.from(this.clients.values()).sort((a, b) =>
      b.lastJobDate.localeCompare(a.lastJobDate),
    );
  }
  getClientDetails(clientId: string): ClientDetail {
    const summary = this.clients.get(clientId);
    if (!summary) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }

    const history = this.entries
      .filter((entry) => this.computeClientKey(entry) === clientId)
      .map((entry) => ({
        entryId: entry.id,
        createdAt: entry.createdAt,
        variant: entry.variant,
        jobValue: entry.form.jobValue,
        jobType: entry.form.jobType,
        desiredBudget: entry.form.desiredBudget,
        additionalDetails: entry.form.additionalDetails,
        calendar: entry.calendar,
        hedges: entry.hedges,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { ...summary, history };
  }

  private upsertClientSummary(entry: StoredEntry): void {
    const key = this.computeClientKey(entry);
    const existing = this.clients.get(key);
    const fullName = `${entry.form.firstName} ${entry.form.lastName}`.trim();
    if (existing) {
      const updated: ClientSummary = {
        ...existing,
        jobsCount: existing.jobsCount + 1,
        lastJobDate: entry.createdAt,
        lastCalendarEventId:
          entry.calendar?.eventId ?? existing.lastCalendarEventId,
      };
      this.clients.set(key, updated);
      return;
    }
    const summary: ClientSummary = {
      clientId: key,
      fullName,
      address: entry.form.address,
      phone: entry.form.phone,
      email: entry.form.email,
      jobsCount: 1,
      lastJobDate: entry.createdAt,
      lastCalendarEventId: entry.calendar?.eventId,
    };
    this.clients.set(key, summary);
  }

  private computeClientKey(entry: StoredEntry): string {
    const { email, phone, firstName, lastName, address } = entry.form;
    if (email?.trim()) {
      return email.trim().toLowerCase();
    }
    if (phone?.trim()) {
      return phone.replace(/\D/g, '');
    }
    return `${firstName}::${lastName}::${address}`.toLowerCase();
  }
}

