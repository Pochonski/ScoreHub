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

function previaUsage() {
  return (
    `🔮 *PREVIA DE PARTIDO*\n\n` +
    `Uso: \`/previa <gameId>\`\n\n` +
    `Ejemplo: \`/previa 4749268\`\n\n` +
    `💡 Las previas se generan para partidos programados (statusGroup=2).`
  );
}

function h2hUsage() {
  return (
    `🤝 *HISTORIAL ENTRE EQUIPOS (H2H)*\n\n` +
    `Uso: \`/h2h <gameId>\`\n\n` +
    `Ejemplo: \`/h2h 4749268\``
  );
}

function oddsUsage() {
  return (
    `🎲 *CUOTAS DE PARTIDO*\n\n` +
    `Uso: \`/odds <gameId>\`\n\n` +
    `Ejemplo: \`/odds 4749268\`\n\n` +
    `💡 Para encontrar el gameId, usá \`/partidos\`, \`/fixture\` o \`/live\`.`
  );
}

function statsVivoUsage() {
  return (
    `📊 *STATS EN VIVO*\n\n` +
    `Uso: \`/stats-vivo <gameId>\`\n\n` +
    `Ejemplo: \`/stats-vivo 4749268\`\n\n` +
    `💡 Para encontrar el gameId:\n` +
    `• \`/live\` para partidos en vivo\n` +
    `• \`/tip brasil vs argentina\` para un partido próximo`
  );
}

function prediccionesUsage() {
  return (
    `🗳️ *PREDICCIONES DE LA COMUNIDAD*\n\n` +
    `Uso: \`/predicciones <gameId>\`\n\n` +
    `Ejemplo: \`/predicciones 4749268\`\n\n` +
    `💡 Para buscar el gameId, usá \`/tip brasil vs argentina\` o \`/live\`.`
  );
}

function tipUsage() {
  return (
    `🎯 *TIP DE PARTIDO*\n\n` +
    `Uso: \`/tip [equipo1] vs [equipo2]\`\n\n` +
    `Ejemplos:\n` +
    `• /tip brasil vs argentina\n` +
    `• /tip francia vs alemania\n\n` +
    `💡 El tip se calcula con base en las tendencias de los partidos (365scores). ` +
    `Para más detalles: \`/tendencias brasil vs argentina\` o \`/stats-vivo <gameId>\` (si lo conocés).`
  );
}

function tipFormatError() {
  return (
    `⚠️ Formato: \`/tip [equipo1] vs [equipo2]\`\n\n` +
    `Ejemplo: \`/tip brasil vs argentina\``
  );
}

function tendenciasUsage() {
  return (
    `📊 *TENDENCIAS*\n\n` +
    `Uso:\n` +
    `  \`/tendencias\` — Top Mundial\n` +
    `  \`/tendencias brasil vs argentina\` — Trends del partido\n\n` +
    `💡 Para stats en vivo de un partido, usá los nombres con /tip, /stats-vivo o /alineacion.`
  );
}

module.exports = {
  helpText,
  previaUsage,
  h2hUsage,
  oddsUsage,
  statsVivoUsage,
  prediccionesUsage,
  tipUsage,
  tipFormatError,
  tendenciasUsage,
};
