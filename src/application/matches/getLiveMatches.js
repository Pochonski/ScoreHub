/**
 * src/application/matches/getLiveMatches.js — Use-case (Fase 7, Fase 2).
 *
 * Devuelve el texto de partidos en vivo + la lista de partidos (para el teclado).
 * Depende solo del puerto ScoresGateway.
 */

function createGetLiveMatches({ scoresGateway }) {
  return async function getLiveMatches() {
    const text = await scoresGateway.getLiveGamesText();
    const games = await scoresGateway.findLiveGames();
    return { text, games };
  };
}

module.exports = { createGetLiveMatches };
