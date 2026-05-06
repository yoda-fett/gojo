// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { BaseCard } from '@/components/ui/base-card';
import { Button } from '@/components/ui/button';
import { COST_ARCHETYPES } from '@/lib/utils/cost-archetypes';
import { formatInr } from '@/lib/utils/currency';

const fixedFields = [
  ['rentOrMortgage', 'Rent or Mortgage'],
  ['staffSalaries', 'Staff Salaries'],
  ['insurance', 'Insurance'],
  ['utilitiesBase', 'Base Utilities'],
  ['other', 'Other Fixed Costs'],
];

const variableFields = [
  ['housekeepingSupplies', 'Housekeeping Supplies'],
  ['laundry', 'Laundry'],
  ['amenities', 'Amenities'],
  ['utilitiesVariable', 'Variable Utilities'],
  ['other', 'Other Variable Costs'],
];

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function CostInputForm({ initialConfig, propertyId }: { initialConfig: any; propertyId: string }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [archetype, setArchetype] = useState(initialConfig?.archetype ?? 'CUSTOM');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fixedCosts, setFixedCosts] = useState<Record<string, string>>(() => {
    const source = initialConfig?.fixedCosts ?? {};
    return Object.fromEntries(fixedFields.map(([key]) => [key, String(source[key] ?? '')]));
  });
  const [variableCosts, setVariableCosts] = useState<Record<string, string>>(() => {
    const source = initialConfig?.variableCosts ?? {};
    return Object.fromEntries(variableFields.map(([key]) => [key, String(source[key] ?? '')]));
  });

  const hasErrors = Object.values(errors).some(Boolean);
  const fixedTotal = useMemo(() => fixedFields.reduce((sum, [key]) => sum + numberValue(fixedCosts[key]), 0), [fixedCosts]);
  const variableTotal = useMemo(() => variableFields.reduce((sum, [key]) => sum + numberValue(variableCosts[key]), 0), [variableCosts]);

  function applyArchetype(nextKey: string) {
    const template = COST_ARCHETYPES[nextKey];
    setArchetype(nextKey);
    setFixedCosts(Object.fromEntries(fixedFields.map(([key]) => [key, String(template.fixedCosts[key] ?? '')])));
    setVariableCosts(Object.fromEntries(variableFields.map(([key]) => [key, String(template.variableCosts[key] ?? '')])));
    setErrors({});
    setStep(2);
  }

  function validateField(bucket: 'fixed' | 'variable', key: string, value: string) {
    const parsed = Number(value);
    const nextError = Number.isFinite(parsed) && parsed >= 0 ? '' : 'Enter a positive number';
    setErrors((current) => ({ ...current, [`${bucket}.${key}`]: nextError }));
  }

  async function saveConfig() {
    setMessage(null);
    setSaving(true);
    const response = await fetch(`/api/properties/${propertyId}/cost-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archetype,
        fixedCosts: Object.fromEntries(fixedFields.map(([key]) => [key, numberValue(fixedCosts[key])])),
        variableCosts: Object.fromEntries(variableFields.map(([key]) => [key, numberValue(variableCosts[key])])),
      }),
    });
    setSaving(false);

    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.message ?? 'Unable to save cost configuration.');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['break-even'] });
    setMessage('Cost configuration saved.');
  }

  return (
    <BaseCard title="Guided Cost Setup" subtitle={`Step ${step} of 4`}>
      <div className="space-y-6">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(COST_ARCHETYPES).map(([key, option]) => (
                <button
                  key={key}
                  type="button"
                  className="rounded-[12px] border border-[#d7e3e0] bg-white p-5 text-left transition hover:border-[var(--color-teal)] hover:bg-[rgba(29,168,136,0.05)]"
                  onClick={() => applyArchetype(key)}
                >
                  <p className="text-[16px] font-semibold text-[var(--color-charcoal)]">{option.label}</p>
                  <p className="mt-2 text-[13px] text-[var(--color-mid-gray)]">{option.description}</p>
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={() => { setArchetype('CUSTOM'); setStep(2); }}>
              Skip and enter manually
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {fixedFields.map(([key, label]) => (
                <label key={key} className="space-y-2 text-[13px] font-medium">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3"
                    value={fixedCosts[key]}
                    onChange={(event) => setFixedCosts((current) => ({ ...current, [key]: event.target.value }))}
                    onBlur={(event) => validateField('fixed', key, event.target.value)}
                  />
                  {errors[`fixed.${key}`] ? <p className="text-[12px] text-[var(--color-coral)]">{errors[`fixed.${key}`]}</p> : null}
                </label>
              ))}
            </div>
            <p className="text-[13px] text-[var(--color-mid-gray)]">Total fixed costs: {formatInr(fixedTotal)}/month</p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {variableFields.map(([key, label]) => (
                <label key={key} className="space-y-2 text-[13px] font-medium">
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    className="min-h-11 w-full rounded-[10px] border border-[#d7e3e0] px-3"
                    value={variableCosts[key]}
                    onChange={(event) => setVariableCosts((current) => ({ ...current, [key]: event.target.value }))}
                    onBlur={(event) => validateField('variable', key, event.target.value)}
                  />
                  {errors[`variable.${key}`] ? <p className="text-[12px] text-[var(--color-coral)]">{errors[`variable.${key}`]}</p> : null}
                </label>
              ))}
            </div>
            <p className="text-[13px] text-[var(--color-mid-gray)]">Total variable cost: {formatInr(variableTotal)}/room-night</p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[10px] border border-[#e8efee] p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Fixed Costs</p>
                <div className="mt-3 space-y-2 text-[13px]">
                  {fixedFields.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span>{label}</span>
                      <strong>{formatInr(numberValue(fixedCosts[key]))}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[10px] border border-[#e8efee] p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">Variable Costs</p>
                <div className="mt-3 space-y-2 text-[13px]">
                  {variableFields.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span>{label}</span>
                      <strong>{formatInr(numberValue(variableCosts[key]))}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Button onClick={saveConfig} disabled={saving || hasErrors}>
              {saving ? 'Saving...' : 'Save cost configuration'}
            </Button>
          </div>
        ) : null}

        {message ? <p className="rounded-[10px] bg-[rgba(29,168,136,0.12)] px-4 py-3 text-[13px] text-[var(--color-teal-dark)]">{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          {step > 1 ? (
            <Button variant="secondary" onClick={() => setStep((current) => current - 1)}>
              Back
            </Button>
          ) : null}
          {step < 4 ? (
            <Button onClick={() => setStep((current) => current + 1)} disabled={hasErrors}>
              Next
            </Button>
          ) : null}
        </div>
      </div>
    </BaseCard>
  );
}
