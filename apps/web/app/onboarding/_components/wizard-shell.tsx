'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

// Mirrors @gojo/db ColdStartProgress — kept local so the client bundle does
// not pull the db package.
type ColdStartProgress = {
  lastCompletedStep: number;
  drafts?: Record<string, unknown>;
  skipped?: boolean;
};

const STEPS: { label: string; optional?: boolean }[] = [
  { label: 'Property profile' },
  { label: 'Room types' },
  { label: 'Rooms' },
  { label: 'Users & Roles' },
  { label: 'Rate management' },
  { label: 'Housekeeping Catalog' },
  { label: 'Direct booking', optional: true },
];

const TOTAL_STEPS = STEPS.length; // 7
const REVIEW_STEP = TOTAL_STEPS + 1; // 8 — final review screen

const TEAL = '#1DA888';
const CHARCOAL = '#1A2B2E';
const MUTED = '#9EAEAC';
const BORDER = '#E8EFEE';

async function patchOnboardingState(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/onboarding/state', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Could not save onboarding progress');
  }
}

// Story 12.3 hooks: foundational steps (1–4) embed Settings forms via
// `stepContent`, and the shell honours `canContinue` so the Save & Continue
// button stays disabled until each step's data-count threshold is met.
export type WizardStepGates = Partial<Record<number, { canContinue: boolean; gateMessage?: string }>>;

export function WizardShell({
  initialProgress,
  stepContent,
  stepGates,
  postAdvanceHrefByStep,
}: {
  initialProgress: ColdStartProgress;
  stepContent?: Partial<Record<number, ReactNode>>;
  stepGates?: WizardStepGates;
  /**
   * Story 12.4 AC3: when leaving step N via Save & Continue, the shell can
   * route to a sub-route instead of incrementing to N+1. The sub-route's own
   * "Save & Continue" / "Defer" handlers bounce back to /onboarding, which
   * re-renders with `lastCompletedStep = N` and resumes at N+1.
   * Used today for step 6 → /onboarding/linen-distribution when the
   * property still has unseeded linens and hasn't deferred.
   */
  postAdvanceHrefByStep?: Partial<Record<number, string>>;
}) {
  const router = useRouter();

  const draftCursor = initialProgress.drafts?.['cursor'];
  const cursor =
    typeof draftCursor === 'number' ? draftCursor : initialProgress.lastCompletedStep + 1;

  const [lastCompletedStep, setLastCompletedStep] = useState(initialProgress.lastCompletedStep);
  const [currentStep, setCurrentStep] = useState(Math.min(Math.max(cursor, 1), REVIEW_STEP));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onReview = currentStep === REVIEW_STEP;
  const currentGate = stepGates?.[currentStep];
  const gateBlocks = currentGate ? !currentGate.canContinue : false;

  // A step is navigable if it is completed or the immediate next one.
  function isNavigable(stepIndex: number) {
    return stepIndex <= lastCompletedStep + 1;
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function goToStep(stepIndex: number) {
    if (busy || !isNavigable(stepIndex)) return;
    setCurrentStep(stepIndex);
  }

  function saveAndContinue() {
    void run(async () => {
      // Step content is wired by Stories 12.3 / 12.4 — the shell records the
      // step as completed and advances. (12.3/12.4 gate completion on the
      // step's own data, so lastCompletedStep advancing is the prerequisite
      // signal for the next step's lock.)
      const completed = Math.max(lastCompletedStep, currentStep);
      await patchOnboardingState({ lastCompletedStep: completed });
      setLastCompletedStep(completed);

      // AC3 of 12.4 — if a sub-route is registered for the leaving step,
      // route there instead of bumping to N+1. The sub-route bounces back to
      // /onboarding when done; the new lastCompletedStep means the resume
      // cursor lands on N+1 naturally.
      const subRoute = postAdvanceHrefByStep?.[currentStep];
      if (subRoute) {
        router.push(subRoute);
        return;
      }
      setCurrentStep(currentStep + 1);
    });
  }

  function skipOptionalStep() {
    // Step 7 (Direct booking) is optional — fire the AC4 audit then advance
    // to review without marking the step complete. Audit is best-effort —
    // a failed write doesn't block the navigation.
    if (busy) return;
    void run(async () => {
      try {
        await fetch('/api/onboarding/skip-direct-booking', { method: 'POST' });
      } catch {
        /* best-effort */
      }
      setCurrentStep(REVIEW_STEP);
    });
  }

  function skipForNow() {
    void run(async () => {
      await patchOnboardingState({ skipped: true });
      router.push('/dashboard');
    });
  }

  function saveAndExit() {
    void run(async () => {
      // Draft semantics — persist the resume cursor so re-entry lands here
      // (AC6), not at lastCompletedStep + 1.
      await patchOnboardingState({ draft: { step: 'cursor', data: currentStep } });
      router.push('/dashboard');
    });
  }

  function finishSetup() {
    void run(async () => {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // AC5 — surface the offending step so the Owner can jump back.
        if (data?.details?.step && typeof data.details.step === 'number') {
          setCurrentStep(data.details.step);
        }
        throw new Error(
          data?.message
            ? `Some setup is incomplete — ${data.message}`
            : 'Some setup is incomplete — fix and try again',
        );
      }
      router.push('/dashboard');
    });
  }

  const activeStep = onReview ? null : STEPS[currentStep - 1];

  return (
    <div style={{ minHeight: '100vh', background: '#F4F9F8', color: CHARCOAL, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          background: CHARCOAL,
          color: '#fff',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEAL, letterSpacing: '-0.5px' }}>gojo</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>Set up your property</div>
        </div>
        <button
          type="button"
          onClick={skipForNow}
          disabled={busy}
          style={{
            background: 'transparent',
            border: 'none',
            color: MUTED,
            fontSize: 13,
            cursor: busy ? 'default' : 'pointer',
            textDecoration: 'underline',
          }}
        >
          Skip for now
        </button>
      </header>

      {/* Progress rail */}
      <div
        style={{
          background: '#fff',
          borderBottom: `1px solid ${BORDER}`,
          padding: '16px 28px',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
        }}
      >
        {STEPS.map((step, i) => {
          const stepIndex = i + 1;
          const done = stepIndex <= lastCompletedStep;
          const current = stepIndex === currentStep;
          const navigable = isNavigable(stepIndex);
          const bubbleColor = done || current ? TEAL : navigable ? '#fff' : '#F4F9F8';
          const bubbleText = done || current ? '#fff' : MUTED;
          return (
            <button
              key={step.label}
              type="button"
              onClick={() => goToStep(stepIndex)}
              disabled={!navigable || busy}
              aria-current={current ? 'step' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 8,
                border: 'none',
                background: current ? 'rgba(29,168,136,0.10)' : 'transparent',
                cursor: navigable && !busy ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: bubbleColor,
                  border: navigable && !done && !current ? `1px solid ${BORDER}` : 'none',
                  color: bubbleText,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {done ? '✓' : stepIndex}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: current ? 600 : 500,
                  color: current ? CHARCOAL : navigable ? '#5C7170' : MUTED,
                }}
              >
                {step.label}
                {step.optional ? <span style={{ color: MUTED, fontWeight: 400 }}> · optional</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <main style={{ flex: 1, padding: '32px 28px', maxWidth: 760, width: '100%', margin: '0 auto' }}>
        {onReview ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Review your setup</h1>
            <p style={{ fontSize: 13.5, color: '#5C7170', marginTop: 6, lineHeight: 1.5 }}>
              You&rsquo;ve worked through the setup steps. Finishing marks your property as ready —
              the dashboard takes over from here.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: MUTED }}>
              Step {currentStep} of {TOTAL_STEPS}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>{activeStep?.label}</h1>
          </>
        )}

        {(() => {
          const slot = onReview ? stepContent?.[REVIEW_STEP] : stepContent?.[currentStep];
          if (slot) {
            return <div style={{ marginTop: 22 }}>{slot}</div>;
          }
          return (
            <div
              style={{
                marginTop: 22,
                background: '#fff',
                border: `1px dashed ${BORDER}`,
                borderRadius: 12,
                padding: '48px 24px',
                textAlign: 'center',
                color: MUTED,
                fontSize: 13,
              }}
            >
              {onReview
                ? 'Setup summary renders here — wired by Stories 12.3 / 12.4.'
                : 'Step content renders here — embedded by Stories 12.3 / 12.4.'}
            </div>
          );
        })()}

        {!onReview && gateBlocks && currentGate?.gateMessage ? (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(229,182,73,0.12)',
              border: '1px solid rgba(229,182,73,0.4)',
              color: '#7a5b13',
              fontSize: 12.5,
            }}
            data-testid={`wizard-gate-${currentStep}`}
          >
            {currentGate.gateMessage}
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 14, color: '#B5572A', fontSize: 12.5, fontWeight: 500 }}>{error}</div>
        ) : null}
      </main>

      {/* Footer */}
      <footer
        style={{
          background: '#fff',
          borderTop: `1px solid ${BORDER}`,
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          type="button"
          onClick={saveAndExit}
          disabled={busy}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#5C7170',
            fontSize: 13,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          ↩ Save &amp; exit
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => goToStep(currentStep - 1)}
              disabled={busy}
              style={{
                background: '#fff',
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: CHARCOAL,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              Back
            </button>
          ) : null}

          {!onReview && activeStep?.optional ? (
            <button
              type="button"
              onClick={skipOptionalStep}
              disabled={busy}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#5C7170',
                fontSize: 13,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              Skip — set up later
            </button>
          ) : null}

          {onReview ? (
            <button
              type="button"
              onClick={finishSetup}
              disabled={busy}
              style={{
                background: TEAL,
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {busy ? 'Finishing…' : 'Finish setup'}
            </button>
          ) : (
            <button
              type="button"
              onClick={saveAndContinue}
              disabled={busy || gateBlocks}
              aria-disabled={busy || gateBlocks}
              style={{
                background: gateBlocks ? '#B6CCC8' : TEAL,
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                cursor: busy || gateBlocks ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? 'Saving…' : 'Save & Continue'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
