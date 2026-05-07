import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Prisma 6 stops auto-loading .env when prisma.config.ts is present, so load
// repo-root and package-local files explicitly. Existing process.env values
// win — `DATABASE_URL=… pnpm db:seed` still overrides what's in the file.
function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(path.join(dirname, '../../.env'));
loadEnv(path.join(dirname, '.env'));

export default defineConfig({
  schema: path.join(dirname, 'prisma/schema.prisma'),
  migrations: {
    path: path.join(dirname, 'prisma/migrations'),
  },
  seed: 'tsx prisma/seed.ts',
});
