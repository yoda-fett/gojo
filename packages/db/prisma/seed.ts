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

// ─── Franchise shards ──────────────────────────────────────────────────────
// A franchise is a conflict-free shard: owners / co-owners / managers are
// shared within a franchise but never across it, so franchise shards can run as
// separate — even parallel — processes without racing on the same User row.
// Select a shard by short key, on the CLI or via SEED_FRANCHISE. No selector
// seeds all 14 properties, so `pnpm db:seed` is unchanged.
//   pnpm db:seed                  → all 14 properties
//   pnpm db:seed op               → One Piece shard only
//   pnpm db:seed mx na            → two franchises in one run
//   SEED_FRANCHISE=jw pnpm db:seed → John Wick shard only
const FRANCHISE_BY_KEY: Record<string, string> = {
  op: 'One Piece',
  ds: 'Demon Slayer',
  na: 'Naruto',
  jw: 'John Wick',
  mx: 'The Matrix',
};

/** Resolve franchise full-names from CLI args (preferred) or SEED_FRANCHISE. Empty = all. */
function resolveFranchises(): string[] {
  const fromArgs = process.argv.slice(2);
  const fromEnv = (process.env.SEED_FRANCHISE ?? '').split(',');
  const keys = (fromArgs.length > 0 ? fromArgs : fromEnv)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const franchises: string[] = [];
  for (const key of keys) {
    const franchise = FRANCHISE_BY_KEY[key];
    if (!franchise) {
      throw new Error(
        `Unknown franchise key '${key}'. Valid keys: ${Object.keys(FRANCHISE_BY_KEY).join(', ')}.`,
      );
    }
    if (!franchises.includes(franchise)) franchises.push(franchise);
  }
  return franchises;
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

  const franchises = resolveFranchises();
  if (franchises.length > 0) {
    console.log(`[seed] Franchise shard: ${franchises.join(', ')}`);
    await seedAnimeProperties(prisma, { franchises });
  } else {
    console.log('[seed] Seeding all 14 properties');
    await seedAnimeProperties(prisma);
  }
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
