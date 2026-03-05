import type { CreateEntryDto, EntryCalendarDto, EntryVariant, HedgeConfigDto } from './dto/create-entry.dto.js';
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
    desiredBudget?: string;
    additionalDetails?: string;
    calendar?: EntryCalendarDto;
    hedges: Record<string, HedgeConfigDto>;
}
export interface ClientDetail extends ClientSummary {
    history: ClientHistoryEntry[];
}
export declare class EntriesService {
    private readonly entries;
    private readonly clients;
    createEntry(payload: CreateEntryDto): StoredEntry;
    listEntries(): StoredEntry[];
    listClients(): ClientSummary[];
    getClientDetails(clientId: string): ClientDetail;
    private upsertClientSummary;
    private computeClientKey;
}
