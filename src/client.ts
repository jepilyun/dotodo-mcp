/**
 * dotodo REST API Client
 * MCP Server에서 API Key로 REST API를 호출하기 위한 클라이언트
 */

export interface ApiClient {
  get<T = unknown>(path: string, params?: Record<string, string>): Promise<T>
  post<T = unknown>(path: string, body?: unknown): Promise<T>
  put<T = unknown>(path: string, body?: unknown): Promise<T>
  patch<T = unknown>(path: string, body?: unknown): Promise<T>
  delete<T = unknown>(path: string, body?: unknown): Promise<T>
}

export function createApiClient(baseUrl: string, apiKey: string): ApiClient {
  const headers: Record<string, string> = {
    'Authorization': `ApiKey ${apiKey}`,
    'Content-Type': 'application/json',
  }

  async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, baseUrl)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const json = await res.json() as { success: boolean; data?: T; error?: { code: string; message: string } }

    if (!res.ok || !json.success) {
      const errMsg = json.error?.message || `API error: ${res.status}`
      throw new Error(errMsg)
    }

    return json.data as T
  }

  return {
    get: <T>(path: string, params?: Record<string, string>) => request<T>('GET', path, undefined, params),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  }
}
