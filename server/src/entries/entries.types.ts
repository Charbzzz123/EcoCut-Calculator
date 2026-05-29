import type {
  CreateEntryDto,
  EntryCalendarDto,
  EntryExecutionDto,
  EntryFormDto,
  EntryVariant,
  HedgeConfigDto,
} from './dto/create-entry.dto';

export interface StoredEntry extends CreateEntryDto {
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
  variant: EntryVariant;
  jobValue: string;
  jobType: string;
  location: string;
  contactPhone: string;
  contactEmail?: string;
  desiredBudget?: string;
  additionalDetails?: string;
  calendar?: EntryCalendarDto;
  execution?: EntryExecutionDto;
  hedges: Record<string, HedgeConfigDto>;
  hedgePlan: string[];
  form: EntryFormDto;
}

export interface ClientDetail extends ClientSummary {
  history: ClientHistoryEntry[];
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

export interface EntryExecutionCompletionPayload {
  startedAt: string | null;
  endedAt: string;
  completionNote: string | null;
  completedByRole: 'owner' | 'manager';
  crew: {
    employeeId: string;
    fullName: string;
    hoursWorked: number;
  }[];
}
