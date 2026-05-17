// @ts-nocheck
'use client';
import {
  ConversionArcConfigSchema,
  type ConversionArcConfig,
} from '@gojo/types';
import React, { useMemo, useState } from 'react';

const TYPE_LABELS: Record<string, string> = {
  SAVINGS_CARD_IN_APP: 'In-app savings card',
  EMAIL_NUDGE: 'Email reminder',
  WHATSAPP_NUDGE: 'WhatsApp reminder',
  GRACE_PERIOD_WARNING_EMAIL: 'Grace-period warning email',
  OTA_PAUSE: 'Pause OTA channels',
  OTA_DISCONNECT: 'Disconnect OTA channels',
};

interface RowError {
  index: number;
  message: string;
}

export function TrialRemindersForm({
  propertyId,
  initialConfig,
  subscriptionStatus,
}: {
  propertyId: string;
  initialConfig: ConversionArcConfig;
  subscriptionStatus: string | null;
}) {
  const [rows, setRows] = useState(initialConfig.touchpoints.map((t) => ({ ...t })));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const readOnly = subscriptionStatus !== null && subscriptionStatus !== 'TRIAL';

  const totalDays = useMemo(() => rows.reduce((max, r) => Math.max(max, r.dayOffset), 0), [rows]);

  function setOffset(index: number, value: string) {
    const next = [...rows];
    const parsed = Number.parseInt(value, 10);
    next[index] = { ...next[index], dayOffset: Number.isFinite(parsed) ? parsed : 0 };
    setRows(next);
    setRowErrors([]);
    setFormError(null);
  }

  function validate(): boolean {
    const candidate = { touchpoints: rows };
    const parsed = ConversionArcConfigSchema.safeParse(candidate);
    if (parsed.success) {
      setRowErrors([]);
      setFormError(null);
      return true;
    }
    const issues: RowError[] = [];
    let formMessage: string | null = null;
    for (const issue of parsed.error.issues) {
      const path = issue.path;
      if (path[0] === 'touchpoints' && typeof path[1] === 'number') {
        issues.push({ index: path[1], message: issue.message });
      } else {
        formMessage = issue.message;
      }
    }
    setRowErrors(issues);
    setFormError(formMessage);
    return false;
  }

  async function onSave() {
    if (readOnly) return;
    if (!validate()) return;
    setSaving(true);
    setToast(null);
    setServerError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/conversion-arc-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ touchpoints: rows }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Save failed (${res.status})`);
      }
      const data = await res.json();
      if (data?.conversionArcConfig?.touchpoints) {
        setRows(data.conversionArcConfig.touchpoints);
      }
      setToast('Saved');
      window.setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function errorForRow(index: number): string | undefined {
    return rowErrors.find((r) => r.index === index)?.message;
  }

  return (
    <section aria-label="Trial reminders" className="mt-6 space-y-4">
      {readOnly ? (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Trial reminders only apply during a trial. Your subscription status is{' '}
          <strong>{subscriptionStatus}</strong>; this schedule is read-only.
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Latest reminder fires on day <strong>{totalDays}</strong> of your trial.
        </p>
      )}

      <ol className="space-y-2">
        {rows.map((row, i) => {
          const err = errorForRow(i);
          return (
            <li
              key={`${row.type}-${i}`}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3"
            >
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {TYPE_LABELS[row.type] ?? row.type}
                </div>
                <div className="text-xs text-slate-500">{row.type}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500" htmlFor={`offset-${i}`}>
                  Day
                </label>
                <input
                  id={`offset-${i}`}
                  type="number"
                  min={0}
                  max={365}
                  value={row.dayOffset}
                  onChange={(e) => setOffset(i, e.target.value)}
                  disabled={readOnly}
                  aria-invalid={Boolean(err)}
                  aria-describedby={err ? `offset-error-${i}` : undefined}
                  className={`w-20 rounded-md border bg-white px-2 py-1 text-sm ${
                    err ? 'border-rose-400 text-rose-700' : 'border-slate-300 text-slate-900'
                  } disabled:bg-slate-100 disabled:text-slate-500`}
                />
              </div>
              {err ? (
                <div
                  id={`offset-error-${i}`}
                  role="alert"
                  className="ml-3 text-xs text-rose-600"
                >
                  {err}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {formError ? (
        <div role="alert" className="text-sm text-rose-600">
          {formError}
        </div>
      ) : null}

      {serverError ? (
        <div role="alert" className="text-sm text-rose-600">
          {serverError}
        </div>
      ) : null}

      {toast ? (
        <div role="status" className="text-sm text-emerald-700">
          {toast}
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={readOnly || saving}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}
