import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CommunicationsRepository } from './communications.repository';
import type { CommunicationsStateSnapshot } from './communications.types';

describe('CommunicationsRepository', () => {
  let workspace: string;
  const openRepositories: CommunicationsRepository[] = [];

  const createSnapshot = (): CommunicationsStateSnapshot => ({
    campaigns: [
      {
        campaignId: 'campaign-1',
        type: 'dispatch',
        channel: 'email',
        status: 'scheduled',
        scheduleMode: 'later',
        scheduleAt: '2026-08-01T09:00:00.000Z',
        stats: {
          recipients: 1,
          attempted: 0,
          sent: 0,
          failed: 0,
          suppressed: 0,
        },
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z',
        approval: {
          required: false,
          requestedBy: 'owner',
        },
      },
    ],
    pendingDispatches: [],
    campaignAudit: [
      {
        campaignId: 'campaign-1',
        timestamp: '2026-08-01T08:00:00.000Z',
        action: 'scheduled',
        detail: 'Campaign restored.',
      },
    ],
    campaignEvents: [],
    suppressions: [
      {
        channel: 'email',
        value: 'owner@ecocutqc.com',
        reason: 'unsubscribe',
        createdAt: '2026-08-01T08:00:00.000Z',
        updatedAt: '2026-08-01T08:00:00.000Z',
      },
    ],
  });

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'communications-repo-'));
    process.env.COMMUNICATIONS_DB_PATH = join(workspace, 'communications.db');
  });

  afterEach(() => {
    for (const repository of openRepositories) {
      repository.close();
    }
    openRepositories.length = 0;
    delete process.env.COMMUNICATIONS_DB_PATH;
    rmSync(workspace, { recursive: true, force: true });
  });

  it('returns null when no snapshot has been stored', () => {
    const repository = new CommunicationsRepository();
    openRepositories.push(repository);
    expect(repository.loadState()).toBeNull();
  });

  it('persists and reloads snapshot state', () => {
    const repository = new CommunicationsRepository();
    openRepositories.push(repository);
    const snapshot = createSnapshot();

    repository.saveState(snapshot);

    const reloadRepository = new CommunicationsRepository();
    openRepositories.push(reloadRepository);
    const restored = reloadRepository.loadState();
    expect(restored).toEqual(snapshot);
  });
});
