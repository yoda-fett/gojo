import type { FixedCosts, VariableCosts } from '@gojo/db';

export const COST_ARCHETYPES: Record<
  'BUDGET_GUESTHOUSE' | 'MID_MARKET_HOTEL' | 'BOUTIQUE_PROPERTY',
  { label: string; description: string; fixedCosts: FixedCosts; variableCosts: VariableCosts }
> = {
  BUDGET_GUESTHOUSE: {
    label: 'Budget Guesthouse',
    description: 'Small property, owner-operated, around 5 to 15 rooms.',
    fixedCosts: {
      rentOrMortgage: 30000,
      staffSalaries: 40000,
      insurance: 3000,
      utilitiesBase: 8000,
      other: 5000,
    },
    variableCosts: {
      housekeepingSupplies: 80,
      laundry: 60,
      amenities: 40,
      utilitiesVariable: 50,
      other: 30,
    },
  },
  MID_MARKET_HOTEL: {
    label: 'Mid-market Hotel',
    description: 'Staff-run property with broader amenities and a larger team.',
    fixedCosts: {
      rentOrMortgage: 150000,
      staffSalaries: 300000,
      insurance: 15000,
      utilitiesBase: 40000,
      other: 25000,
    },
    variableCosts: {
      housekeepingSupplies: 150,
      laundry: 120,
      amenities: 80,
      utilitiesVariable: 100,
      other: 60,
    },
  },
  BOUTIQUE_PROPERTY: {
    label: 'Boutique Property',
    description: 'Premium positioning with higher-touch guest experience.',
    fixedCosts: {
      rentOrMortgage: 200000,
      staffSalaries: 500000,
      insurance: 25000,
      utilitiesBase: 60000,
      other: 40000,
    },
    variableCosts: {
      housekeepingSupplies: 250,
      laundry: 200,
      amenities: 300,
      utilitiesVariable: 150,
      other: 100,
    },
  },
};
