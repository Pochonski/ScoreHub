/**
 * Mock del módulo `https` para los golden-master del bot.
 *
 * `telegramRequest` (telegramBot.js) es el único choke point de red: todo
 * `sendMessage`/`sendPhoto`/`sendMediaGroup` termina en `https.request`.
 * Este mock intercepta ahí, captura el body (que es `JSON.stringify(params)`)
 * y responde `{ ok: true }` para que la promesa resuelva sin tocar la red.
 *
 * Uso en un test:
 *   jest.mock('https', () => require('./helpers/httpsCapture'));
 *   const { reset, getSent } = require('./helpers/httpsCapture');
 */

const captured = [];

function request(url, options, callback) {
  let body = '';
  const req = {
    on() { return req; },
    setTimeout() { return req; },
    write(chunk) { body += chunk; return true; },
    end() {
      const method = String(url).split('/').pop(); // .../sendMessage → sendMessage
      let params = {};
      try {
        params = body ? JSON.parse(body) : {};
      } catch {
        params = { _unparsedBody: body };
      }
      captured.push({ method, params });
      const res = {
        statusCode: 200,
        on(event, cb) {
          if (event === 'data') cb(Buffer.from(JSON.stringify({ ok: true, result: { message_id: 1 } })));
          if (event === 'end') cb();
          return res;
        },
      };
      callback(res);
      return req;
    },
    destroy() { return req; },
  };
  return req;
}

function reset() { captured.length = 0; }
function getSent() { return captured.map((c) => ({ method: c.method, params: c.params })); }

module.exports = { request, reset, getSent };
