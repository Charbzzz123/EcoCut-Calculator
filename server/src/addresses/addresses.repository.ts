import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AddressUsageMetric } from './addresses.types';

interface UsageRow {
  readonly metric: AddressUsageMetric;
  readonly count: number;
}

const resolveDbPath = (): string =>
  process.env.ADDRESS_USAGE_DB_PATH ??
  join(process.cwd(), 'server', 'data', 'address-usage.db');

@Injectable()
export class AddressesUsageRepository implements OnModuleDestroy {
  private readonly logger = new Logger(AddressesUsageRepository.name);
  private readonly dbPath = resolveDbPath();
  private readonly db: Database.Database;
  private readonly selectMonthlyStmt: Database.Statement;
  private readonly upsertStmt: Database.Statement;

  constructor() {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS address_usage (
          month_key TEXT NOT NULL,
          metric TEXT NOT NULL,
          count INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (month_key, metric)
        )`,
      )
      .run();

    this.selectMonthlyStmt = this.db.prepare(
      'SELECT metric, count FROM address_usage WHERE month_key = ?',
    );
    this.upsertStmt = this.db.prepare(
      `INSERT INTO address_usage (month_key, metric, count, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(month_key, metric) DO UPDATE SET
         count = excluded.count,
         updated_at = excluded.updated_at`,
    );
  }

  getMonthlyCounts(monthKey: string): Record<AddressUsageMetric, number> {
    const rows = this.selectMonthlyStmt.all(monthKey) as UsageRow[];
    const baseline: Record<AddressUsageMetric, number> = {
      autocomplete_requests: 0,
      place_details_requests: 0,
      address_validation_requests: 0,
    };

    for (const row of rows) {
      baseline[row.metric] = row.count;
    }

    return baseline;
  }

  increment(monthKey: string, metric: AddressUsageMetric, amount = 1): number {
    const counts = this.getMonthlyCounts(monthKey);
    const nextValue = counts[metric] + amount;
    this.persist(monthKey, metric, nextValue);
    return nextValue;
  }

  private persist(
    monthKey: string,
    metric: AddressUsageMetric,
    value: number,
  ): void {
    try {
      this.upsertStmt.run(monthKey, metric, value, new Date().toISOString());
    } catch (error) {
      this.logger.warn(
        `Failed to persist address usage for ${metric}: ${this.stringifyError(error)}`,
      );
    }
  }

  onModuleDestroy(): void {
    if (this.db.open) {
      this.db.close();
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }
}
