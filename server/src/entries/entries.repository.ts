import { Injectable, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { promises as fs, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StoredEntry } from './entries.types';

interface DbRow {
  payload: string;
}

const LEGACY_JSON_PATH =
  process.env.ENTRIES_STORE_PATH ??
  join(process.cwd(), 'server', 'data', 'entries-store.json');

const DEFAULT_DB_PATH =
  process.env.ENTRIES_DB_PATH ??
  join(process.cwd(), 'server', 'data', 'entries.db');

@Injectable()
export class EntriesRepository {
  private readonly logger = new Logger(EntriesRepository.name);
  private readonly dbPath = DEFAULT_DB_PATH;
  private readonly db: Database.Database;
  private readonly selectAllStmt: Database.Statement;
  private readonly deleteAllStmt: Database.Statement;
  private readonly insertStmt: Database.Statement;
  private readonly countStmt: Database.Statement;
  private legacyMigrated = false;

  constructor() {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )`,
      )
      .run();

    this.selectAllStmt = this.db.prepare(
      `SELECT payload FROM entries ORDER BY json_extract(payload, '$.createdAt') ASC`,
    );
    this.deleteAllStmt = this.db.prepare('DELETE FROM entries');
    this.insertStmt = this.db.prepare('INSERT INTO entries (id, payload) VALUES (?, ?)');
    this.countStmt = this.db.prepare('SELECT COUNT(*) as total FROM entries');
  }

  async loadEntries(): Promise<StoredEntry[]> {
    await this.migrateLegacySnapshot();
    const rows = this.selectAllStmt.all() as DbRow[];
    return rows.map((row) => JSON.parse(row.payload) as StoredEntry);
  }

  async saveEntries(entries: StoredEntry[]): Promise<void> {
    const tx = this.db.transaction((items: StoredEntry[]) => {
      this.deleteAllStmt.run();
      for (const entry of items) {
        this.insertStmt.run(entry.id, JSON.stringify(entry));
      }
    });
    tx(entries);
  }

  private async migrateLegacySnapshot(): Promise<void> {
    if (this.legacyMigrated) {
      return;
    }
    const { total } = this.countStmt.get() as { total: number };
    if (total > 0) {
      this.legacyMigrated = true;
      return;
    }
    try {
      const raw = await fs.readFile(LEGACY_JSON_PATH, 'utf8');
      const snapshot = JSON.parse(raw) as { entries?: StoredEntry[] };
      if (Array.isArray(snapshot.entries) && snapshot.entries.length > 0) {
        this.logger.log(
          `Migrating ${snapshot.entries.length} legacy entries from ${LEGACY_JSON_PATH} into ${this.dbPath}`,
        );
        const tx = this.db.transaction((items: StoredEntry[]) => {
          for (const entry of items) {
            this.insertStmt.run(entry.id, JSON.stringify(entry));
          }
        });
        tx(snapshot.entries);
      }
    } catch (error) {
      if (!this.isFileMissing(error)) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to import legacy entries store: ${message}`);
      }
    } finally {
      this.legacyMigrated = true;
    }
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
