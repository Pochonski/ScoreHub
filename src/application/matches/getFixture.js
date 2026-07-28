/**
 * src/application/matches/getFixture.js — Use-case (Fase 7, Fase 2).
 *
 * Devuelve el texto del fixture + los próximos partidos (futuros, ordenados,
 * top 10) para el teclado. La regla de "próximos" (filtro por fecha + orden +
 * límite) es lógica de aplicación y vive acá, no en el gateway ni en el presenter.
 */

function createGetFixture({ scoresGateway }) {
  return async function getFixture() {
    const text = await scoresGateway.getFixtureText();
    const raw = await scoresGateway.getFixtures(scoresGateway.competitionId);
    const games = (raw?.games || [])
      .filter((g) => new Date(g.startTime || g.date || 0) > new Date())
      .sort((a, b) => new Date(a.startTime || a.date) - new Date(b.startTime || b.date))
      .slice(0, 10);
    return { text, games };
  };
}

module.exports = { createGetFixture };
