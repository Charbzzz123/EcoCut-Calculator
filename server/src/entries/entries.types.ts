import type {
  CreateEntryDto,
  EntryCalendarDto,
  EntryExecutionDto,
  EntryFormDto,
  EntryVariant,
  SalesStatus,
  HedgeConfigDto,
} from './dto/create-entry.dto';

export interface StoredEntry extends CreateEntryDto {
  id: string;
  createdAt: string;
  /** Optional only while migrating records written before the lifecycle field existed. */
  salesStatus?: SalesStatus;
  salesStatusChangedAt?: string;
  acceptedAt?: string | null;
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
  relationshipStatus?: 'lead' | 'customer' | 'inactive';
  openOpportunityCount?: number;
  toScheduleCount?: number;
  acceptedOpportunityCount?: number;
  lastJobDate: string | null;
  nextJobDate?: string | null;
  lastCalendarEventId?: string;
}

export interface ClientHistoryEntry {
  entryId: string;
  createdAt: string;
  variant: EntryVariant;
  salesStatus?: SalesStatus;
  salesStatusChangedAt?: string;
  followUpNote?: string;
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

export interface UpdateSalesStatusDto {
  salesStatus: SalesStatus;
  calendar?: EntryCalendarDto | null;
  followUpNote?: string | null;
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
