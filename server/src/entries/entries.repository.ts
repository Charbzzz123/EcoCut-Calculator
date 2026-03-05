import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StoredEntry } from './entries.types.js';

interface EntriesSnapshot {
  entries: StoredEntry[];
}

const FALLBACK_STORE_PATH =
  process.env.ENTRIES_STORE_PATH ??
  join(process.cwd(), 'data', 'entries-store.json');

@Injectable()
export class EntriesRepository {
  private readonly logger = new Logger(EntriesRepository.name);
  private readonly storePath = FALLBACK_STORE_PATH;

  async loadEntries(): Promise<StoredEntry[]> {
    try {
      const raw = await fs.readFile(this.storePath, 'utf8');
      const snapshot = JSON.parse(raw) as Partial<EntriesSnapshot>;
      if (Array.isArray(snapshot.entries)) {
        return snapshot.entries;
      }
      return [];
    } catch (error: unknown) {
      if (this.isFileMissing(error)) {
        await this.ensureFile({ entries: [] });
        return [];
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to load entries store: ${message}`);
      throw error;
    }
  }

  async saveEntries(entries: StoredEntry[]): Promise<void> {
    await this.ensureFile({ entries });
  }

  private async ensureFile(snapshot: EntriesSnapshot): Promise<void> {
    await fs.mkdir(dirname(this.storePath), { recursive: true });
    await fs.writeFile(
      this.storePath,
      JSON.stringify(snapshot, null, 2),
      'utf8',
    );
  }

  private isFileMissing(error: unknown): error is NodeJS.ErrnoException {
    if (!error || typeof error !== 'object') {
      return false;
    }
    return (
      'code' in (error as Record<string, unknown>) &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
