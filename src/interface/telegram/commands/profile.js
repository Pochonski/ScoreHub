/**
 * src/interface/telegram/commands/profile.js — Comandos de perfil/estado (Fase 7, Fase 3).
 *
 * /start, /cambiarusuario, /mialias, /yo, /reset, /mundial. Relocalizados
 * VERBATIM desde el switch de handleCommand.
 *
 * NOTA: el legacy registraba /cambiarnombre|/cambiarusuario como `case` EXACTO
 * del switch, así que `/cambiarusuario <nombre>` (con argumento) nunca entraba
 * al case — el setAlias quedaba muerto y el input caía a la ruta NLU. Se
 * preserva ese comportamiento (registro exacto, sin prefix): la rama setAlias
 * se mantiene por fidelidad pero es inalcanzable, igual que en el legacy.
 */

const { startText, mundialText } = require('../presenters/staticText');

function registerProfileCommands(router, { userStorage, pool, sendMessage }) {
  const aliasOf = (ctx) => userStorage.getAlias(ctx.userId) || ctx.userName || 'Usuario';

  router.register(['/start', '/inicio'], async (ctx) => {
    await sendMessage(ctx.chatId, startText(aliasOf(ctx)));
  });

  router.register(['/cambiarnombre', '/cambiarusuario'], async (ctx) => {
    const alias = aliasOf(ctx);
    const argNombre = ctx.text.replace(/^\/(cambiarnombre|cambiarusuario)(@\w+)?/i, '').trim();
    if (!argNombre) {
      await sendMessage(ctx.chatId,
        `✏️ *Cambiar nombre*\n\n` +
        `Uso: \`/cambiarusuario TuNombre\`\n\n` +
        `Tu apodo actual: *${alias}*\n` +
        `Máximo ${userStorage.MAX_LEN} caracteres.\n\n` +
        `Otros comandos: /mialias (ver) · /help (ayuda)`
      );
      return;
    }
    const r = await userStorage.setAlias(ctx.userId, argNombre);
    if (!r.ok) {
      await sendMessage(ctx.chatId, `⚠️ No pude cambiar tu nombre: ${r.reason}`);
    } else {
      const syncMsg = r.synced
        ? '✅ Guardado en Supabase'
        : '💾 Guardado localmente (Supabase no disponible)';
      await sendMessage(ctx.chatId,
        `✅ *Listo*\n\n` +
        `Tu nuevo apodo es: *${r.alias}*\n` +
        `${syncMsg}\n\n` +
        `A partir de ahora te saludaré como "${r.alias}".`
      );
    }
  });

  router.register(['/mialias'], async (ctx) => {
    const currentAlias = userStorage.getAlias(ctx.userId);
    if (currentAlias) {
      await sendMessage(ctx.chatId,
        `👤 *Tu apodo actual*\n\n` +
        `Apodo: *${currentAlias}*\n` +
        `ID de Telegram: \`${ctx.userId}\`\n\n` +
        `Para cambiarlo: \`/cambiarnombre NuevoNombre\``
      );
    } else {
      await sendMessage(ctx.chatId,
        `👤 Aún no tienes apodo personalizado.\n\n` +
        `Tu nombre actual es: *${ctx.userName || 'Usuario'}* (de Telegram)\n\n` +
        `Para crear uno: \`/cambiarnombre TuNombre\``
      );
    }
  });

  router.register(['/mundial'], async (ctx) => {
    await sendMessage(ctx.chatId, mundialText());
  });

  router.register(['/yo', '/perfil', '/profile'], async (ctx) => {
    try {
      const alias = userStorage.getAlias(ctx.userId);
      let followedCount = 0;
      let queryCount = 0;
      try {
        const f = await pool.query(
          `SELECT COUNT(*) FROM equipos_seguidos WHERE id_usuario = $1`,
          [ctx.userId]
        );
        followedCount = parseInt(f.rows[0]?.count || 0, 10);
        const h = await pool.query(
          `SELECT COUNT(*) FROM historial_consultas WHERE id_usuario = $1`,
          [ctx.userId]
        );
        queryCount = parseInt(h.rows[0]?.count || 0, 10);
      } catch (e) { /* DB opcional */ }
      await sendMessage(ctx.chatId,
        `👤 *TU PERFIL*\n\n` +
        `🏷  *Apodo:* ${alias || ctx.userName || 'Sin definir'}\n` +
        `🆔 *ID:* \`${ctx.userId}\`\n` +
        `⭐ *Equipos seguidos:* ${followedCount}\n` +
        `💬 *Consultas realizadas:* ${queryCount}\n\n` +
        `📋 *Comandos útiles:*\n` +
        `• /misfavoritos — Ver equipos seguidos\n` +
        `• /cambiarusuario [nombre] — Cambiar apodo\n` +
        `• /reset — Borrar todos mis datos`
      );
    } catch (e) {
      await sendMessage(ctx.chatId, '⚠️ No pude cargar tu perfil.');
    }
  });

  router.register(['/reset'], async (ctx) => {
    await sendMessage(ctx.chatId,
      `⚠️ *Borrar todos mis datos*\n\n` +
      `Esto eliminará:\n` +
      `• Tu apodo personalizado\n` +
      `• Todos los equipos que sigues\n` +
      `• Tu historial de consultas\n\n` +
      `Para confirmar, escribí: *BORRAR TODO*\n` +
      `Para cancelar, enviá cualquier otro mensaje.`);
    userStorage.markPendingReset(ctx.userId);
  });
}

module.exports = { registerProfileCommands };
