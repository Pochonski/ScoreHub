/**
 * src/interface/telegram/commands/fixture.js — Comando /fixture (Fase 7, Fase 2).
 *
 * Use-case GetFixture → presenter → envío, con el mismo try/catch del legacy
 * (mensaje de error si falla el upstream).
 */

const { fixtureMessage } = require('../presenters/matchMessages');

const TRIGGERS = ['/fixture', '/fixtures', '/calendario'];

function createFixtureCommand({ getFixture, sendMessage }) {
  return async function fixture(ctx) {
    try {
      const result = await getFixture();
      const { text, options } = fixtureMessage(result);
      await sendMessage(ctx.chatId, text, options);
    } catch (e) {
      await sendMessage(ctx.chatId, `⚠️ Error al obtener fixtures: ${e.message}`);
    }
  };
}

module.exports = { TRIGGERS, createFixtureCommand };
