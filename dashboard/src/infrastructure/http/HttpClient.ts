type RequestOptions = {
  params?: Record<string, string | number | undefined>
  timeout?: number
  headers?: Record<string, string>
}

type ApiResponse<T> = {
  data: T | null
  error: string | null
  loading: boolean
}

class HttpClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpClientError'
    this.status = status
  }
}

export class HttpClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private buildUrl(path: string, params?: RequestOptions['params']): string {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      })
    }

    return url.toString()
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params)

    const controller = new AbortController()
    const timeoutId = options.timeout
      ? setTimeout(() => controller.abort(), options.timeout)
      : undefined

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new HttpClientError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        )
      }

      return await response.json()
    } catch (error) {
      if (error instanceof HttpClientError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new HttpClientError('Request timed out', 408)
      }
      throw new HttpClientError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
      )
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
}
