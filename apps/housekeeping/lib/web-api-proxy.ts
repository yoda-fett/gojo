import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { HK_SESSION_COOKIE } from './auth';

// Server-to-server forwarder: reads the staff's httpOnly HK JWT, calls web's
// API with it as `Authorization: Bearer`, returns the response untouched.
// Used by the task-submit proxy routes — `apps/housekeeping/app/api/rooms/...`,
// `/api/consumption-logs`, `/api/laundry-logs` — so the dashboard endpoints
// stay single source of truth (we don't re-implement business logic here).
//
// `targetPath` is the web endpoint path starting with `/api/...`.
export async function proxyToWebApi(
  req: Request,
  targetPath: string,
): Promise<Response> {
  const base = process.env.WEB_API_BASE_URL;
  if (!base) {
    return NextResponse.json(
      { code: 'CONFIG_ERROR', message: 'WEB_API_BASE_URL is not configured' },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(HK_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'No housekeeping session' },
      { status: 401 },
    );
  }

  // Carry through the body verbatim. Idempotency-key + content-type are the
  // only request headers the downstream handlers care about.
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const idempotency = req.headers.get('idempotency-key');
  if (idempotency) headers.set('idempotency-key', idempotency);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const init: RequestInit = { method: req.method, headers };
  if (hasBody) init.body = await req.arrayBuffer();

  const upstream = await fetch(`${base}${targetPath}`, init);

  // Pass status + body through. Strip hop-by-hop response headers (transfer-encoding etc.)
  // by reading the body and re-emitting via NextResponse.
  const respBody = await upstream.arrayBuffer();
  const respHeaders = new Headers();
  const ct = upstream.headers.get('content-type');
  if (ct) respHeaders.set('content-type', ct);
  return new NextResponse(respBody, { status: upstream.status, headers: respHeaders });
}
