'use client';

import { createContext, useContext } from 'react';

export type WizardNav = {
  goToStep: (stepIndex: number) => void;
};

export const WizardNavContext = createContext<WizardNav | null>(null);

export function useWizardNav(): WizardNav {
  const ctx = useContext(WizardNavContext);
  if (!ctx) throw new Error('useWizardNav must be used inside <WizardNavContext.Provider>');
  return ctx;
}
