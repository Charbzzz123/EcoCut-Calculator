import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CommunicationsStateSnapshot } from './communications.types';

interface DbRow {
  payload: string;
}

const resolveDbPath = (): string =>
  process.env.COMMUNICATIONS_DB_PATH ??
  join(process.cwd(), 'server', 'data', 'communications.db');

@Injectable()
export class CommunicationsRepository implements OnModuleDestroy {
  private readonly logger = new Logger(CommunicationsRepository.name);
  private readonly dbPath = resolveDbPath();
  private readonly db: Database.Database;
  private readonly selectStateStmt: Database.Statement;
  private readonly upsertStateStmt: Database.Statement;

  constructor() {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS communications_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      )
      .run();

    this.selectStateStmt = this.db.prepare(
      'SELECT payload FROM communications_state WHERE id = 1',
    );
    this.upsertStateStmt = this.db.prepare(
      `INSERT INTO communications_state (id, payload, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
    );
  }

  loadState(): CommunicationsStateSnapshot | null {
    try {
      const row = this.selectStateStmt.get() as DbRow | undefined;
      if (!row) {
        return null;
      }
      return JSON.parse(row.payload) as CommunicationsStateSnapshot;
    } catch (error) {
      this.logger.warn(
        `Failed to load communications state: ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  saveState(snapshot: CommunicationsStateSnapshot): void {
    try {
      this.upsertStateStmt.run(
        JSON.stringify(snapshot),
        new Date().toISOString(),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to save communications state: ${this.stringifyError(error)}`,
      );
    }
  }

  close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }

  onModuleDestroy(): void {
    this.close();
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }
}
