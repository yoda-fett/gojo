export interface HealthResponse {
  status: string;
  timestamp: string;
}

export function createApiClient() {
  return {
    async getHealth(): Promise<HealthResponse> {
      const response = await fetch('/api/internal/health');
      return (await response.json()) as HealthResponse;
    },
  };
}
