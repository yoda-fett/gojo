// Copy the Prisma Query Engine binary into .next/server/ so the Vercel
// serverless function can find it at runtime. Prisma searches a fixed list
// of paths including `/var/task/apps/web/.next/server`, so dropping the
// engine there bypasses the broken file-tracing path entirely.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dirname, '..');
const monorepoRoot = path.resolve(webRoot, '..', '..');

const sourceDir = path.join(monorepoRoot, 'packages/db/src/generated/client');
const targets = [
  path.join(webRoot, '.next/server'),
  path.join(webRoot, '.next/standalone/apps/web/.next/server'),
];

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
  console.warn(`[copy-prisma-engine] No Linux engine binary found in ${sourceDir}`);
  process.exit(0);
}

let copied = 0;
for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  for (const file of [...engines, ...schema]) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(target, file));
    copied += 1;
  }
  console.log(`[copy-prisma-engine] Copied ${engines.length} engine + ${schema.length} schema → ${path.relative(webRoot, target)}`);
}

if (copied === 0) {
  console.warn('[copy-prisma-engine] No target directories existed; nothing copied');
}
