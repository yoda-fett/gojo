// @ts-nocheck
'use client';

export type EvidenceDraft = {
  note: string;
  photoName?: string;
  voiceState: 'idle' | 'recording' | 'near-cap' | 'recorded';
};

export function EvidenceCapture({
  value,
  onChange,
  photoRequired = false,
}: {
  value: EvidenceDraft;
  onChange: (value: EvidenceDraft) => void;
  photoRequired?: boolean;
}) {
  return (
    <section className="hk-card" style={{ padding: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <strong>Notes & evidence</strong>
        {photoRequired ? <span style={{ color: '#B7791F', fontSize: 12, fontWeight: 800 }}>Photo required</span> : null}
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              voiceState: value.voiceState === 'recorded' ? 'idle' : value.voiceState === 'recording' ? 'recorded' : 'recording',
            })
          }
          className="hk-button"
          style={{ background: value.voiceState === 'recording' ? '#B7791F' : '#E7F4F1', color: value.voiceState === 'recording' ? 'white' : '#127C69' }}
        >
          {value.voiceState === 'recording' ? 'Stop recording' : value.voiceState === 'recorded' ? 'Re-record voice note' : 'Record voice note'}
        </button>
        <textarea
          maxLength={280}
          value={value.note}
          onChange={(event) => onChange({ ...value, note: event.target.value.slice(0, 280) })}
          placeholder="Optional note"
          style={{ minHeight: 88, border: '1px solid #DBE7E4', borderRadius: 8, padding: 10, resize: 'vertical' }}
        />
        <label className="hk-button" style={{ display: 'grid', placeItems: 'center', background: '#F1F5F4', color: '#47534F' }}>
          {value.photoName ?? 'Attach photo'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => onChange({ ...value, photoName: event.target.files?.[0]?.name })}
          />
        </label>
      </div>
    </section>
  );
}
