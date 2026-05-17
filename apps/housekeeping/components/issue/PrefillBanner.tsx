// @ts-nocheck
export function PrefillBanner({ context }: { context: any }) {
  if (context.entryContext === 'COLD') return null;
  const title = context.entryContext === 'MISSING_FROM_ROOM' ? 'Missing item from room' : 'Damaged return from laundry';
  return (
    <section className="hk-card" style={{ padding: 12, marginBottom: 12, borderColor: '#F2C94C', background: '#FFF9E6' }}>
      <strong>{title}</strong>
      <p style={{ margin: '6px 0 0', color: '#66736F', fontSize: 13 }}>
        {context.itemName ?? context.catalogItemId}
        {context.qty ? ` · Qty ${context.qty}` : ''}
        {context.vendorName ? ` · ${context.vendorName}` : ''}
      </p>
    </section>
  );
}
