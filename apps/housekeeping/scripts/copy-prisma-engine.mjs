// Copy the Prisma Query Engine binary into .next/server/ so the Vercel
// serverless function can find it at runtime. Prisma searches a fixed list
// of paths including `/var/task/apps/housekeeping/.next/server`, so dropping
// the engine there bypasses the broken file-tracing path entirely.
//
// Mirrors apps/web/scripts/copy-prisma-engine.mjs — kept per-app so each
// Vercel project carries its own copy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(dirname, '..');
const monorepoRoot = path.resolve(appRoot, '..', '..');
const appName = path.basename(appRoot);

const sourceDir = path.join(monorepoRoot, 'packages/db/src/generated/client');
const targets = [
  // Primary target — matches Prisma's first runtime search path on Vercel:
  //   /var/task/apps/housekeeping/src/generated/client
  path.join(appRoot, 'src/generated/client'),
  // Belt and braces — also drop into .next/server which Vercel always bundles.
  path.join(appRoot, '.next/server'),
  path.join(appRoot, `.next/standalone/apps/${appName}/.next/server`),
];

// Ensure the primary target exists (it's pre-build, the dir won't be there yet).
const primary = targets[0];
fs.mkdirSync(primary, { recursive: true });

if (!fs.existsSync(sourceDir)) {
  console.warn(`[copy-prisma-engine] Source directory not found: ${sourceDir}`);
  process.exit(0);
}

const engines = fs.readdirSync(sourceDir).filter((name) =>
  /^libquery_engine-(rhel|debian|linux).*\.so\.node$/.test(name),
);
const schema = fs.existsSync(path.join(sourceDir, 'schema.prisma'))
  ? ['schema.prisma']
  : [];

if (engines.length === 0) {
  console.error(`[copy-prisma-engine] FATAL: No Linux engine binary in ${sourceDir}`);
  console.error(`[copy-prisma-engine] Files present: ${fs.readdirSync(sourceDir).join(', ')}`);
  console.error('[copy-prisma-engine] Did `prisma generate` run with binaryTargets=["native","rhel-openssl-3.0.x"]?');
  process.exit(1);
}

let copied = 0;
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  for (const file of [...engines, ...schema]) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(target, file));
    copied += 1;
  }
  console.log(`[copy-prisma-engine] Copied ${engines.length} engine + ${schema.length} schema → ${path.relative(appRoot, target)}`);
}

if (copied === 0) {
  console.warn('[copy-prisma-engine] No target directories existed; nothing copied');
}
