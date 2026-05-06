import { AppError } from '@gojo/types';

import { PrismaClient } from './generated/client/index.js';

type GlobalWithPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};
const globalForPrisma = globalThis as GlobalWithPrisma;

function buildClient(): PrismaClient {
  const client = new PrismaClient();
  return client.$extends({
    query: {
      invoice: {
        async update() {
          throw new AppError(
            'INVOICE_IMMUTABLE',
            'Invoice rows are immutable. Use the credit-note workflow.',
            409,
          );
        },
        async updateMany() {
          throw new AppError('INVOICE_IMMUTABLE', 'Invoice rows are immutable.', 409);
        },
        async delete() {
          throw new AppError('INVOICE_IMMUTABLE', 'Invoice rows cannot be deleted.', 409);
        },
        async deleteMany() {
          throw new AppError('INVOICE_IMMUTABLE', 'Invoice rows cannot be deleted.', 409);
        },
        async upsert() {
          throw new AppError('INVOICE_IMMUTABLE', 'Invoice rows cannot be upserted; use create + credit note.', 409);
        },
      },
      auditLog: {
        async update() {
          throw new AppError('AUDIT_LOG_IMMUTABLE', 'AuditLog is append-only.', 409);
        },
        async updateMany() {
          throw new AppError('AUDIT_LOG_IMMUTABLE', 'AuditLog is append-only.', 409);
        },
        async delete() {
          throw new AppError('AUDIT_LOG_IMMUTABLE', 'AuditLog is append-only.', 409);
        },
        async deleteMany() {
          throw new AppError('AUDIT_LOG_IMMUTABLE', 'AuditLog is append-only.', 409);
        },
        async upsert() {
          throw new AppError('AUDIT_LOG_IMMUTABLE', 'AuditLog is append-only.', 409);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
