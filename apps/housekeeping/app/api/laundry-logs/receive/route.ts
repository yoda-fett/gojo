import { proxyToWebApi } from '@/lib/web-api-proxy';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return proxyToWebApi(req, '/api/laundry-logs/receive');
}
