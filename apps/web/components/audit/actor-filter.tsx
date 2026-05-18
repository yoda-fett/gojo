'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export type AuditActorOption = {
  id: string;
  label: string; // "Name (Role)" or "phone (Role)"
};

export function ActorFilter({ actors, basePath }: { actors: AuditActorOption[]; basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const value = params.get('actorId') ?? '';

  function apply(next: string) {
    const url = new URLSearchParams(params.toString());
    if (next) url.set('actorId', next);
    else url.delete('actorId');
    url.delete('page');
    router.replace(`${basePath}?${url.toString()}`, { scroll: false });
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-mid-gray)]">User</span>
      <select
        value={value}
        onChange={(e) => apply(e.target.value)}
        className="rounded-[8px] border border-[var(--color-line-soft)] bg-white px-2.5 py-1 text-[13px] text-[var(--color-charcoal)] outline-none focus:border-[var(--color-teal)]"
      >
        <option value="">All users</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
