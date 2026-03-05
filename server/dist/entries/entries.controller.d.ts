import { EntriesService } from './entries.service.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';
export declare class EntriesController {
    private readonly entries;
    constructor(entries: EntriesService);
    create(body: CreateEntryDto): import("./entries.service.js").StoredEntry;
    listEntries(): import("./entries.service.js").StoredEntry[];
    listClients(): import("./entries.service.js").ClientSummary[];
    getClient(clientId: string): import("./entries.service.js").ClientDetail;
}
