# Gojo — Project Context for AI Agents

> **When to update this file:** After any architectural decision changes, when a new package/tool is added to the monorepo, or when a coding pattern is established or revised. Not updated per-story — updated at epic milestones or when the team aligns on a new convention.

---

## What Is Gojo

Gojo is a Hotel PMS SaaS product targeting independent hotel owners in India. It is a **Phase 1 POC** with real users — the codebase must be production-quality even though not all features are live. Owners manage reservations, rooms, housekeeping, and OTA channels from a single dashboard.

**Two deployment targets:**
- `apps/web` → Vercel (Next.js 15 App Router, Owner Register frontend + API routes)
- `apps/api` → Render (Node.js long-running process: BullMQ workers + SSE)

**Two shared packages:**
- `packages/db` — Prisma schema, generated client, all DB utility functions
- `packages/types` — TypeScript interfaces, Zod schemas, BullMQ job payloads, SSE event types

---

## Tech Stack (exact versions in use)

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm 10 workspaces |
| Frontend | Next.js 15 App Router, React 19, Tailwind CSS |
| Backend | Node.js (TypeScript), BullMQ, ioredis |
| ORM | Prisma 6.x |
| Database | PostgreSQL 16 (Render) |
| Cache / Locks | Redis (ioredis + Redlock for distributed locking) |
| Testing | Vitest |
| Error Monitoring | Sentry (Phase 1) |
| OTP | MSG91 (DLT-registered, provider-agnostic interface) |
| Payments | UPI via payment gateway (no card data stored) |
| Notifications | WhatsApp + email (30s SLA), SMS fallback |

---

## Repository Structure

```
gojo/
├── .github/workflows/ci.yml        # Turborepo-affected CI + prisma deploy
├── .env                            # DATABASE_URL, REDIS_URL, JWT_SECRET, etc (not committed)
├── .env.example                    # Documents all required env vars
├── turbo.json                      # Task pipeline
├── pnpm-workspace.yaml
├── package.json                    # Root devDeps only
├── tsconfig.json                   # Strict mode, NodeNext, ES2022
├── apps/
│   ├── web/                        # Next.js 15 → Vercel
│   │   ├── app/                    # App Router routes
│   │   ├── env.ts                  # t3-env server + client validation (Story 1.4)
│   │   └── middleware.ts           # Auth session check (Story 2.1)
│   └── api/                        # Node.js → Render (SSE + BullMQ workers)
│       ├── src/index.ts            # Entry — imports env.ts first
│       ├── src/env.ts              # t3-env validation (Story 1.4)
│       └── src/workers/            # BullMQ workers (Epic 8)
├── packages/
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Single source of truth — 14 models
│   │   │   ├── migrations/         # Manual SQL only — prisma migrate dev --create-only blocked
│   │   │   └── seed.ts             # Deterministic upsert seed (SEED_EPOCH = 2026-01-01)
│   │   └── src/
│   │       ├── client.ts           # Base PrismaClient singleton — never imported by apps
│   │       ├── index.ts            # Barrel — all public exports
│   │       ├── scoped-client.ts    # scopedClient(actor, db, tx?) factory ← use this everywhere
│   │       ├── lock.ts             # withRoomLock — Redlock + SELECT FOR UPDATE
│   │       ├── idempotency.ts      # withIdempotency — two-phase INSERT gate
│   │       ├── audit.ts            # writeAuditedTransition — atomic AuditLog writes
│   │       ├── gst.ts              # calculateGST — single canonical location (ARCH11)
│   │       ├── subscription-gate.ts # checkSubscriptionGate — stub until Epic 10
│   │       └── transitions/
│   │           ├── reservation.ts  # transitionReservation — stateVersion guard + audit
│   │           └── room.ts         # transitionRoom — stateVersion guard + audit
│   └── types/
│       ├── src/errors.ts           # AppError class + ErrorCode type
│       ├── src/auth.ts             # Actor interface + UserRole type
│       ├── src/jobs.ts             # BullMQ job payload types
│       └── src/sse.ts              # SSE event types
└── docs/
    └── project-context.md          # ← this file
```

---

## Coding Patterns — Follow These Exactly

### 1. DB Access: Always Via scopedClient

```typescript
// ✅ correct — propertyId and deletedAt injected automatically
import { scopedClient } from '@gojo/db';
const db = scopedClient(actor, prisma);
const rooms = await db.room.findMany({ where: { state: 'AVAILABLE' } });

// ❌ wrong — ESLint no-restricted-imports blocks this in apps
import { PrismaClient } from '@prisma/client';
```

`scopedClient` wraps 10 model delegates: `room`, `reservation`, `folio`, `folioLine`, `guest`, `subscription`, `propertyAccess`, `auditLog`, `roomType`, `webhookSecret`. Always pass `tx` when inside a `$transaction`.

### 2. Subscription Gate: First Call in Every Mutating Service

```typescript
// ✅ ARCH10 — must be first
await checkSubscriptionGate(actor, 'CREATE_RESERVATION', prisma);
// ... rest of service logic
```

Stub returns void until Epic 10. ESLint rule `services-subscription-gate` enforces placement.

### 3. State Transitions: Always Use Transition Helpers

```typescript
// ✅ stateVersion guard + audit log + FOR UPDATE
await prisma.$transaction(async (tx) => {
  await transitionReservation(tx, {
    reservationId, expectedStateVersion, toStatus: 'CHECKED_IN', actor
  });
});

// ❌ never update status directly — bypasses stateVersion guard
await prisma.reservation.update({ where: { id }, data: { status: 'CHECKED_IN' } });
```

### 4. Idempotency: Two-Phase Gate for All Webhook/Payment Handlers

```typescript
// Key format: {source}:{version}:{raw_key}
await withIdempotency(`ota:v1:${provider}:${eventId}`, prisma, async () => {
  // fn() runs exactly once; second call returns cached result
});
```

### 5. Room Locking: withRoomLock for Inventory Operations

```typescript
await withRoomLock(roomId, redis, prisma, async (tx) => {
  // Redlock + SELECT FOR UPDATE — both layers active
  await transitionRoom(tx, { roomId, expectedStateVersion, toState: 'CHECKED_IN', actor });
});
```

### 6. GST Calculation: Only in packages/db/src/gst.ts

```typescript
import { calculateGST } from '@gojo/db';
const { taxableAmount, cgst, sgst, total } = calculateGST(postDiscountAmountPaise, '18%');
// Never inline GST math — ARCH11 violation
```

### 7. AppError for All Domain Errors

```typescript
import { AppError } from '@gojo/types';
throw new AppError('NOT_FOUND', 'Reservation not found', 404);
// Codes: LOCK_TIMEOUT(423) | CONFLICT(409) | IDEMPOTENCY_CONFLICT(409)
//        INVALID_TRANSITION(422) | VALIDATION_ERROR(422) | NOT_FOUND(404)
//        UNAUTHORIZED(401) | FORBIDDEN(403) | SUBSCRIPTION_GATE(402)
```

### 8. Audit Log Writes: Only Inside Transactions

```typescript
await tx.auditLog.create(...)     // ❌ — raw create bypasses transition helpers
await writeAuditedTransition(tx, { ... })  // ✅ — atomic with the mutation
```

---

## Schema Invariants — Never Break These

| Rule | Detail |
|---|---|
| No Prisma enums | All state columns are `String` with Postgres `CHECK` constraints |
| Soft-delete only | `deletedAt DateTime?` + `deletedBy String?` on every mutable entity; no hard deletes in app code |
| stateVersion | `Int @default(0)` on Room, Reservation, Folio, Guest, Subscription, RoomType |
| propertyId everywhere | Every non-auth model has `propertyId String` for tenant scoping |
| Idempotency status | `('PENDING', 'COMPLETE', 'FAILED')` — not 'PROCESSING'/'DONE' |
| Room states | `AVAILABLE, HOLD, RESERVED, CHECKED_IN, CHECKED_OUT, CLEANING, MAINTENANCE` |
| Reservation statuses | `PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW` |
| Folio statuses | `OPEN, CLOSED, TRANSFERRED` |
| Subscription statuses | `TRIAL, ACTIVE, GRACE_PERIOD, SUSPENDED, PAUSED, CANCELLED` |
| Migration authoring | Write SQL manually + `prisma migrate deploy`; never `prisma migrate dev` in non-interactive env |
| CHECK idempotency | All CHECK constraints use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` |

---

## State Machines

### Reservation
```
PENDING → CONFIRMED
CONFIRMED → CHECKED_IN | CANCELLED | NO_SHOW
CHECKED_IN → CHECKED_OUT | CANCELLED
```

### Room
```
AVAILABLE → CHECKED_IN | HOLD | MAINTENANCE
HOLD → RESERVED | AVAILABLE
RESERVED → CHECKED_IN | AVAILABLE
CHECKED_IN → CLEANING
CHECKED_OUT → CLEANING
CLEANING → AVAILABLE
MAINTENANCE → AVAILABLE
```

### Subscription
```
TRIAL → ACTIVE | CANCELLED
ACTIVE → GRACE_PERIOD | PAUSED | CANCELLED
GRACE_PERIOD → ACTIVE | SUSPENDED
SUSPENDED → CANCELLED
PAUSED → ACTIVE
```

---

## Key Architectural Decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | No FK constraints in DB (Phase 1) | Speed; enforced at app layer |
| D2 | WebhookSecret plaintext (Phase 1) | AES-256 encryption deferred to Story 1.3+ |
| D3 | No formal staging (Phase 1) | Separate staging DB + Redis provisioned pre-Phase 2 |
| D4 | 30s polling Phase 1, SSE Phase 2 | Simplicity; SSE upgrade is Story 8.5 |
| D5 | PgBouncer session mode | Required for `SELECT FOR UPDATE` + Redlock dual-layer |

### Deferred Items
- `Guest @@unique([propertyId, idNumber, idType])` — Story 2.x guest merge
- `RoomType` rate ordering CHECKs — Story 5.3
- `FolioLine.amount` sign CHECKs — Story 4.4
- Invoice sequence race condition — DB sequence in Story 6.1
- `Folio.parentFolioId` self-FK enforcement — Phase 2

---

## Testing Conventions

- Unit tests: `packages/db/src/__tests__/*.test.ts` — no DATABASE_URL needed, mock Prisma delegates
- Integration tests: `describe.skipIf(!DATABASE_URL)` with `@integration` tag — run against Render Postgres
- `SEED_EPOCH = new Date('2026-01-01')` for all deterministic date calculations in seed/tests
- Never mock the DB in integration tests — use a real Postgres instance (CI provisions one)
- Redlock mocked via `vi.mock('redlock')` in unit tests; real Redis used in integration tests only

---

## Environment Variables (required at boot)

### apps/web
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Render PostgreSQL, validated at boot via t3-env |
| `JWT_SECRET` | Yes | min 32 chars |
| `SENTRY_DSN` | No | Sentry optional in dev |
| `NODE_ENV` | Yes | `development \| test \| production` |

### apps/api
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | When workers access DB | Not required in Phase 1 workers |
| `REDIS_URL` | Yes | ioredis — must be persistent TCP (not Upstash HTTP) |
| `JWT_SECRET` | Yes | Same secret as apps/web |
| `OTP_PROVIDER` | Yes | `mock` (dev) or `msg91` (prod) |
| `MSG91_AUTH_KEY` | When `OTP_PROVIDER=msg91` | Validated via t3-env superRefine |
| `RENDER_SSE_BASE_URL` | Yes in production | SSE base URL for Render |

---

## CI/CD

- **GitHub Actions** — affected-only builds via `--filter=[HEAD^1]`
- `prisma migrate deploy` runs before Render deploy hook fires
- `prisma migrate diff --exit-code` in PR checks blocks destructive migrations
- Sentry source maps uploaded post-Vercel-deploy (guarded: skips if `SENTRY_AUTH_TOKEN` absent)
- Integration test Postgres service container: `postgres:16`, db `gojo_test`

---

## Phase Boundary

**Phase 1 (POC):** Epics 1–10. Real data, real users, no formal staging.
**Phase 2:** Epic 11 (Housekeeping Companion PWA) + Story 8.5 (SSE upgrade) + Story 9.3 (RNA real-time sync) + verified restore drill + Axiom log aggregation + separate staging DB.
