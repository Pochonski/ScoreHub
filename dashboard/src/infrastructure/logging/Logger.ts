type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private static instance: Logger
  // Auditoría 2026-Q3 Fase 7.2: en producción el logger viene deshabilitado
  // por default para no exponer data interna (errores con payloads sensibles)
  // en la consola del navegador. En dev se mantiene habilitado.
  private enabled = !import.meta.env.PROD

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, source?: string) {
    if (!this.enabled) return

    const prefix = source ? `[${source}]` : ''

    /* eslint-disable no-console -- esta clase ES el wrapper sobre console */
    switch (level) {
      case 'error':
        console.error(`${prefix} [ERROR] ${message}`, data || '')
        break
      case 'warn':
        console.warn(`${prefix} [WARN] ${message}`, data || '')
        break
      case 'debug':
        console.debug(`${prefix} [DEBUG] ${message}`, data || '')
        break
      default:
        console.log(`${prefix} [INFO] ${message}`, data || '')
    }
    /* eslint-enable no-console */
  }

  info(message: string, data?: Record<string, unknown>, source?: string) {
    this.log('info', message, data, source)
  }

  warn(message: string, data?: Record<string, unknown>, source?: string) {
    this.log('warn', message, data, source)
  }

  error(message: string, data?: Record<string, unknown>, source?: string) {
    this.log('error', message, data, source)
  }

  debug(message: string, data?: Record<string, unknown>, source?: string) {
    this.log('debug', message, data, source)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }
}

export const logger = Logger.getInstance()
