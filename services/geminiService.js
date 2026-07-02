// Gemini AI Service para entender consultas de fútbol
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });

// Contexto del bot - información sobre equipos y funcionalidades
const BOT_CONTEXT = `
Eres un asistente de fútbol del Mundial 2026. Solo hablas de:
- Equipos del Mundial 2026 (48 países)
- Partidos, resultados, estadísticas
- Tablas de posiciones
- Análisis de apuestas

Equipos del Mundial 2026:
Argentina, Brazil, Uruguay, Colombia, Chile, Peru, Ecuador, Venezuela, Paraguay, Bolivia,
Mexico, USA, Canada, Jamaica, Honduras, Costa Rica, Panama, Guatemala,
Germany, France, England, Spain, Italy, Portugal, Netherlands, Belgium, Croatia, Switzerland,
Poland, Denmark, Sweden, Norway, Austria, Wales, Scotland, Ireland, Czech Republic, Hungary,
Romania, Serbia, Slovakia, Finland, Greece, Ukraine, Russia, Iceland, Turkey,
Japan, South Korea, Iran, Australia, Saudi Arabia, Qatar, UAE, Iraq, Jordan, Oman,
Morocco, Senegal, Ghana, Cameroon, Nigeria, Egypt, Algeria, Tunisia, South Africa, Zambia,
DR Congo, Mali, Uganda, New Zealand

Intents posibles:
- SALUDO: saludos, hola, buenos dias, buenas
- HELP: ayuda, comandos, que puedes hacer
- PARTIDOS_HOY: partidos de hoy, que hay hoy, que se juega hoy
- PARTIDO_FECHA: partidos del [fecha específica explícita como "5 de julio", "el viernes", "mañana"]. NO uses esto para "últimos partidos".
- RESULTADO: resultado de [equipo], como quedo [equipo], como le fue a [equipo], ultimo partido de [equipo], últimos partidos de [equipo], partidos recientes de [equipo], últimos resultados de [equipo]
- RESULTADO_VS: [equipo] vs [equipo], [equipo] contra [equipo]
- INFO_EQUIPO: info de [equipo], informacion de [equipo], datos de [equipo], quien es [equipo]
- ESTADISTICA: estadisticas de [equipo], corners de [equipo], goles de [equipo]
- TABLA: tabla de posiciones, clasificacion
- TABLA_MUNDIAL: tabla del mundial, grupo [letra]
- ANALISIS: analiza [equipo] vs [equipo], pronostico
- SEGUIR_EQUIPO: seguir [equipo], notificar [equipo]
- DEJAR_SEGUIR: dejar de seguir [equipo]
- MIS_EQUIPOS: mis equipos, equipos seguidos

Reglas importantes para distinguir RESULTADO vs PARTIDO_FECHA:
- "últimos partidos de X", "partidos recientes de X", "último resultado de X", "cómo quedó X", "cómo le fue a X" → SIEMPRE es RESULTADO
- "partidos del 5 de julio", "qué juega X el viernes", "cuándo juega X" → es PARTIDO_FECHA
- Si NO hay fecha explícita (día, "el viernes", "mañana") → usa RESULTADO

Responde SOLO con JSON:
{"intent": "INTENT", "equipo": "nombre del equipo o null", "home": "equipo local o null", "away": "equipo visitante o null", "fecha": "fecha en YYYYMMDD o null", "liga": "liga o null", "grupo": "grupo A-H o null"}
`;

/**
 * Analiza un mensaje usando Gemini para extraer intent y entidades
 */
async function analyzeMessage(message) {
  try {
    const prompt = `${BOT_CONTEXT}

Mensaje del usuario: "${message}"

Responde con JSON válido:`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    // Extraer JSON de la respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Normalizar intent a minúsculas y guiones bajos para que coincida con INTENTOS
      const normalizedIntent = (parsed.intent || 'UNKNOWN').toLowerCase().replace(/[-\s]/g, '_');
      return {
        success: true,
        intent: normalizedIntent,
        equipo: parsed.equipo || null,
        home: parsed.home || null,
        away: parsed.away || null,
        fecha: parsed.fecha || null,
        liga: parsed.liga || null,
        grupo: parsed.grupo || null
      };
    }

    return { success: false, intent: 'UNKNOWN' };
  } catch (error) {
    console.error('Error Gemini:', error.message);
    return { success: false, intent: 'UNKNOWN', error: error.message };
  }
}

/**
 * Genera una respuesta más natural usando Gemini (para fallback)
 */
async function generateNaturalResponse(intent, entities) {
  try {
    let prompt = `Eres un asistente de fútbol argentino. Genera una respuesta corta y natural (máx 100 palabras) sobre: `;

    switch (intent) {
      case 'SALUDO':
        prompt += 'saludo amigable del asistente';
        break;
      case 'HELP':
        prompt += 'lista de comandos disponibles';
        break;
      case 'PARTIDOS_HOY':
        prompt += 'partidos de hoy del Mundial';
        break;
      case 'RESULTADO':
        prompt += `resultado del equipo ${entities.equipo}`;
        break;
      case 'RESULTADO_VS':
        prompt += `resultado de ${entities.home} vs ${entities.away}`;
        break;
      case 'INFO_EQUIPO':
        prompt += `información del equipo ${entities.equipo}`;
        break;
      case 'ESTADISTICA':
        prompt += `estadísticas del equipo ${entities.equipo}`;
        break;
      case 'TABLA_MUNDIAL':
        prompt += `tabla del Mundial ${entities.grupo ? 'del grupo ' + entities.grupo : ''}`;
        break;
      default:
        prompt += 'consulta de fútbol';
    }

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Error Gemini generateResponse:', error.message);
    return null;
  }
}

module.exports = {
  analyzeMessage,
  generateNaturalResponse
};
