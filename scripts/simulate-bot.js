#!/usr/bin/env node
/**
 * scripts/simulate-bot.js — Fase 8.6 (Limitación B)
 *
 * Simula la actividad de un bot de Telegram real en la base de datos.
 * Útil para:
 *   1. Sembrar las tablas de bot (usuarios, equipos_seguidos,
 *      historial_consultas, apuestas, apuesta_selecciones,
 *      bet_followers_v2) con datos representativos.
 *   2. Verificar end-to-end que todos los flujos de escritura funcionan.
 *   3. Servir como documentación ejecutable de los flujos del bot.
 *
 * Idempotente: si los usuarios simulados ya existen, los limpia y los
 * recrea. Si las apuestas siguen, las borra en cascada.
 *
 * Uso:
 *   node scripts/simulate-bot.js                    # 5 usuarios por default
 *   node scripts/simulate-bot.js --users=20          # 20 usuarios
 *   SIMULATE_BOT_DRY_RUN=1 node scripts/simulate-bot.js   # Solo muestra SQL
 */

require('dotenv').config();
const { pool } = require('../database/connection');

// --- Configuración ---
const argv = process.argv.slice(2);
const USERS_COUNT = (() => {
  const arg = argv.find(a => a.startsWith('--users='));
  return arg ? parseInt(arg.split('=')[1], 10) : 5;
})();
const DRY_RUN = !!process.env.SIMULATE_BOT_DRY_RUN;

// --- Nombres realistas para usuarios simulados ---
const USER_ALIASES = [
  'FutboleroCR', 'TicoFan', 'ManchoUnited', 'DeportivoSanJose',
  'PuraVida10', 'Limonense', 'CartagoFc', 'Herediano1912',
  'Saprissa36', 'LigaMxFan', 'BarsaHastaMuerte', 'RealMadrid4ever',
  'ChelseaBlu', 'ArsenalGooner', 'LiverpoolYNWA', 'Mancity1894',
  'TottenhamID', 'JuventusFan', 'InterMilan3', 'ACMilan4',
];

// --- Queries simuladas (realistas para el bot de fútbol) ---
const QUERY_TEMPLATES = [
  { tipo: 'comando', consulta: '/live', respuesta: 'Partidos en vivo' },
  { tipo: 'comando', consulta: '/fixture', respuesta: 'Próximos partidos' },
  { tipo: 'comando', consulta: '/tabla Premier League', respuesta: 'Tabla de posiciones' },
  { tipo: 'comando', consulta: '/goleadores', respuesta: 'Top goleadores' },
  { tipo: 'comando', consulta: '/predicciones 4764884', respuesta: 'Manchester City vs Inter' },
  { tipo: 'comando', consulta: '/noticias', respuesta: 'Últimas noticias' },
  { tipo: 'comando', consulta: '/alineacion 4764884', respuesta: 'Alineaciones' },
  { tipo: 'comando', consulta: '/racha Manchester City', respuesta: 'Últimos 5 partidos' },
  { tipo: 'comando', consulta: '/info Manchester City', respuesta: 'Información del equipo' },
  { tipo: 'comando', consulta: '/proximos Barcelona', respuesta: 'Próximos partidos' },
  { tipo: 'comando', consulta: '/manana', respuesta: 'Partidos de mañana' },
  { tipo: 'comando', consulta: '/tabla Bundesliga', respuesta: 'Tabla Bundesliga' },
  { tipo: 'comando', consulta: '/seguir Real Madrid', respuesta: 'Siguiendo a Real Madrid' },
  { tipo: 'comando', consulta: '/odds 4764884', respuesta: 'Cuotas del partido' },
  { tipo: 'comando', consulta: '/h2h 4764884', respuesta: 'Enfrentamientos directos' },
];

// --- Tipos de apuesta (mercado) ---
const BET_MARKETS = [
  { tipo: '1X2', valors: ['1', 'X', '2'] },
  { tipo: 'Total Goles', valors: ['Más 2.5', 'Menos 2.5'] },
  { tipo: 'Ambos Marcan', valors: ['Sí', 'No'] },
  { tipo: 'Doble Oportunidad', valors: ['1X', '12', 'X2'] },
  { tipo: 'Resultado Exacto', valors: ['1-0', '2-1', '1-1', '2-0'] },
];

// --- Generador de IDs tipo Telegram (positivos, hasta 10 dígitos) ---
function generateTelegramUserId() {
  // IDs de Telegram tienen entre 6-10 dígitos y son positivos
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

function generateChatId() {
  // Mismo formato que userId para chat_id
  return generateTelegramUserId();
}

// --- Helpers de DB ---
async function queryAll(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

async function execute(sql, params = [], { returning = false } = {}) {
  if (DRY_RUN) {
    console.log(`[DRY] ${sql.slice(0, 80)}... | params: ${JSON.stringify(params).slice(0, 60)}`);
    // En dry-run para INSERT con RETURNING, simular un id ficticio.
    if (returning && /INSERT.*RETURNING/i.test(sql)) {
      return { rows: [{ id: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  return pool.query(sql, params);
}

// --- Lógica principal ---
async function main() {
  console.log(`\n=== SIMULATE BOT — Fase 8.6 ===`);
  console.log(`Usuarios a simular: ${USERS_COUNT}`);
  if (DRY_RUN) console.log('Modo: DRY RUN (no escritura)');
  console.log('');

  // 1. Obtener equipos reales para popular equipos_seguidos y apuestas
  const competitors = await queryAll(
    'SELECT id, name FROM competitors ORDER BY id LIMIT 50'
  );
  if (competitors.length < 5) {
    console.error('Necesitamos al menos 5 competidores en la DB. Ejecuta syncCatalog primero.');
    process.exit(1);
  }
  const games = await queryAll(
    `SELECT id, home_competitor_id, away_competitor_id 
     FROM games WHERE status_group IN (1, 2, 4) 
     ORDER BY start_time DESC LIMIT 30`
  );
  if (games.length < 5) {
    console.error('Necesitamos games en la DB para simular apuestas.');
    process.exit(1);
  }
  console.log(`Competidores disponibles: ${competitors.length}`);
  console.log(`Games disponibles: ${games.length}`);
  console.log('');

  // 2. Cleanup: borrar simulaciones previas (idempotencia)
  console.log('[1/5] Limpiando simulaciones previas...');
  const simUsers = await queryAll(
    `SELECT id FROM usuarios WHERE alias LIKE 'sim_%'`
  );
  const simUserIds = simUsers.map(u => u.id);
  if (simUserIds.length) {
    // FK cascade se encarga de equipos_seguidos, historial, apuestas, etc.
    await execute(
      `DELETE FROM usuarios WHERE id = ANY($1::text[])`,
      [simUserIds]
    );
    console.log(`  - Borrados ${simUserIds.length} usuarios previos`);
  } else {
    console.log('  - No hay simulaciones previas');
  }

  // 3. Crear usuarios simulados
  console.log('\n[2/5] Creando usuarios simulados...');
  const userIds = [];
  for (let i = 0; i < USERS_COUNT; i++) {
    const alias = USER_ALIASES[i % USER_ALIASES.length];
    const userId = generateTelegramUserId();
    userIds.push(userId);
    await execute(
      `INSERT INTO usuarios (id, alias, fecha_registro, estado)
       VALUES ($1, $2, now() - (random() * interval '90 days'), 'registrado')`,
      [userId, `sim_${alias}_${userId.slice(-4)}`]
    );
  }
  console.log(`  - ${userIds.length} usuarios creados`);

  // 4. Cada usuario sigue 2-4 equipos y tiene historial de queries
  console.log('\n[3/5] Generando equipos_seguidos + historial_consultas...');
  let totalSeguidos = 0;
  let totalConsultas = 0;
  for (const userId of userIds) {
    // Seguir 2-4 equipos aleatorios
    const teamCount = 2 + Math.floor(Math.random() * 3);
    const shuffled = [...competitors].sort(() => Math.random() - 0.5).slice(0, teamCount);
    for (const team of shuffled) {
      await execute(
        `INSERT INTO equipos_seguidos (id_usuario, id_equipo, nombre_equipo, fecha_seguimiento)
         VALUES ($1, $2, $3, now() - (random() * interval '60 days'))`,
        [userId, team.id, team.name]
      );
      totalSeguidos++;
    }

    // 5-20 consultas por usuario
    const queryCount = 5 + Math.floor(Math.random() * 16);
    for (let q = 0; q < queryCount; q++) {
      const template = QUERY_TEMPLATES[Math.floor(Math.random() * QUERY_TEMPLATES.length)];
      // Reemplazar placeholders de gameId con uno real
      const consulta = template.consulta.replace(/4764884/g, () => {
        const g = games[Math.floor(Math.random() * games.length)];
        return g.id;
      });
      await execute(
        `INSERT INTO historial_consultas (id_usuario, consulta, tipo, respuesta, fecha)
         VALUES ($1, $2, $3, $4, now() - (random() * interval '30 days'))`,
        [userId, consulta, template.tipo, template.respuesta]
      );
      totalConsultas++;
    }
  }
  console.log(`  - ${totalSeguidos} equipos_seguidos`);
  console.log(`  - ${totalConsultas} historial_consultas`);

  // 5. Crear apuestas y seguidores
  console.log('\n[4/5] Creando apuestas + selecciones + seguidores...');
  let totalApuestas = 0;
  let totalSelecciones = 0;
  let totalFollowers = 0;
  for (const userId of userIds) {
    // 0-2 apuestas por usuario
    const betCount = Math.floor(Math.random() * 3);
    for (let b = 0; b < betCount; b++) {
      const game = games[Math.floor(Math.random() * games.length)];
      const homeTeam = competitors.find(c => c.id === game.home_competitor_id)?.name || 'Local';
      const awayTeam = competitors.find(c => c.id === game.away_competitor_id)?.name || 'Visitante';
      const fechaCreacion = new Date(Date.now() - Math.random() * 30 * 86400000).toISOString();
      const fechaPartido = new Date(Date.now() + Math.random() * 7 * 86400000).toISOString();
      const betResult = await execute(
        `INSERT INTO apuestas (id_usuario, id_partido_api, partido_extrado,
                              partido_normalizado, marcador_local, marcador_visitante,
                              fecha_creacion, fecha_partido, estado, confianza_ocr, resultado_final)
         VALUES ($1, $2, $3, $4,
                 floor(random() * 4)::int, floor(random() * 4)::int,
                 $5, $6,
                 CASE WHEN random() < 0.3 THEN 'cerrada' ELSE 'abierta' END,
                 0.85 + random() * 0.15,
                 CASE WHEN random() < 0.5 THEN 'pendiente' ELSE NULL END)
         RETURNING id`,
        [userId, game.id, `${homeTeam} vs ${awayTeam}`,
         `${homeTeam}-${awayTeam}`.toLowerCase(),
         fechaCreacion, fechaPartido],
        { returning: true }
      );
      const betId = betResult.rows[0]?.id;
      if (!betId) continue;
      totalApuestas++;

      // 2-3 selecciones por apuesta
      const selCount = 2 + Math.floor(Math.random() * 2);
      const markets = [...BET_MARKETS].sort(() => Math.random() - 0.5).slice(0, selCount);
      for (const market of markets) {
        const valor = market.valors[Math.floor(Math.random() * market.valors.length)];
        await execute(
          `INSERT INTO apuesta_selecciones (id_apuesta, tipo_mercado, valor_seleccion, linea, estado)
           VALUES ($1, $2, $3, $4, 'pendiente')`,
          [betId, market.tipo, valor, market.tipo === 'Total Goles' ? 2.5 : null]
        );
        totalSelecciones++;
      }

      // Algunos usuarios siguen esta apuesta (1-3 seguidores)
      const otherUsers = userIds.filter(u => u !== userId);
      const followerCount = Math.min(otherUsers.length, 1 + Math.floor(Math.random() * 3));
      const followers = [...otherUsers].sort(() => Math.random() - 0.5).slice(0, followerCount);
      for (const follower of followers) {
        await execute(
          `INSERT INTO bet_followers_v2 (apuesta_id, chat_id, mode, created_at, updated_at)
           VALUES ($1, $2, $3, now() - (random() * interval '15 days'), now())`,
          [betId, follower, Math.random() < 0.5 ? 'all_events' : 'outcome_only']
        );
        totalFollowers++;
      }
    }
  }
  console.log(`  - ${totalApuestas} apuestas`);
  console.log(`  - ${totalSelecciones} apuesta_selecciones`);
  console.log(`  - ${totalFollowers} bet_followers_v2`);

  // 6. Resumen final
  console.log('\n[5/5] Resumen final...');
  if (DRY_RUN) {
    console.log('DRY RUN — no se hicieron cambios');
  } else {
    const stats = {
      usuarios: (await queryAll('SELECT count(*) FROM usuarios WHERE alias LIKE \'sim_%\''))[0].count,
      equipos_seguidos: (await queryAll('SELECT count(*) FROM equipos_seguidos es JOIN usuarios u ON es.id_usuario = u.id WHERE u.alias LIKE \'sim_%\''))[0].count,
      historial_consultas: (await queryAll('SELECT count(*) FROM historial_consultas hc JOIN usuarios u ON hc.id_usuario = u.id WHERE u.alias LIKE \'sim_%\''))[0].count,
      apuestas: (await queryAll('SELECT count(*) FROM apuestas a JOIN usuarios u ON a.id_usuario = u.id WHERE u.alias LIKE \'sim_%\''))[0].count,
      apuesta_selecciones: (await queryAll('SELECT count(*) FROM apuesta_selecciones s JOIN apuestas a ON s.id_apuesta = a.id JOIN usuarios u ON a.id_usuario = u.id WHERE u.alias LIKE \'sim_%\''))[0].count,
      bet_followers_v2: (await queryAll('SELECT count(*) FROM bet_followers_v2 bf JOIN apuestas a ON bf.apuesta_id = a.id JOIN usuarios u ON a.id_usuario = u.id WHERE u.alias LIKE \'sim_%\''))[0].count,
    };
    console.log('Tablas pobladas (filtradas por sim_*):');
    for (const [table, count] of Object.entries(stats)) {
      console.log(`  - ${table}: ${count}`);
    }
  }
  console.log('\n=== SIMULACIÓN COMPLETADA ===');
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});