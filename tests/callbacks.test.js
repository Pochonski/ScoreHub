/**
 * Caracterización del dispatcher de callbacks de botones inline (Fase 7).
 */

const { createCallbackDispatcher } = require('../src/interface/telegram/callbacks');

const CHAT = 12345;

function build(overrides = {}) {
  const sent = [];
  const sendMessage = jest.fn(async (chatId, text, options) => { sent.push({ chatId, text, options }); });
  const scoresGateway = {
    formatTipForGame: jest.fn(),
    getTendenciasForGame: jest.fn(),
    getOdds: jest.fn(),
    getH2H: jest.fn(),
    getPrevia: jest.fn(),
    getAlineacion: jest.fn(),
    getStatsVivo: jest.fn(),
    ...overrides.scoresGateway,
  };
  const cache = { getGameById: jest.fn(), ...overrides.cache };
  const dispatch = createCallbackDispatcher({ scoresGateway, cache, sendMessage });
  return { dispatch, sent, sendMessage, scoresGateway, cache };
}

describe('callbacks — parsing', () => {
  test('sin "_" → "Acción no válida"', async () => {
    const { dispatch, sent } = build();
    await dispatch(CHAT, 'noguion');
    expect(sent).toEqual([{ chatId: CHAT, text: '⚠️ Acción no válida.', options: undefined }]);
  });

  test('acción desconocida → "Acción no reconocida"', async () => {
    const { dispatch, sent } = build();
    await dispatch(CHAT, 'foo_123');
    expect(sent[0].text).toBe('⚠️ Acción no reconocida.');
  });
});

describe('callbacks — tip', () => {
  test('tip con juego válido → tip + Más opciones (trends/odds)', async () => {
    const { dispatch, sent, scoresGateway, cache } = build();
    cache.getGameById.mockResolvedValue({ homeCompetitor: { name: 'Brasil' }, awayCompetitor: { name: 'Chile' } });
    scoresGateway.formatTipForGame.mockResolvedValue('🎯 Tip: Brasil');
    await dispatch(CHAT, 'tip_555');
    expect(sent[0].text).toBe('🎯 Tip: Brasil');
    expect(sent[1].text).toBe('💡 Más opciones:');
    expect(sent[1].options.reply_markup.inline_keyboard[0].map((b) => b.callback_data)).toEqual(['trends_555', 'odds_555']);
  });

  test('tip sin datos del juego → mensaje de aviso', async () => {
    const { dispatch, sent, cache } = build();
    cache.getGameById.mockResolvedValue(null);
    await dispatch(CHAT, 'tip_555');
    expect(sent[0].text).toBe('⚠️ No pude obtener información de ese partido.');
  });
});

describe('callbacks — acciones de detalle', () => {
  test.each([
    ['trends', 'getTendenciasForGame', ['tip', 'odds']],
    ['odds', 'getOdds', ['tip', 'trends']],
    ['h2h', 'getH2H', ['previa', 'odds']],
    ['previa', 'getPrevia', ['lineup', 'h2h', 'odds']],
    ['lineup', 'getAlineacion', ['previa', 'odds']],
    ['stats', 'getStatsVivo', ['odds']],
  ])('%s → texto + Más opciones', async (action, method, expectedActions) => {
    const { dispatch, sent, scoresGateway } = build();
    scoresGateway[method].mockResolvedValue(`texto de ${action}`);
    await dispatch(CHAT, `${action}_777`);
    expect(scoresGateway[method]).toHaveBeenCalledWith('777');
    expect(sent[0].text).toBe(`texto de ${action}`);
    expect(sent[1].text).toBe('💡 Más opciones:');
    expect(sent[1].options.reply_markup.inline_keyboard[0].map((b) => b.callback_data))
      .toEqual(expectedActions.map((a) => `${a}_777`));
  });

  test('error del gateway → mensaje de error', async () => {
    const { dispatch, sent, scoresGateway } = build();
    scoresGateway.getOdds.mockRejectedValue(new Error('boom'));
    await dispatch(CHAT, 'odds_1');
    expect(sent[0].text).toBe('⚠️ Error al obtener cuotas.');
  });
});
