import { promises as fs } from 'node:fs';
import type { StoredEntry } from './entries.types';
import { EntriesRepository } from './entries.repository';

jest.mock('node:fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('EntriesRepository', () => {
  let repository: EntriesRepository;

  beforeEach(() => {
    mockedFs.readFile.mockReset();
    mockedFs.writeFile.mockReset();
    mockedFs.mkdir.mockReset();
    repository = new EntriesRepository();
  });

  it('returns parsed entries when the store exists', async () => {
    const snapshot: StoredEntry[] = [
      {
        entryId: 'ent-1',
      } as StoredEntry,
    ];
    mockedFs.readFile.mockResolvedValue(JSON.stringify({ entries: snapshot }));

    const entries = await repository.loadEntries();

    expect(entries).toEqual(snapshot);
    expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
  });

  it('initializes the store when the file is missing', async () => {
    const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' });
    mockedFs.readFile.mockRejectedValue(enoent);

    const entries = await repository.loadEntries();

    expect(entries).toEqual([]);
    expect(mockedFs.mkdir).toHaveBeenCalled();
    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ entries: [] }, null, 2),
      'utf8',
    );
  });

  it('re-throws unexpected FS errors', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('boom'));
    await expect(repository.loadEntries()).rejects.toThrow('boom');
  });

  it('persists provided entries when saving', async () => {
    const payload: StoredEntry[] = [
      {
        entryId: 'ent-2',
      } as StoredEntry,
    ];

    await repository.saveEntries(payload);

    expect(mockedFs.mkdir).toHaveBeenCalled();
    expect(mockedFs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify({ entries: payload }, null, 2),
      'utf8',
    );
  });
});

