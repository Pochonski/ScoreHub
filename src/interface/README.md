# `interface/` — Delivery

Mecanismos de entrega. Traducen input externo → caso de uso → output formateado. Dependen hacia adentro.

- `telegram/`
  - `client.js` — transporte: `telegramRequest`, `sendMessage`, `sendPhoto`, retry.
  - `lifecycle.js` — polling loop, webhook, `fetchOnce`, `init`, shutdown.
  - `router.js` — registry: mapa `comando → command handler` (con alias y `@botmundialistabot`).
  - `commands/` — un archivo por comando; llama a un caso de uso y a un presenter.
  - `presenters/` — formateo Markdown/teclados (lo que hoy está inline en `handleCommand`).
- `scheduler/` — el cron de `sync.js`: agenda casos de uso de `application/sync`.
- `http/` — admin server (rate-limit + rutas admin).
