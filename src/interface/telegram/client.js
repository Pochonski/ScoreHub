/**
 * src/interface/telegram/client.js — Transporte de Telegram (Fase 7, Fase 1).
 *
 * Extraído verbatim de telegramBot.js: es la capa de delivery que habla con la
 * API HTTP de Telegram. Único choke point de red saliente del bot.
 *
 *   - telegramRequest         → request crudo (rechaza ok:false con flags)
 *   - telegramRequestWithRetry→ backoff ante 429 (interno)
 *   - sendMessage/sendPhoto   → fallback Markdown → texto plano
 *   - sendMediaGroup
 *
 * El token se lee de env al cargar el módulo (igual que antes). Bajo tests el
 * módulo `https` está mockeado (tests/helpers/httpsCapture.js), por lo que estos
 * envíos se capturan sin tocar la red.
 */

const https = require('https');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

/**
 * Errores que la API de Telegram puede devolver cuando parse_mode=Markdown
 * es rechazado. Ver:
 *  - 400 Bad Request: can't parse entities
 *  - descripciones que mencionan "Markdown", "entity", "parse"
 */
const MARKDOWN_HINTS = [
  "can't parse",
  "parse entities",
  'parse_mode',
  'unsupported start symbol',
  'no start symbol',
];

function looksLikeMarkdownIssue(parsed) {
  const text = `${parsed?.description || ''}`;
  return text && MARKDOWN_HINTS.some((h) => text.toLowerCase().includes(h));
}

/**
 * Hace una solicitud a la API de Telegram.
 *
 * Antes: cualquier `ok:false` (excepto 429) se resolvía con `parsed`,
 *        dejando al caller creer que el mensaje se había enviado. Ahora:
 *        se rechaza con un Error anotado con flags para que sendMessage /
 *        sendPhoto puedan decidir fallback (Markdown → plain text) y que
 *        el caller de alto nivel vea el fallo.
 */
async function telegramRequest(method, params = {}, timeoutMs = 60000) {
  const url = new URL(`${API_URL}/${method}`);
  const body = JSON.stringify(params);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) return resolve(parsed);
          const markdownIssue = looksLikeMarkdownIssue(parsed);
          const err = new Error(
            `Telegram API ${method} ${parsed.error_code || ''}: ${parsed.description || 'unknown error'}`
          );
          err.telegramError = true;
          err.response = parsed;
          err.markdownIssue = markdownIssue;
          err.description = parsed.description;
          err.errorCode = parsed.error_code;
          if (parsed.error_code === 429 && parsed.parameters?.retry_after) {
            err.isRateLimited = true;
            err.retryAfter = parsed.parameters.retry_after;
          }
          console.error(
            `[Telegram API] ${method} falló [${parsed.error_code}]: ${parsed.description}` +
              (markdownIssue ? ' (markdownIssue=true)' : '')
          );
          reject(err);
        } catch (e) {
          reject(new Error(`Telegram API (${method}): respuesta no-JSON: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Telegram API (${method}): timeout after ${timeoutMs}ms`)); });
    req.write(body);
    req.end();
  });
}

/**
 * Envuelve telegramRequest con backoff ante rate-limit (429).
 * Reintenta respetando retry_after de Telegram.
 */
async function telegramRequestWithRetry(method, params = {}, timeoutMs = 60000, attempt = 0) {
  try {
    return await telegramRequest(method, params, timeoutMs);
  } catch (e) {
    if (e.isRateLimited && attempt < 3) {
      const wait = (e.retryAfter || 1) * 1000;
      console.warn(`[Telegram] 429 en ${method}, esperando ${e.retryAfter}s (intento ${attempt + 1})...`);
      await new Promise((r) => setTimeout(r, wait));
      return telegramRequestWithRetry(method, params, timeoutMs, attempt + 1);
    }
    throw e;
  }
}

/**
 * Envía un mensaje (con backoff ante 429).
 *
 * Si el primer intento falla por un error relacionado con Markdown,
 * reintenta sin `parse_mode` (texto plano). Solo se hace UN fallback,
 * no un loop infinito.
 */
async function sendMessage(chatId, text, options = {}) {
  const params = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...options,
  };
  try {
    return await telegramRequestWithRetry('sendMessage', params);
  } catch (err) {
    if (err.markdownIssue && params.parse_mode) {
      const retryParams = { ...params };
      delete retryParams.parse_mode;
      console.warn(`[Telegram] sendMessage markdown inválido, reintentando sin parse_mode`);
      return telegramRequestWithRetry('sendMessage', retryParams);
    }
    throw err;
  }
}

async function sendPhoto(chatId, photoUrl, caption = '', options = {}) {
  const params = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'Markdown',
    ...options,
  };
  try {
    return await telegramRequestWithRetry('sendPhoto', params);
  } catch (err) {
    if (err.markdownIssue && params.parse_mode) {
      const retryParams = { ...params };
      delete retryParams.parse_mode;
      console.warn(`[Telegram] sendPhoto markdown inválido en caption, reintentando sin parse_mode`);
      return telegramRequestWithRetry('sendPhoto', retryParams);
    }
    throw err;
  }
}

async function sendMediaGroup(chatId, media, options = {}) {
  return telegramRequest('sendMediaGroup', {
    chat_id: chatId,
    media,
    ...options,
  });
}

module.exports = {
  telegramRequest,
  sendMessage,
  sendPhoto,
  sendMediaGroup,
};
