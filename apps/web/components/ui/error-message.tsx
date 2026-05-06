import { AlertCircle } from 'lucide-react';

export function ErrorMessage({ line1, line2, line3 }: { line1: string; line2?: string; line3?: string }) {
  return (
    <div className="flex gap-3 rounded-[12px] border-l-4 border-[var(--color-coral)] bg-white p-4 shadow-[0_1px_3px_rgba(26,43,46,0.05)]">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-coral)]" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-[14px] font-medium text-[var(--color-charcoal)]">{line1}</p>
        {line2 ? <p className="text-[13px] text-[var(--color-mid-gray)]">{line2}</p> : null}
        {line3 ? <p className="text-[13px] text-[var(--color-mid-gray)]">{line3}</p> : null}
      </div>
    </div>
  );
}
