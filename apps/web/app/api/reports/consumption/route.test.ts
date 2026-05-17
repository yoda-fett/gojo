import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getConsumptionReport: vi.fn(),
  consumptionReportCsv: vi.fn(),
}));

vi.mock('@/lib/auth/api-handler', () => ({
  withAuth:
    (handler: (req: Request, actor: { propertyId: string; role: string; userId: string }) => Promise<Response>, roles: string[]) =>
    async (req: Request) => {
      const role = req.headers.get('x-test-role') ?? 'OWNER';
      if (!roles.includes(role)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      return handler(req, { propertyId: 'property-1', role, userId: 'user-1' });
    },
}));

vi.mock('@/lib/services/consumption-report', () => ({
  consumptionReportCsv: mocks.consumptionReportCsv,
  getConsumptionReport: mocks.getConsumptionReport,
}));

import { GET } from './route';

function request(url: string, init?: RequestInit) {
  return new Request(url, init) as Parameters<typeof GET>[0];
}

describe('consumption report API', () => {
  it('returns JSON report for Owner and scopes by actor property', async () => {
    mocks.getConsumptionReport.mockResolvedValue({ summary: [], byRoom: [], totals: { totalUsed: 0, expectedTotal: 0, variance: 0 } });

    const response = await GET(request('http://localhost/api/reports/consumption?from=2026-05-01&to=2026-05-14'));

    expect(response.status).toBe(200);
    expect(mocks.getConsumptionReport).toHaveBeenCalledWith('property-1', expect.objectContaining({ from: '2026-05-01', to: '2026-05-14' }));
  });

  it('exports CSV for authorized report requests', async () => {
    mocks.getConsumptionReport.mockResolvedValue({ period: { from: '2026-05-01', to: '2026-05-14' } });
    mocks.consumptionReportCsv.mockReturnValue('item,totalUsed\nSoap,3');

    const response = await GET(request('http://localhost/api/reports/consumption?from=2026-05-01&to=2026-05-14&format=csv'));

    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(await response.text()).toBe('item,totalUsed\nSoap,3');
  });

  it('forbids Front Desk access', async () => {
    const response = await GET(request('http://localhost/api/reports/consumption', { headers: { 'x-test-role': 'FRONT_DESK' } }));

    expect(response.status).toBe(403);
  });
});
