import { join } from 'node:path';

const resolveCommunicationsDbPath = (): string =>
  process.env.COMMUNICATIONS_DB_PATH ??
  join(process.cwd(), 'server', 'data', 'communications.db');

export { resolveCommunicationsDbPath };
