const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
}

const UNSAFE_URL_PATTERN = /^(javascript|data|vbscript):/i

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] || ch)
}

export function sanitizeUrl(url: string): string {
  const trimmed = url.trim()
  if (UNSAFE_URL_PATTERN.test(trimmed)) return ''
  return trimmed
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength).replace(/\s+\S*$/, '') + '…'
}

export function sanitizeHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}
