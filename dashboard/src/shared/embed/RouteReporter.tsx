import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// ---------------------------------------------------------------------------
// RouteReporter: keeps the portfolio's integrated browser (NewPortfolio)
// in sync with client-side navigation.
//
// Child → parent on every navigation + mount:
//   { source: 'porto-site-route', href: window.location.href }
// Parent → child when the user types an address in the IDE browser:
//   { source: 'porto-site-navigate', href }
// The child only honors navigate requests from the portfolio itself and
// only to URLs on its own origin (anti open-redirect).
//
// Must be rendered inside <BrowserRouter>.
// ---------------------------------------------------------------------------

function isAllowedParentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol === 'http:' && url.hostname === 'localhost') return true
    return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app')
  } catch {
    return false
  }
}

interface PortoNavigateMessage {
  source?: unknown
  href?: unknown
}

export default function RouteReporter() {
  const location = useLocation()

  useEffect(() => {
    window.parent.postMessage(
      { source: 'porto-site-route', href: window.location.href },
      '*',
    )
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as PortoNavigateMessage | null
      if (!data || data.source !== 'porto-site-navigate' || typeof data.href !== 'string') {
        return
      }
      if (!isAllowedParentOrigin(event.origin)) return
      let dest: URL
      try {
        dest = new URL(data.href, window.location.origin)
      } catch {
        return
      }
      if (dest.origin !== window.location.origin) return
      if (dest.href !== window.location.href) window.location.assign(dest.href)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return null
}
