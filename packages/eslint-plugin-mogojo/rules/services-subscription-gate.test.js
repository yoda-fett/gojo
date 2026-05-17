import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import rule from './services-subscription-gate.js';

// Bridge eslint's RuleTester (mocha-shaped) onto vitest.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

// Use a path that fileIsInScope() accepts so the rule actually runs.
const SERVICE_FILE = '/repo/apps/web/lib/services/example-service.js';
const API_SERVICE_FILE = '/repo/apps/api/src/services/example-service.js';
const TEST_FILE = '/repo/apps/web/lib/services/example-service.test.js';

function wrap(code) {
  return { code, filename: SERVICE_FILE };
}

ruleTester.run('services-subscription-gate', rule, {
  valid: [
    // Mutating function with gate as first statement.
    {
      ...wrap(`
        export async function createReservation(actor, input, db) {
          await checkSubscriptionGate(actor, 'reservation.create', db);
          await db.reservation.create({ data: input });
        }
      `),
    },

    // Bare (non-await) checkSubscriptionGate call counts.
    {
      ...wrap(`
        export async function updateReservation(actor, input, db) {
          checkSubscriptionGate(actor, 'reservation.amend', db);
          return db.reservation.update({ where: { id: input.id }, data: input });
        }
      `),
    },

    // Gate after parameter destructuring is allowed.
    {
      ...wrap(`
        export async function updateRate(actor, input, db) {
          const { propertyId } = actor;
          const { rate } = input;
          await checkSubscriptionGate(actor, 'rate.update', db);
          return db.room.update({ where: { propertyId }, data: { rate } });
        }
      `),
    },

    // @gateExempt with reason — skipped.
    {
      ...wrap(`
        /** @gateExempt read-only helper used by HC PWA */
        export async function listSomething(actor, db) {
          await db.reservation.update({ where: { id: 'x' }, data: {} });
        }
      `),
    },

    // Non-mutating async function — not in scope.
    {
      ...wrap(`
        export async function listReservations(actor, db) {
          return db.reservation.findMany({ where: { propertyId: actor.propertyId } });
        }
      `),
    },

    // Non-exported helper — not in scope.
    {
      ...wrap(`
        async function internalHelper(actor, db) {
          await db.reservation.create({ data: {} });
        }
      `),
    },

    // File outside scope (test file) — not lifted into scope.
    {
      code: `
        export async function thing(actor, db) {
          await db.reservation.create({ data: {} });
        }
      `,
      filename: TEST_FILE,
    },

    // apps/api scope is also covered.
    {
      code: `
        export async function createThing(actor, db) {
          await checkSubscriptionGate(actor, 'reservation.create', db);
          await db.reservation.create({ data: {} });
        }
      `,
      filename: API_SERVICE_FILE,
    },

    // Mutation via scopedClient(...).x.update — gate present, passes.
    {
      ...wrap(`
        export async function doIt(actor, input, db) {
          await checkSubscriptionGate(actor, 'rate.update', db);
          await scopedClient(actor).room.update({ where: { id: input.id }, data: input });
        }
      `),
    },
  ],

  invalid: [
    // Mutating function without any gate call.
    {
      ...wrap(`
        export async function createReservation(actor, input, db) {
          await db.reservation.create({ data: input });
        }
      `),
      errors: [{ messageId: 'missingGate' }],
    },

    // Mutating function with gate as second statement.
    {
      ...wrap(`
        export async function createReservation(actor, input, db) {
          const data = { ...input };
          await checkSubscriptionGate(actor, 'reservation.create', db);
          await db.reservation.create({ data });
        }
      `),
      errors: [{ messageId: 'missingGate' }],
    },

    // Bare @gateExempt — error.
    {
      ...wrap(`
        /** @gateExempt */
        export async function thing(actor, db) {
          await db.reservation.create({ data: {} });
        }
      `),
      errors: [{ messageId: 'bareGateExempt' }],
    },

    // scopedClient(actor).x.update — flagged when gate is missing (verb-driven).
    {
      ...wrap(`
        export async function doIt(actor, input, db) {
          await scopedClient(actor).room.update({ where: { id: input.id }, data: input });
        }
      `),
      errors: [{ messageId: 'missingGate' }],
    },

    // tx.x.update inside $transaction — flagged when gate is missing.
    {
      ...wrap(`
        export async function doIt(actor, input, db) {
          await db.$transaction(async (tx) => {
            await tx.subscription.update({ where: { propertyId: actor.propertyId }, data: input });
          });
        }
      `),
      errors: [{ messageId: 'missingGate' }],
    },

    // Exported async const arrow function — also covered.
    {
      ...wrap(`
        export const doIt = async (actor, input, db) => {
          await db.reservation.create({ data: input });
        };
      `),
      errors: [{ messageId: 'missingGate' }],
    },
  ],
});
