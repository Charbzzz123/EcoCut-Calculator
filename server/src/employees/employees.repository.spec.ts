import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { EmployeesRepository } from './employees.repository';

describe('EmployeesRepository', () => {
  const dbPath = join(process.cwd(), '.tmp-employees.repository.spec.db');
  const repositories: EmployeesRepository[] = [];

  beforeEach(() => {
    process.env.EMPLOYEES_DB_PATH = dbPath;
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
    if (existsSync(`${dbPath}-wal`)) {
      rmSync(`${dbPath}-wal`);
    }
    if (existsSync(`${dbPath}-shm`)) {
      rmSync(`${dbPath}-shm`);
    }
  });

  afterEach(() => {
    while (repositories.length) {
      const repository = repositories.pop();
      repository?.close();
    }
    delete process.env.EMPLOYEES_DB_PATH;
    if (existsSync(dbPath)) {
      rmSync(dbPath);
    }
    if (existsSync(`${dbPath}-wal`)) {
      rmSync(`${dbPath}-wal`);
    }
    if (existsSync(`${dbPath}-shm`)) {
      rmSync(`${dbPath}-shm`);
    }
  });

  it('returns seeded snapshot when no persisted state exists', async () => {
    const repository = new EmployeesRepository();
    repositories.push(repository);
    const snapshot = await repository.loadSnapshot();
    expect(snapshot.roster.length).toBeGreaterThan(1);
    expect(snapshot.hours.length).toBeGreaterThan(1);
    expect(snapshot.history.length).toBeGreaterThan(1);
  });

  it('persists and reloads snapshot updates', async () => {
    const repository = new EmployeesRepository();
    repositories.push(repository);
    const snapshot = await repository.loadSnapshot();
    snapshot.roster.push({
      id: 'emp-test',
      firstName: 'Test',
      lastName: 'Employee',
      fullName: 'Test Employee',
      phone: '(438) 999-0000',
      email: null,
      role: 'Crew',
      hourlyRate: 28,
      notes: '',
      status: 'active',
      lastActivityAt: null,
    });
    await repository.saveSnapshot(snapshot);

    const secondRepository = new EmployeesRepository();
    repositories.push(secondRepository);
    const reloaded = await secondRepository.loadSnapshot();
    expect(reloaded.roster.some((entry) => entry.id === 'emp-test')).toBe(true);
  });
});
