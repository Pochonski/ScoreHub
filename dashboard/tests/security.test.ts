import { describe, it, expect } from 'vitest'
import { escapeHtml, sanitizeUrl, truncate, sanitizeHtml } from '@/shared/sanitize'

describe('sanitize', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('does not modify safe strings', () => {
      expect(escapeHtml('hello world')).toBe('hello world')
    })

    it('escapes ampersands first to avoid double-encoding', () => {
      expect(escapeHtml('&')).toBe('&amp;')
    })
  })

  describe('sanitizeUrl', () => {
    it('strips javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    })

    it('strips data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
    })

    it('preserves https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com')
    })

    it('preserves relative URLs', () => {
      expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource')
    })
  })

  describe('truncate', () => {
    it('truncates strings longer than maxLength', () => {
      const result = truncate('hello world this is long', 10)
      expect(result.length).toBeLessThanOrEqual(13)
      expect(result).toMatch(/…$/)
    })

    it('returns full string if within maxLength', () => {
      expect(truncate('short', 10)).toBe('short')
    })

    it('handles empty string', () => {
      expect(truncate('', 5)).toBe('')
    })
  })

  describe('sanitizeHtml', () => {
    it('removes all HTML tags', () => {
      expect(sanitizeHtml('<p>hello</p><script>bad</script>')).toBe('hellobad')
    })

    it('preserves text content', () => {
      expect(sanitizeHtml('<div>text content</div>')).toBe('text content')
    })
  })
})
