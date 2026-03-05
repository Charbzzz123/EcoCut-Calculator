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
}

export interface ClientHistoryEntry {
  entryId: string;
  createdAt: string;
  variant: EntryVariant;
  jobValue: string;
  jobType: string;
  location: string;
  contactPhone: string;
  contactEmail?: string;
  desiredBudget?: string;
  additionalDetails?: string;
  calendar?: EntryCalendarDto;
  hedges: Record<string, HedgeConfigDto>;
}

export interface ClientDetail extends ClientSummary {
  history: ClientHistoryEntry[];
}
