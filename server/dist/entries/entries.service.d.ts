import type { CreateEntryDto } from './dto/create-entry.dto.js';
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
export declare class EntriesService {
    private readonly entries;
    private readonly clients;
    createEntry(payload: CreateEntryDto): StoredEntry;
    listEntries(): StoredEntry[];
    listClients(): ClientSummary[];
    private upsertClientSummary;
    private computeClientKey;
}
