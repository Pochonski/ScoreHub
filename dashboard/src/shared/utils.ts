export class DateUtils {
  static isValidDate(d: Date): boolean {
    return d instanceof Date && !isNaN(d.getTime())
  }

  static formatDate(iso: string): string {
    try {
      const d = new Date(iso)
      if (!DateUtils.isValidDate(d)) return ''
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  static formatTime(iso: string): string {
    try {
      const d = new Date(iso)
      if (!DateUtils.isValidDate(d)) return ''
      return d.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    } catch {
      return ''
    }
  }

  static formatShortDate(iso: string): string {
    try {
      const d = new Date(iso)
      if (!DateUtils.isValidDate(d)) return ''
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      })
    } catch {
      return ''
    }
  }

  static formatTimeOnly(iso: string): string {
    try {
      const d = new Date(iso)
      if (!DateUtils.isValidDate(d)) return ''
      return d.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    } catch {
      return ''
    }
  }

  static isToday(iso: string): boolean {
    try {
      const date = new Date(iso)
      if (!DateUtils.isValidDate(date)) return false
      const today = new Date()
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      )
    } catch {
      return false
    }
  }
}

export class ArrayUtils {
  static groupBy<T, K extends keyof any>(array: T[], key: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>()
    for (const item of array) {
      const group = key(item)
      if (!map.has(group)) {
        map.set(group, [])
      }
      map.get(group)?.push(item)
    }
    return map
  }

  static filterBy<T>(array: T[], predicates: ((item: T) => boolean)[]): T[] {
    return array.filter((item) => predicates.every((predicate) => predicate(item)))
  }

  static sortBy<T>(array: T[], compareFn: (a: T, b: T) => number): T[] {
    return [...array].sort(compareFn)
  }

  static unique<T>(array: T[], key?: (item: T) => string): T[] {
    if (!key) {
      return [...new Set(array)]
    }
    const seen = new Set<string>()
    return array.filter((item) => {
      const k = key(item)
      if (seen.has(k)) {
        return false
      }
      seen.add(k)
      return true
    })
  }
}

export class StringUtils {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  static truncate(str: string, length: number, suffix: string = '...'): string {
    if (str.length <= length) return str
    return str.slice(0, length) + suffix
  }

  static slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[àáâãä]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }
}

export class AsyncUtils {
  static withTimeout<T>(promise: Promise<T>, timeout: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeout)),
    ])
  }

  static debounce<T extends (...args: any[]) => any>(fn: T, wait: number): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => fn(...args), wait)
    }
  }

  static memoize<T extends (...args: any[]) => any>(fn: T): T {
    const cache = new Map<string, ReturnType<T>>()
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = JSON.stringify(args)
      if (cache.has(key)) {
        return cache.get(key)!
      }
      const result = fn(...args)
      cache.set(key, result)
      return result
    }) as T
  }
}
