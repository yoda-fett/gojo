import { redirect } from 'next/navigation';

import { ComingSoonLanding, type FeatureCard, type RoadmapStep } from '@/components/marketing/coming-soon-landing';
import { getServerActor } from '@/lib/auth/server-actor';

export const dynamic = 'force-dynamic';

const FEATURES: FeatureCard[] = [
  {
    icon: 'trendingUp',
    iconTint: 'teal',
    title: 'Demand-based suggestions',
    body: 'AI reads booking pace, search trends, and historical fill rates to suggest the right price for each night.',
  },
  {
    icon: 'search',
    iconTint: 'amber',
    title: 'Competitor rate monitoring',
    body: 'Tracks rates at comparable properties in your area and factors them into every suggestion.',
  },
  {
    icon: 'calendarHeart',
    iconTint: 'teal',
    title: 'Event & seasonal awareness',
    body: 'Jaipur Literature Festival, Diwali, long weekends — AI detects demand spikes before they show in your bookings.',
  },
  {
    icon: 'gauge',
    iconTint: 'coral',
    title: 'Min / max guardrails',
    body: 'Set a floor and ceiling. AI never goes below your cost floor or above your brand ceiling — you own the rules.',
  },
  {
    icon: 'sparkles',
    iconTint: 'teal',
    title: 'One-click accept or decline',
    body: "Review AI's weekly suggestion in under 3 minutes. Accept all, tweak individual nights, or decline with one tap.",
  },
  {
    icon: 'eye',
    iconTint: 'amber',
    title: 'Explainable reasoning',
    body: 'Every suggestion comes with a plain-language reason — so you understand why, not just what.',
  },
];

const ROADMAP: RoadmapStep[] = [
  { label: 'Phase 1', title: 'Owner Dashboard', state: 'done' },
  { label: 'Phase 2', title: 'Operator Register', state: 'done' },
  { label: 'Phase 3', title: 'Channel Manager', state: 'active' },
  { label: 'Roadmap', title: 'AI Pricing', state: 'future' },
  { label: 'Future', title: 'GST & Accounting', state: 'future' },
];

export default async function AiPricingPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');

  return (
    <ComingSoonLanding
      eyebrow="Tools"
      phaseLabel="On the roadmap"
      pageTitle="AI Pricing"
      pageSubtitle="Dynamic rate recommendations powered by demand signals & market data"
      heroEyebrowIcon="sparkles"
      heroEyebrowLabel="AI Pricing · Roadmap"
      heroTitle={
        <>
          Prices that think. <span className="text-[var(--color-teal)]">Revenue that grows.</span>
        </>
      }
      heroDescription="Stop guessing the right rate for tonight. Gojo's AI Pricing watches demand signals, competitor moves, and your own booking patterns — then suggests a price for every night, every room type. You stay in control: accept, tweak, or decline."
      heroPrimaryCta="Join the Waitlist"
      heroSecondaryCta="Learn More"
      heroNote="Beta opens after Channel Manager ships. Waitlist members get first access."
      featuresHeading="What AI Pricing will do"
      features={FEATURES}
      roadmapHeading="Gojo Launch Roadmap"
      roadmap={ROADMAP}
      notifyTitle="Help shape AI Pricing"
      notifyDescription="Join the waitlist and get early access when we open the beta. Your feedback will directly influence what we build."
      notifyCta="Join Waitlist"
    />
  );
}
