// @ts-nocheck
import { redirect } from 'next/navigation';

import { getServerActor } from '@/lib/auth/server-actor';
import { listChannels } from '@/lib/services/channels';

import { NoChannelsEmptyState } from './_empty-states/no-channels';
import { ChannelsClient } from './channels-client';

export const dynamic = 'force-dynamic';

export default async function ChannelsPage() {
  const actor = await getServerActor();
  if (!actor) redirect('/sign-in');
  const channels = await listChannels(actor.propertyId);

  return (
    <main className="gojo-page">
      <header className="gojo-page-header">
        <div>
          <p className="gojo-eyebrow">Tools</p>
          <h1>Channels</h1>
        </div>
      </header>
      {channels.length === 0 && actor.role !== 'OWNER' ? (
        <NoChannelsEmptyState />
      ) : (
        <ChannelsClient initialChannels={channels} canMutate={actor.role === 'OWNER'} />
      )}
    </main>
  );
}
