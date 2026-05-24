// @ts-nocheck
import { Lock, Shirt } from 'lucide-react';

// Pre-filled context card shown when staff arrives at Issue Report from a
// specific row (Linen Swap → MISSING_FROM_ROOM, Laundry Receive → DAMAGED_ON_RETURN).
// Amber-bordered card for in-room shortages, violet for vendor returns.
// Matches wireframe 09 §ctx-card.
export function PrefillBanner({ context }: { context: any }) {
  if (context.entryContext === 'COLD') return null;

  const isMissing = context.entryContext === 'MISSING_FROM_ROOM';
  const variantClass = isMissing ? 'hk-ctx-card locked' : 'hk-ctx-card vendor';
  const eyebrow = isMissing ? 'Pre-filled from Linen Swap' : 'Pre-filled from Laundry Receive';
  const titleLeft = context.roomNumber ? `Room ${context.roomNumber}` : context.vendorName ?? null;
  const titleRight = context.itemName ?? context.catalogItemId ?? '';
  const title = [titleLeft, titleRight].filter(Boolean).join(' · ');

  const subParts: string[] = [];
  if (context.qty) subParts.push(`${context.qty} ${isMissing ? 'missing' : 'damaged'}`);
  if (isMissing && context.qtyShort) subParts.push(`stripped ${context.qty ?? '?'} of expected ${(Number(context.qty) ?? 0) + Number(context.qtyShort)}`);
  if (context.vendorName && !isMissing) subParts.push(context.vendorName);

  const tagClass = isMissing ? 'hk-locked-tag amber' : 'hk-locked-tag violet';
  const tagLabel = isMissing ? 'Missing Item · room-shortage' : 'Damaged Return · vendor';

  return (
    <section className={variantClass}>
      <div className="hk-ctx-eyebrow">{eyebrow}</div>
      <div className="hk-ctx-row">
        <span className="hk-item-ico" aria-hidden>
          <Shirt size={18} />
        </span>
        <div className="hk-ctx-body">
          <div className="hk-ctx-title">{title || 'Issue context'}</div>
          {subParts.length > 0 ? <div className="hk-ctx-sub">{subParts.join(' · ')}</div> : null}
        </div>
        <span className="hk-ctx-change">Change</span>
      </div>
      <span className={tagClass}>
        <Lock size={9} /> {tagLabel}
      </span>
    </section>
  );
}
