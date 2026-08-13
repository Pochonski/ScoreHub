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

## Estado

**Cuarentenado permanente desde la Fase 7 (Q3 2025).** Auditoría 2026-Q3 Fase 12
confirma que NO se reactivará:

- El canal activo es Telegram (mayor base de usuarios hispanohablantes).
- El dashboard cubre Mundial + multi-comp (Liga Promerica, Liga MX, MLS, etc.).
- WhatsApp Web requiere Chromium (~200MB) + Puppeteer, lo que rompe serverless.
- El código se conserva como referencia histórica / repo personal.

**Para reactivar** (NO recomendado):
1. `npm install whatsapp-web.js qrcode-terminal`
2. Setear `ENABLE_WHATSAPP=true` en `.env`.
3. Verificar que el host tiene Chrome/Chromium instalado.
4. El código de `whatsapp-bot.js` no se ha mantenido — puede requerir ajustes.

Se conserva el código (no se borra) por si en el futuro se quiere retomar el canal.
