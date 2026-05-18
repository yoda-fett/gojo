'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Clock, type LucideIcon } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { PageShell } from '@/components/layout/page-shell';
import { BaseCard } from '@/components/ui/base-card';

export type FeatureCard = {
  icon: LucideIcon;
  iconTint?: 'teal' | 'amber' | 'coral';
  title: string;
  body: string;
};

export type RoadmapStep = {
  label: string;
  title: string;
  state: 'done' | 'active' | 'future';
};

export type ComingSoonLandingProps = {
  // PageHeader
  eyebrow: string;
  phaseLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  // Hero
  heroEyebrowIcon?: LucideIcon;
  heroEyebrowLabel: string;
  heroTitle: ReactNode;
  heroDescription: string;
  heroPrimaryCta: string;
  heroSecondaryCta?: string;
  heroNote?: string;
  previewSlot?: ReactNode;
  // Sections
  featuresHeading: string;
  features: FeatureCard[];
  roadmapHeading?: string;
  roadmap?: RoadmapStep[];
  // Notify band
  notifyTitle: string;
  notifyDescription: string;
  notifyPlaceholder?: string;
  notifyCta: string;
};

const ICON_TINTS: Record<NonNullable<FeatureCard['iconTint']>, { bg: string; fg: string }> = {
  teal: { bg: 'rgba(29,168,136,0.10)', fg: '#1DA888' },
  amber: { bg: 'rgba(233,196,106,0.12)', fg: '#C49A10' },
  coral: { bg: 'rgba(232,118,63,0.10)', fg: '#E8763F' },
};

export function ComingSoonLanding(props: ComingSoonLandingProps) {
  const HeroIcon = props.heroEyebrowIcon;
  return (
    <PageShell
      header={
        <PageHeader
          variant="list"
          title={props.pageTitle}
          subtitle={props.pageSubtitle}
          controls={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-amber)]/40 bg-[rgba(233,196,106,0.10)] px-3 py-1 text-[12px] font-semibold text-[#8a6610]">
              <Clock className="size-3" /> {props.phaseLabel}
            </span>
          }
        />
      }
    >
      <div className="flex flex-col gap-8">
        {/* HERO */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-teal-dark)]">
              {HeroIcon ? <HeroIcon className="size-3" /> : null}
              {props.heroEyebrowLabel}
            </div>
            <h1 className="mt-3 text-[34px] font-bold leading-[1.15] tracking-[-0.01em] text-[var(--color-charcoal)] sm:text-[40px]">
              {props.heroTitle}
            </h1>
            <p className="mt-4 max-w-[540px] text-[15px] leading-[1.55] text-[var(--color-muted)]">
              {props.heroDescription}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => alert('Thanks — we\'ll let you know when this is live.')}
                className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--color-teal)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-teal-dark)]"
              >
                <Bell className="size-3.5" /> {props.heroPrimaryCta}
              </button>
              {props.heroSecondaryCta ? (
                <button
                  type="button"
                  className="rounded-[8px] border border-[var(--color-line-soft)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
                >
                  {props.heroSecondaryCta}
                </button>
              ) : null}
            </div>
            {props.heroNote ? (
              <p className="mt-4 text-[12px] text-[var(--color-mid-gray)]">{props.heroNote}</p>
            ) : null}
          </div>
          {props.previewSlot ? <div>{props.previewSlot}</div> : null}
        </section>

        {/* FEATURES */}
        <section>
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
            {props.featuresHeading}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.features.map((feature) => {
              const Icon = feature.icon;
              const tint = ICON_TINTS[feature.iconTint ?? 'teal'];
              return (
                <BaseCard key={feature.title} className="!p-5">
                  <div
                    className="mb-3 inline-flex size-9 items-center justify-center rounded-[10px]"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="text-[14px] font-semibold text-[var(--color-charcoal)]">{feature.title}</div>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--color-mid-gray)]">{feature.body}</p>
                </BaseCard>
              );
            })}
          </div>
        </section>

        {/* ROADMAP */}
        {props.roadmap && props.roadmap.length > 0 ? (
          <section>
            <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-mid-gray)]">
              {props.roadmapHeading ?? 'Roadmap'}
            </div>
            <ol className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {props.roadmap.map((step, i) => (
                <li key={i} className="flex flex-col items-center text-center">
                  <div
                    className={
                      step.state === 'done'
                        ? 'flex size-9 items-center justify-center rounded-full bg-[var(--color-teal)] text-white'
                        : step.state === 'active'
                          ? 'flex size-9 items-center justify-center rounded-full border-2 border-[var(--color-teal)] bg-white text-[var(--color-teal)] font-semibold'
                          : 'flex size-9 items-center justify-center rounded-full border border-dashed border-[var(--color-line-soft)] bg-white text-[var(--color-mid-gray)] font-semibold'
                    }
                  >
                    {step.state === 'done' ? '✓' : i + 1}
                  </div>
                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-mid-gray)]">
                    {step.label}
                  </div>
                  <div className="mt-1 text-[12.5px] text-[var(--color-charcoal)]">{step.title}</div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* NOTIFY BAND */}
        <section className="rounded-[12px] bg-[var(--color-charcoal)] px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[18px] font-bold">{props.notifyTitle}</div>
              <p className="mt-1 max-w-[440px] text-[13.5px] text-[rgba(255,255,255,0.7)]">{props.notifyDescription}</p>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                alert('Thanks — we\'ll be in touch.');
              }}
            >
              <input
                type="email"
                required
                placeholder={props.notifyPlaceholder ?? 'your@email.com'}
                className="rounded-[8px] border border-white/10 bg-white/[0.08] px-3 py-2 text-[13px] text-white placeholder-white/40 outline-none focus:border-[var(--color-teal)]"
              />
              <button
                type="submit"
                className="rounded-[8px] bg-[var(--color-teal)] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[var(--color-teal-dark)]"
              >
                {props.notifyCta}
              </button>
            </form>
          </div>
        </section>

        <div className="text-center">
          <Link href="/dashboard" className="text-[13px] font-semibold text-[var(--color-teal-dark)]">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
