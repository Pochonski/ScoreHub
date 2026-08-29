/**
 * src/application/matches/listMatchesForCompetition.js — Use-case piloto (Fase 8).
 *
 * Demuestra el uso de IMatchRepository: filtra por competición y fecha (la
 * lógica de aplicación vive acá, no en el repo). El presenter formatea la
 * salida; el repo sólo devuelve DTOs.
 *
 * La regla de "partidos de hoy" — filtro + orden + límite — es lógica de
 * aplicación y pertenece a la capa de use-cases. El repo expone el filtro
 * primitivo (competitionId, dateStr) sin opinión sobre cuántos ni cómo
 * presentarlos.
 */

function createListMatchesForCompetition({ matchRepository, clock = () => new Date() }) {
  if (!matchRepository) {
    throw new Error('createListMatchesForCompetition: matchRepository is required');
  }

  return async function listMatchesForCompetition(competitionId, { date } = {}) {
    const dateStr = date ?? clock().toISOString().slice(0, 10);
    const matches = await matchRepository.findByCompetitionAndDate(competitionId, dateStr);
    return {
      competitionId,
      date: dateStr,
      matches,
    };
  };
}

module.exports = { createListMatchesForCompetition };
