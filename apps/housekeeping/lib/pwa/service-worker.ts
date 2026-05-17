// @ts-nocheck
/// <reference lib="webworker" />

const scope = self as unknown as ServiceWorkerGlobalScope;

scope.addEventListener('fetch', (event) => {
  const { request } = event;
  const isHousekeepingStatus = request.method === 'PATCH' && request.url.includes('/api/rooms/') && request.url.includes('/housekeeping-status');
  const isIssueReport = request.method === 'POST' && request.url.includes('/api/issue-reports');
  if (!isHousekeepingStatus && !isIssueReport) return;

  event.respondWith(
    fetch(request.clone()).catch(
      () =>
        new Response(JSON.stringify({ queued: true, label: isIssueReport ? 'Issue report' : 'Task completion' }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
});
