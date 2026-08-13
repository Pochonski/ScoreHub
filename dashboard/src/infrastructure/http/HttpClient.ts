import { AppError, ErrorCode } from '@/infrastructure/errors/AppError'

type RequestOptions = {
  params?: Record<string, string | number | undefined>
  timeout?: number
  headers?: Record<string, string>
  signal?: AbortSignal
}

export class HttpClient {
  private baseUrl: string
  private originBase: string | undefined

  constructor(baseUrl: string) {
    // Auditoría 2026-Q3 Fase 7.5: en producción, baseUrl absoluto es PREFERIBLE
    // para evitar el fallback window.location.origin (puede no ser el esperado en
    // deployments cross-origin). Pero para deployments same-origin (Vercel sirve
    // dashboard + API en el mismo host, Supabase no activado), una URL relativa
    // es válida y NO debe crashear la app. Emitimos un warning en consola si
    // el modo dev está activo para recordar al dev que setee VITE_API_BASE_URL
    // antes del deploy a producción.
    if (
      import.meta.env.DEV &&
      baseUrl.startsWith('/') &&
      !import.meta.env.VITE_API_BASE_URL
    ) {
      // Audit 2026-Q3: solo warning en dev. En producción, relativa funciona
      // si dashboard y API son same-origin.
      console.warn(
        '[HttpClient] baseUrl es relativa; considera setear VITE_API_BASE_URL explícitamente.'
      )
    }
    this.baseUrl = baseUrl
    this.originBase = baseUrl.startsWith('/') ? window.location.origin : undefined
  }

  private buildUrl(path: string, params?: RequestOptions['params']): string {
    const url = new URL(`${this.baseUrl}${path}`, this.originBase)

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
    const { signal: externalSignal } = options

    const timeoutId = options.timeout ? setTimeout(() => controller.abort(), options.timeout) : undefined

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ErrorCode.UNAUTHORIZED
            : response.status === 403
              ? ErrorCode.FORBIDDEN
              : response.status === 404
                ? ErrorCode.NOT_FOUND
                : response.status >= 500
                  ? ErrorCode.SERVER_ERROR
                  : ErrorCode.VALIDATION_ERROR

        throw new AppError(`HTTP ${response.status}: ${response.statusText}`, code, response.status)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof AppError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError('Request timed out', ErrorCode.TIMEOUT, 408)
      }
      throw new AppError(error instanceof Error ? error.message : 'Unknown error', ErrorCode.NETWORK_ERROR, 0)
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
}
