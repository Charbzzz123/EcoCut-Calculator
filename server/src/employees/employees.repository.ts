import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { EmployeesSnapshot } from './employees.types';

interface SnapshotRow {
  payload: string;
}

const resolveDbPath = (): string =>
  process.env.EMPLOYEES_DB_PATH ??
  join(process.cwd(), 'server', 'data', 'employees.db');

const SNAPSHOT_KEY = 'default';

const createSeedSnapshot = (): EmployeesSnapshot => ({
  roster: [
    {
      id: 'emp-karam',
      firstName: 'Karam',
      lastName: 'AbiNassif',
      fullName: 'Karam AbiNassif',
      phone: '(438) 555-1010',
      email: 'karam@ecocutqc.com',
      role: 'Crew lead',
      hourlyRate: 34,
      notes: 'Leads East-side crews.',
      status: 'active',
      lastActivityAt: '2026-03-20T14:00:00Z',
    },
    {
      id: 'emp-maryam',
      firstName: 'Maryam',
      lastName: 'Haddad',
      fullName: 'Maryam Haddad',
      phone: '(438) 555-2020',
      email: 'maryam@ecocutqc.com',
      role: 'Crew specialist',
      hourlyRate: 29,
      notes: 'Handles hedge contour finishing.',
      status: 'active',
      lastActivityAt: '2026-03-19T17:15:00Z',
    },
    {
      id: 'emp-youssef',
      firstName: 'Youssef',
      lastName: 'Bitar',
      fullName: 'Youssef Bitar',
      phone: '(438) 555-3030',
      email: null,
      role: 'Field support',
      hourlyRate: 25,
      notes: 'Seasonal availability only.',
      status: 'inactive',
      lastActivityAt: '2025-11-02T11:30:00Z',
    },
    {
      id: 'emp-nora',
      firstName: 'Nora',
      lastName: 'Sayegh',
      fullName: 'Nora Sayegh',
      phone: '(438) 555-4040',
      email: 'nora@ecocutqc.com',
      role: 'Estimator',
      hourlyRate: 31,
      notes: 'Provides quote walkthroughs.',
      status: 'active',
      lastActivityAt: null,
    },
  ],
  hours: [
    {
      id: 'hours-karam-2026-03-20',
      employeeId: 'emp-karam',
      workDate: '2026-03-20',
      siteLabel: 'Westmount - Pine Ave',
      hours: 8,
      source: 'manual',
      clockInAt: null,
      clockOutAt: null,
      updatedByRole: 'owner',
      updatedAt: '2026-03-20T19:12:00Z',
    },
    {
      id: 'hours-maryam-2026-03-19',
      employeeId: 'emp-maryam',
      workDate: '2026-03-19',
      siteLabel: 'Outremont - Maple Lane',
      hours: 7.5,
      source: 'manual',
      clockInAt: null,
      clockOutAt: null,
      updatedByRole: 'manager',
      updatedAt: '2026-03-19T18:45:00Z',
    },
    {
      id: 'hours-nora-2026-03-18',
      employeeId: 'emp-nora',
      workDate: '2026-03-18',
      siteLabel: 'NDG - Cedar Ridge',
      hours: 6,
      source: 'manual',
      clockInAt: null,
      clockOutAt: null,
      updatedByRole: 'owner',
      updatedAt: '2026-03-18T16:03:00Z',
    },
  ],
  history: [
    {
      id: 'job-karam-001',
      employeeId: 'emp-karam',
      siteLabel: 'Westmount Cedar Hedge',
      address: '1450 Pine Ave W, Westmount',
      scheduledStart: '2026-03-20T13:00:00Z',
      scheduledEnd: '2026-03-20T17:00:00Z',
      hoursWorked: 8,
      status: 'completed',
    },
    {
      id: 'job-karam-002',
      employeeId: 'emp-karam',
      siteLabel: 'NDG Maple Court',
      address: '2331 Sherbrooke St W, Montreal',
      scheduledStart: '2026-03-24T12:00:00Z',
      scheduledEnd: '2026-03-24T15:00:00Z',
      hoursWorked: 3,
      status: 'scheduled',
    },
    {
      id: 'job-maryam-001',
      employeeId: 'emp-maryam',
      siteLabel: 'Outremont Terrace',
      address: '620 Av. Bloomfield, Montreal',
      scheduledStart: '2026-03-19T12:30:00Z',
      scheduledEnd: '2026-03-19T16:00:00Z',
      hoursWorked: 7.5,
      status: 'completed',
    },
    {
      id: 'job-nora-001',
      employeeId: 'emp-nora',
      siteLabel: 'Laval Riverbend',
      address: '4100 Boul. Daniel-Johnson, Laval',
      scheduledStart: '2026-03-26T13:30:00Z',
      scheduledEnd: '2026-03-26T16:30:00Z',
      hoursWorked: 3,
      status: 'scheduled',
    },
  ],
});

const cloneSnapshot = (snapshot: EmployeesSnapshot): EmployeesSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as EmployeesSnapshot;

@Injectable()
export class EmployeesRepository {
  private readonly dbPath = resolveDbPath();
  private readonly db: Database.Database;
  private readonly selectSnapshotStmt: Database.Statement;
  private readonly upsertSnapshotStmt: Database.Statement;

  constructor() {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS employees_state (
          id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )`,
      )
      .run();
    this.selectSnapshotStmt = this.db.prepare(
      'SELECT payload FROM employees_state WHERE id = ?',
    );
    this.upsertSnapshotStmt = this.db.prepare(
      `INSERT INTO employees_state (id, payload)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    );
  }

  async loadSnapshot(): Promise<EmployeesSnapshot> {
    const row = this.selectSnapshotStmt.get(SNAPSHOT_KEY) as
      | SnapshotRow
      | undefined;
    if (row) {
      return cloneSnapshot(JSON.parse(row.payload) as EmployeesSnapshot);
    }

    const seeded = createSeedSnapshot();
    await this.saveSnapshot(seeded);
    return cloneSnapshot(seeded);
  }

  async saveSnapshot(snapshot: EmployeesSnapshot): Promise<void> {
    const payload = JSON.stringify(snapshot);
    await Promise.resolve(this.upsertSnapshotStmt.run(SNAPSHOT_KEY, payload));
  }

  close(): void {
    this.db.close();
  }
}
