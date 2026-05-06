'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type RefreshContextValue = {
  lastPollAt: Date | null;
  isFailing: boolean;
  setLastPollAt: (date: Date) => void;
  setIsFailing: (value: boolean) => void;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [lastPollAt, setLastPollAt] = useState<Date | null>(null);
  const [isFailing, setIsFailing] = useState(false);

  const value = useMemo(
    () => ({ lastPollAt, isFailing, setLastPollAt, setIsFailing }),
    [isFailing, lastPollAt],
  );

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefreshContext() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefreshContext must be used within RefreshProvider');
  }

  return context;
}
