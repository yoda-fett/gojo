import { proxyToWebApi } from '@/lib/web-api-proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToWebApi(req, `/api/rooms/${id}/housekeeping-status`);
}
