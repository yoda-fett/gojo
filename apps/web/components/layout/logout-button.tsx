'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmLogout() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error('Logout failed');
      router.push('/sign-in');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logout failed');
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="gojo-nav-item"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '8px 12px',
          marginTop: 8,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.02em',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'color 0.12s, background 0.12s',
        }}
      >
        <LogOut size={12} strokeWidth={2} aria-hidden="true" />
        <span>Logout</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(26,43,46,0.55)',
          }}
          onClick={() => (pending ? null : setOpen(false))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              maxWidth: '90vw',
              background: '#FFFFFF',
              borderRadius: 10,
              padding: 24,
              boxShadow: '0 12px 32px rgba(26,43,46,0.18)',
              border: '1px solid #E8EFEE',
            }}
          >
            <h2
              id="logout-modal-title"
              style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1A2B2E' }}
            >
              Log out?
            </h2>
            <p style={{ marginTop: 8, marginBottom: 20, fontSize: 13, color: '#5A6B6E' }}>
              You&apos;ll need to sign in again to access your property.
            </p>
            {error ? (
              <div style={{ marginBottom: 12, fontSize: 12, color: '#B5572A' }}>{error}</div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #E8EFEE',
                  background: '#FFFFFF',
                  color: '#1A2B2E',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: pending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                disabled={pending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#1DA888',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: pending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
