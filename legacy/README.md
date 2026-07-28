# legacy/

Código conservado por referencia, **inactivo**, fuera del producto vivo.

## `whatsapp-bot.js`

Bot de WhatsApp original (`whatsapp-web.js` + `qrcode-terminal`). Cuarentenado en
la **Fase 7** (Clean Architecture). El producto activo es el **bot de Telegram**
(`telegramBot.js` en la raíz).

- Las dependencias `whatsapp-web.js` y `qrcode-terminal` (pesadas — Puppeteer/
  Chromium) se **removieron de `package.json`**; solo las usaba este archivo.
  Para reactivar WhatsApp: reinstalarlas (`npm i whatsapp-web.js qrcode-terminal`).
- `handlers/messageHandler.js` es **platform-agnostic** (procesa un mensaje
  genérico `{ from, body, reply }`) y sigue vivo: lo usa el bot de Telegram para
  la ruta de lenguaje natural. No se tocó.
- Nunca arrancaba salvo con `ENABLE_WHATSAPP=true`.

Se conserva el código (no se borra) por si en el futuro se quiere retomar el canal.
