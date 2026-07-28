/**
 * src/interface/telegram/presenters/staticText.js — Textos estáticos (Fase 7, Fase 2).
 *
 * Comandos sin datos (ej. /help): el texto es presentación pura. Movido verbatim
 * desde el `case '/help'` de handleCommand para preservar el output byte a byte.
 */

function helpText() {
  return (
    `📖 *COMANDOS - ScoreHub*\n\n` +
    `⚽ *Partidos:*\n` +
    `  /partidos - Partidos de hoy\n` +
    `  /manana - Partidos de mañana\n` +
    `  /resultado [equipo] - Último resultado _(ej: /resultado brasil)_\n` +
    `  /analizar [eq1] vs [eq2] - Análisis _(ej: /analizar brasil vs argentina)_\n` +
    `  /proximos [equipo] · /siguiente [equipo] - Próximos partidos\n\n` +
    `🏆 *Tablas:*\n` +
    `  /tabla - Tabla del Mundial\n` +
    `  /grupo [A-L] - Grupo específico _(ej: /grupo A)_\n\n` +
    `👥 *Equipos:*\n` +
    `  /info [equipo] - Info del equipo\n` +
    `  /seguir [equipo] - Seguir equipo\n` +
    `  /cambiarusuario [nombre] - Cambiar apodo\n` +
    `  /yo · /reset - Perfil / borrar datos\n\n` +
    `🎯 *Tips, cuotas y tendencias:*\n` +
    `  /fixture - Próximos partidos del Mundial\n` +
    `  /outrights - Cuotas de campeón, goleador y más\n` +
    `  /odds <gameId> - Cuotas detalladas de un partido\n` +
    `  /tip [eq1] vs [eq2] - Tip con % de confianza\n` +
    `  /tendencias - Top tendencias + cuotas outright\n` +
    `  /tendencias [eq1] vs [eq2] - Trends de un partido\n` +
    `  /predicciones <gameId> - Predicciones comunidad\n\n` +
    `📡 *Stats en vivo:*\n` +
    `  /live - Partidos en vivo (con stats + odds)\n` +
    `  /stats-vivo <gameId> - Stats del último snapshot\n` +
    `  /alineacion <gameId> - Titulares y formación\n` +
    `  /previa <gameId> - Pre-match stats\n` +
    `  /h2h <gameId> - Historial entre los equipos\n\n` +
    `📰 *Contenido del Mundial:*\n` +
    `  /noticias - Últimas noticias del Mundial\n` +
    `  /noticias [equipo] - Noticias de un equipo\n` +
    `  /equipoideal - Team of the Week (formación, ratings)\n` +
    `  /bracket - Llaves eliminatorias\n` +
    `  /bracket grupos - Fase de grupos\n` +
    `  /historial - Todos los campeones\n` +
    `  /historial [año] - Final específica _(ej: /historial 2022)_\n` +
    `  /historial [equipo] - Ediciones del equipo _(ej: /historial brasil)_\n` +
    `  /goleadores - Ranking de goleadores\n\n` +
    `💡 _También entendés: "Cómo le fue a X", "Brasil vs Francia", "Estadísticas de X", "Tabla de la Premier"…_`
  );
}

module.exports = { helpText };
