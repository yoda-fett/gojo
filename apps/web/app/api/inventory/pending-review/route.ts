import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-handler';
import { getPendingReview } from '@/lib/services/housekeeping-inventory';

export const GET = withAuth(async (req, actor) => {
  const params = new URL(req.url).searchParams;
  const attributionStream = params.get('attributionStream');
  const data = await getPendingReview(actor, {
    attributionStream:
      attributionStream === 'ROOM_SHORTAGE' || attributionStream === 'LAUNDRY_SHORTAGE' || attributionStream === 'OTHER'
        ? attributionStream
        : null,
  });
  return NextResponse.json(data);
}, ['OWNER', 'MANAGER', 'FRONT_DESK']);
