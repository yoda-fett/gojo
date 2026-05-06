import type { Prisma, PrismaClient } from './generated/client/index.js';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface FixedCosts {
  rentOrMortgage: number;
  staffSalaries: number;
  insurance: number;
  utilitiesBase: number;
  other: number;
}

export interface VariableCosts {
  housekeepingSupplies: number;
  laundry: number;
  amenities: number;
  utilitiesVariable: number;
  other: number;
}

export interface CostConfig {
  version: '1';
  archetype: 'BUDGET_GUESTHOUSE' | 'MID_MARKET_HOTEL' | 'BOUTIQUE_PROPERTY' | 'CUSTOM';
  fixedCosts: FixedCosts;
  variableCosts: VariableCosts;
  totalRooms: number;
  updatedAt: string;
}
