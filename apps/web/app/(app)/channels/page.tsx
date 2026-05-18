import { redirect } from 'next/navigation';

import { ComingSoonLanding, type FeatureCard, type RoadmapStep } from '@/components/marketing/coming-soon-landing';
import { getServerActor } from '@/lib/auth/server-actor';

export const dynamic = 'force-dynamic';

const FEATURES: FeatureCard[] = [
  {
    icon: 'repeat',
    iconTint: 'teal',
    title: 'Real-time inventory sync',
    body: 'When a booking comes in on any channel, all others update instantly. No manual changes, no double-bookings.',
  },
  {
    icon: 'barChart3',
    iconTint: 'amber',
    title: 'Rate parity control',
    body: 'Set rate rules once. Apply different markups per channel — or enforce parity automatically across all platforms.',
  },
  {
    icon: 'barChart3',
    iconTint: 'teal',
    title: 'Channel performance dashboard',
    body: 'See revenue, bookings, and cancellations per channel side by side — know which OTA earns you the most.',
  },
  {
    icon: 'bell',
    iconTint: 'coral',
    title: 'Booking alerts',
    body: 'Get notified the moment a booking or cancellation arrives from any channel — before your guest contacts you.',
  },
  {
    icon: 'calendarRange',
    iconTint: 'teal',
    title: 'Availability calendar',
    body: 'A single calendar showing availability across all channels. Block dates, set stop-sell, or open rooms with one click.',
  },
  {
    icon: 'users2',
    iconTint: 'amber',
    title: 'MakeMyTrip Business integration',
    body: "Deep integration with MMT's partner API — including corporate rate plans, GST invoicing, and direct settlement.",
  },
];

const ROADMAP: RoadmapStep[] = [
  { label: 'Phase 1', title: 'Owner Dashboard', state: 'done' },
  { label: 'Phase 2', title: 'Operator Register', state: 'done' },
  { label: 'Phase 3', title: 'Channel Manager', state: 'active' },
  { label: 'Roadmap', title: 'AI Pricing', state: 'future' },
  { label: 'Future', title: 'GST & Accounting', state: 'future' },
];

export default async function ChannelsPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');

  return (
    <ComingSoonLanding
      eyebrow="Tools"
      phaseLabel="Coming in Phase 3"
      pageTitle="Channel Manager"
      pageSubtitle="Sync inventory & rates across all OTAs from one place"
      heroEyebrowIcon="link2"
      heroEyebrowLabel="Channel Manager · Phase 3"
      heroTitle={
        <>
          One dashboard. <span className="text-[var(--color-teal)]">Every OTA.</span> Zero gaps.
        </>
      }
      heroDescription="Stop logging into MakeMyTrip, Booking.com, and Goibibo separately. Gojo's Channel Manager pushes your room inventory and rates to all platforms in real time — so you never sell a room twice."
      heroPrimaryCta="Notify Me When Live"
      heroSecondaryCta="Learn More"
      heroNote="No commitment. We'll email you when Phase 3 launches."
      featuresHeading="What's included in Phase 3"
      features={FEATURES}
      roadmapHeading="Gojo Launch Roadmap"
      roadmap={ROADMAP}
      notifyTitle="Be first to use Channel Manager"
      notifyDescription="We'll let you know the moment it's ready for your property. No spam — one email when it launches."
      notifyCta="Notify Me"
    />
  );
}
