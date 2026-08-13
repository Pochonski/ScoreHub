const crypto = require('crypto');
const log = require('../utils/logger');
const gemini = require('./geminiService');

const QUICK_PARSE_SYSTEM_PROMPT = `Sos el clasificador de intenciones de "ScoreHub", un asistente de Telegram en español sobre fútbol y apuestas deportivas. Recibís mensajes coloquiales (a menudo sin acentos, jerga regional). Extraés intención y entidades.

# INTENTS

- "follow": el usuario quiere SUSCRIBIRSE a un ticket o partido para recibir notificaciones ("sígueme el 555", "avísame del ticket 123", "sigue el partido 4749268", "quiero saber qué pasa con el 555")
- "unfollow": quiere DESUSCRIBIRSE ("ya no me sigas el 555", "deja de seguir el partido 4749268", "ya no me avises del 123")
- "list_followed": quiere VER qué sigue ("qué tickets sigo", "qué sigues", "qué apuestas sigo", "misSeguimientos")
- "change_mode": quiere CAMBIAR el modo de notificación de un ticket ya seguido ("cambia el 555 a solo cuando gane", "modo outcome_only para el 123", "del 555 avísame solo al final")
- "query_stats": quiere ESTADÍSTICAS en vivo de un partido ("stats Portugal Croacia", "posesión del 4749268", "cómo va el partido 4749268", "cuántos goles lleva Portugal")
- "query_live": quiere PARTIDOS EN VIVO AHORA ("qué partidos hay en vivo", "partidos en vivo ahora", "live")
- "chat": mensaje casual que no pide acción ("hola", "gracias", "jaja", "qué cracks", insultos alegres)

# ENTIDADES

- ticketId: número del ticket de apuesta (si lo menciona, ej: "555" o "ticket 555")
- gameId: ID numérico de partido (rara vez lo dice el usuario; suele ser 4-7 dígitos)
- mode: "all_events" (todos los eventos) o "outcome_only" (solo cuando gane/pierde). Si no especifica, default "all_events".
- teamName: nombre del equipo si lo menciona (ej: "Portugal", "Brasil", "México"). Si lo menciona, incluirlo.

# REGLAS

1. "sígueme X" / "avísame de X" / "notifícame de X" / "sigue X" → intent "follow"
2. "ya no me sigas X" / "deja de seguir X" → intent "unfollow"
3. "qué sigo" / "qué sigues" / "misSeguimientos" / "qué apuestas sigo" → intent "list_followed"
4. "modo X para el ticket Y" / "cambia el Y a X" / "del Y avísame solo cuando gane" → intent "change_mode" con entities.mode y entities.ticketId
5. "stats X" / "cómo va el partido" / "posesión" / "goles" → intent "query_stats" (con teamName si lo menciona)
6. "partidos en vivo" / "live" / "qué hay en vivo" → intent "query_live"
7. "hola" / "gracias" / "jaja" / "qué cracks" / charla casual → intent "chat"
8. Si NO menciona ticket y NO es sobre fútbol/deportes → intent "chat"
9. Si el mensaje es ambiguo pero sugiere seguir un ticket/partido → intent "follow"
10. mode "all_events" = "cada evento", "todos los eventos", "todo", "cada gol", "cuando pase cualquier cosa". mode "outcome_only" = "solo cuando gane", "solo al final", "solo si pierdo", "cuando se decida"

# SALIDA

Devolvé SOLO JSON válido (sin texto antes ni después, sin markdown):

{
  "intent": "follow",
  "ticketId": "555",
  "gameId": null,
  "teamName": null,
  "mode": "all_events",
  "confidence": 0.92
}

Si NO es sobre fútbol/deportes o es charla casual → intent "chat" con confidence 0.5.

# EJEMPLOS

"avísame del 555"
→ {"intent":"follow","ticketId":"555","gameId":null,"teamName":null,"mode":"all_events","confidence":0.95}

"quiero saber qué pasa con mi ticket 123 pero solo cuando gane o pierda"
→ {"intent":"follow","ticketId":"123","gameId":null,"teamName":null,"mode":"outcome_only","confidence":0.93}

"sígueme el 555"
→ {"intent":"follow","ticketId":"555","gameId":null,"teamName":null,"mode":"all_events","confidence":0.95}

"deja de seguir el 555"
→ {"intent":"unfollow","ticketId":"555","gameId":null,"teamName":null,"mode":null,"confidence":0.95}

"qué sigo"
→ {"intent":"list_followed","ticketId":null,"gameId":null,"teamName":null,"mode":null,"confidence":0.9}

"cambia el 555 a solo cuando gane"
→ {"intent":"change_mode","ticketId":"555","gameId":null,"teamName":null,"mode":"outcome_only","confidence":0.92}

"stats de Portugal Croacia"
→ {"intent":"query_stats","ticketId":null,"gameId":null,"teamName":"Portugal","mode":null,"confidence":0.85}

"posesion del partido de Brasil"
→ {"intent":"query_stats","ticketId":null,"gameId":null,"teamName":"Brasil","mode":null,"confidence":0.85}

"qué partidos en vivo"
→ {"intent":"query_live","ticketId":null,"gameId":null,"teamName":null,"mode":null,"confidence":0.95}

"hola crack"
→ {"intent":"chat","ticketId":null,"gameId":null,"teamName":null,"mode":null,"confidence":0.6}

"gracias"
→ {"intent":"chat","ticketId":null,"gameId":null,"teamName":null,"mode":null,"confidence":0.7}
`;

const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CONFIDENCE_THRESHOLD = 0.6;

function quickParse(message) {
  if (!message) return null;
  const m = message.trim();

  let mm = m.match(/^\/follow\s+(\d+)\s*([^\s]*)\s*$/i);
  if (mm) {
    const mode = (mm[2] || '').toLowerCase();
    return {
      intent: 'follow',
      ticketId: mm[1],
      gameId: null,
      teamName: null,
      mode: mode === 'outcome' || mode === 'outcome_only' || mode === 'final' ? 'outcome_only' : 'all_events',
      confidence: 1.0,
    };
  }
  mm = m.match(/^\/unfollow\s+(\d+)\s*$/i);
  if (mm) return { intent: 'unfollow', ticketId: mm[1], gameId: null, teamName: null, mode: null, confidence: 1.0 };
  if (/^\/misapuestas\s*$/i.test(m) || /^\/siguiendo\s*$/i.test(m)) {
    return { intent: 'list_followed', ticketId: null, gameId: null, teamName: null, mode: null, confidence: 1.0 };
  }
  if (/^\/live\s*$/i.test(m)) return { intent: 'query_live', ticketId: null, gameId: null, teamName: null, mode: null, confidence: 1.0 };
  if (/^\/stats(\s+(.+))?$/i.test(m)) {
    const team = (m.match(/^\/stats\s+(.+)$/i) || [])[1] || null;
    return { intent: 'query_stats', ticketId: null, gameId: null, teamName: team, mode: null, confidence: team ? 0.9 : 0.7 };
  }
  return null;
}

function isObviousChat(message) {
  if (!message) return true;
  const m = message.trim().toLowerCase();
  if (m.length === 0) return true;
  const casual = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'gracias', 'thanks', 'jaja', 'jeje', 'lol', 'ok', 'okay', 'dale', 'va', 'listo', 'perfecto', 'crack', 'genial', 'increible', 'awesome', 'saludos', 'adios', 'chau', 'bye', 'que tal', 'que onda', 'todo bien', 'de acuerdo', 'vale'];
  return casual.some((c) => m === c || m.startsWith(c + ' ') || m.endsWith(' ' + c));
}

function hashMessage(message, ctx) {
  const h = crypto.createHash('sha1');
  h.update(JSON.stringify({ m: message.toLowerCase().trim(), r: (ctx?.recentTickets || []).slice(0, 3), g: (ctx?.recentGames || []).slice(0, 3) }));
  return h.digest('hex');
}

async function parseIntent(message, chatContext) {
  if (!message || !message.trim()) {
    return { intent: 'chat', ticketId: null, gameId: null, teamName: null, mode: null, confidence: 0 };
  }

  const quick = quickParse(message);
  if (quick) return quick;

  if (isObviousChat(message)) {
    return { intent: 'chat', ticketId: null, gameId: null, teamName: null, mode: null, confidence: 0.5 };
  }

  const cacheKey = hashMessage(message, chatContext);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const prompt = `${QUICK_PARSE_SYSTEM_PROMPT}\n\nMensaje del usuario: "${message}"\nContexto reciente: ${JSON.stringify(chatContext || {})}\n\nResponde con JSON válido:`;
    const result = await gemini.analyzeMessageRaw(prompt);
    const parsed = result || {};
    const intent = (parsed.intent || 'chat').toLowerCase();
    const out = {
      intent,
      ticketId: parsed.ticketId ? String(parsed.ticketId) : null,
      gameId: parsed.gameId ? String(parsed.gameId) : null,
      teamName: parsed.teamName || null,
      mode: parsed.mode || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    };
    cache.set(cacheKey, { at: Date.now(), value: out });
    return out;
  } catch (e) {
    log.error({ err: e }, 'intentParser: Gemini error');
    return { intent: 'chat', ticketId: null, gameId: null, teamName: null, mode: null, confidence: 0.3 };
  }
}

function isConfident(intent) {
  return intent.confidence >= CONFIDENCE_THRESHOLD;
}

module.exports = { parseIntent, isConfident, quickParse, CONFIDENCE_THRESHOLD };