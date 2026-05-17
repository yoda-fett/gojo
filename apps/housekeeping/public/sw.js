self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isPatchStatus =
    request.method === 'PATCH' && request.url.includes('/api/rooms/') && request.url.includes('/housekeeping-status');
  const isIssueReport = request.method === 'POST' && request.url.includes('/api/issue-reports');
  if (!isPatchStatus && !isIssueReport) return;

  event.respondWith(
    fetch(request.clone()).catch(
      () =>
        new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
});
