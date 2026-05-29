import { promises as fs } from 'node:fs';
import type { StoredEntry } from './entries.types';
import { EntriesRepository } from './entries.repository';

interface DbRow {
  id: string;
  payload: string;
}

const createDbMock = () => {
  const rows: DbRow[] = [];
  return {
    rows,
    pragma: jest.fn(),
    prepare: jest.fn((sql: string) => {
      if (sql.startsWith('SELECT payload FROM entries')) {
        return {
          all: jest.fn(() => rows.map((row) => ({ payload: row.payload }))),
        };
      }
      if (sql.startsWith('DELETE FROM entries')) {
        return {
          run: jest.fn(() => {
            rows.length = 0;
          }),
        };
      }
      if (sql.startsWith('INSERT INTO entries')) {
        return {
          run: jest.fn((id: string, payload: string) => {
            rows.push({ id, payload });
          }),
        };
      }
      if (sql.startsWith('SELECT COUNT(*)')) {
        return {
          get: jest.fn(() => ({ total: rows.length })),
        };
      }
      return {
        run: jest.fn(),
      };
    }),
    transaction: jest.fn((fn: (items: StoredEntry[]) => void) => {
      return (items: StoredEntry[]) => fn(items);
    }),
  };
};

const dbMock = createDbMock();

jest.mock('better-sqlite3', () => {
  return {
    __esModule: true,
    default: jest.fn(() => dbMock),
  };
});

jest.mock('node:fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
  mkdirSync: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('EntriesRepository', () => {
  let repository: EntriesRepository;

  beforeEach(() => {
    dbMock.rows.length = 0;
    mockedFs.readFile.mockReset();
    repository = new EntriesRepository();
  });

  it('loads migrated entries from the legacy snapshot when db is empty', async () => {
    const snapshot: StoredEntry[] = [
      { id: 'ent-1', createdAt: '2026-01-01T00:00:00.000Z' } as StoredEntry,
    ];
    mockedFs.readFile.mockResolvedValue(JSON.stringify({ entries: snapshot }));

    const entries = await repository.loadEntries();

    expect(entries).toEqual(snapshot);
    expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
  });

  it('ignores missing legacy snapshot files', async () => {
    const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' });
    mockedFs.readFile.mockRejectedValue(enoent);

    const entries = await repository.loadEntries();

    expect(entries).toEqual([]);
    expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
  });

  it('saves entries into the sqlite row store', async () => {
    const payload: StoredEntry[] = [
      { id: 'ent-2', createdAt: '2026-01-02T00:00:00.000Z' } as StoredEntry,
    ];

    await repository.saveEntries(payload);
    const entries = await repository.loadEntries();

    expect(entries).toEqual(payload);
  });
});
