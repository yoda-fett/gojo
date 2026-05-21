import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env files before instantiating PrismaClient. The repo-root .env wins
// over the package-local one; existing process.env values still take priority,
// so `DATABASE_URL=… pnpm db:seed` overrides whatever is in the file.
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

const seedDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(seedDir, '..', '.env'));
loadEnv(path.join(seedDir, '..', '..', '..', '.env'));

import { PrismaClient } from '../src/generated/client/index.js';
import { seedAnimeProperties } from './seed-anime.js';

const prisma = new PrismaClient();

function maskUrl(url: string | undefined) {
  if (!url) return '<unset>';
  return url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
}

// Anime-only seed. The single source of demo data is seedAnimeProperties() —
// nine themed properties (One Piece / Demon Slayer / Naruto) spanning all three
// subscription tiers and three hill-station cities (Darjeeling, Gangtok,
// Kalimpong), with ~1 year of reservations, GST invoices, audit trails and
// housekeeping activity. Three owners hold multiple properties; three
// properties carry co-owners. Fully idempotent: re-running upserts by stable
// string IDs — no drops, safe to run against the production DB before go-live.
async function main() {
  console.log(`[seed] DATABASE_URL=${maskUrl(process.env.DATABASE_URL)}`);
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — refusing to run seed against an unknown DB');
  }

  await seedAnimeProperties(prisma);
}

main()
  .then(() => {
    console.log('[seed] done');
  })
  .catch((error) => {
    console.error('[seed] FAILED');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
