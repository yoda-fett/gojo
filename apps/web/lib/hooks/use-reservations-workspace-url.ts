'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export type ReservationsDrawer =
  | { kind: 'folio'; reservationId: string }
  | { kind: 'history'; reservationId: string }
  | { kind: 'amend'; reservationId: string };

export type ReservationsWorkspaceState = {
  expandedId: string | null;
  isNewOpen: boolean;
  drawer: ReservationsDrawer | null;
};

function parseDrawer(raw: string | null): ReservationsDrawer | null {
  if (!raw) return null;
  const [kind, reservationId] = raw.split(':');
  if (!reservationId) return null;
  if (kind === 'folio' || kind === 'history' || kind === 'amend') {
    return { kind, reservationId };
  }
  return null;
}

function serialiseDrawer(drawer: ReservationsDrawer | null): string | null {
  if (!drawer) return null;
  return `${drawer.kind}:${drawer.reservationId}`;
}

export function useReservationsWorkspaceUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state: ReservationsWorkspaceState = useMemo(() => {
    const isNewOpen = searchParams.get('new') === '1';
    return {
      expandedId: searchParams.get('expanded'),
      isNewOpen,
      // The new-reservation drawer and a row drawer (folio/history) cannot
      // both be open. `new` wins; a stale `drawer` param is ignored.
      drawer: isNewOpen ? null : parseDrawer(searchParams.get('drawer')),
    };
  }, [searchParams]);

  const setParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutator(next);
      const queryString = next.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const setExpandedId = useCallback(
    (id: string | null) => {
      setParams((params) => {
        if (id) params.set('expanded', id);
        else params.delete('expanded');
      });
    },
    [setParams],
  );

  const setNewOpen = useCallback(
    (open: boolean) => {
      setParams((params) => {
        if (open) {
          params.set('new', '1');
          params.delete('drawer');
        } else {
          params.delete('new');
        }
      });
    },
    [setParams],
  );

  const setDrawer = useCallback(
    (drawer: ReservationsDrawer | null) => {
      setParams((params) => {
        const serialised = serialiseDrawer(drawer);
        if (serialised) {
          params.set('drawer', serialised);
          params.delete('new');
        } else {
          params.delete('drawer');
        }
      });
    },
    [setParams],
  );

  // Close the new-reservation drawer and expand the freshly-created row in a
  // single navigation. Two separate setters would each read a stale
  // `searchParams` snapshot and the second would clobber the first.
  const completeNewReservation = useCallback(
    (reservationId: string) => {
      setParams((params) => {
        params.delete('new');
        params.delete('drawer');
        params.set('expanded', reservationId);
      });
    },
    [setParams],
  );

  return {
    ...state,
    setExpandedId,
    setNewOpen,
    setDrawer,
    completeNewReservation,
  };
}
