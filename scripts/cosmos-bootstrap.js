require('dotenv').config();

const api = require('../services/scores365Service');
const cosmos = require('../database/cosmos');
const state = require('../database/bootstrapState');

const MUNDIAL_ID = parseInt(process.env.SCORES365_COMPETITION_MUNDIAL || '5930', 10);

function now() { return new Date().toISOString(); }
function log(msg) { console.log(`[${now()}] ${msg}`); }
function pad(s, n) { s = String(s); return s.length < n ? s + ' '.repeat(n - s.length) : s; }

async function step(name, fn) {
  log(`▶ ${name}`);
  const start = Date.now();
  try {
    const res = await fn();
    const ms = Date.now() - start;
    log(`✔ ${name} (${ms} ms)`);
    return res;
  } catch (e) {
    log(`✘ ${name}: ${e.message}`);
    throw e;
  }
}

function ddmmyyyy(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function bootstrapCatalog() {
  const sports = await api.getSports();
  const sportsDocs = (sports.sports || []).map((s) => ({
    id: `sports-${s.id}`, entityType: 'sports', ...s,
  }));
  await cosmos.bulkInsert('catalog', sportsDocs);
  log(`  → ${sportsDocs.length} sports`);

  const countries = (sports.countries || []).map((c) => ({
    id: `countries-${c.id}`, entityType: 'countries', ...c,
  }));
  await cosmos.bulkInsert('catalog', countries);
  log(`  → ${countries.length} countries`);

  const featured = await api.getCompetitionsFeatured(1);
  const compsDocs = (featured.competitions || []).map((c) => ({
    id: `competitions-${c.id}`, entityType: 'competitions', ...c,
  }));
  await cosmos.bulkInsert('catalog', compsDocs);
  log(`  → ${compsDocs.length} competitions`);

  const top = await api.getTopCompetitors(60);
  const compDocs = (top.competitors || []).map((c) => ({
    id: `competitors-${c.id}`, entityType: 'competitors', ...c,
  }));
  await cosmos.bulkInsert('catalog', compDocs);
  log(`  → ${compDocs.length} competitors`);
  state.markCatalogDone();
  return { sportsCount: sportsDocs.length, countriesCount: countries.length, compsCount: compsDocs.length, teamsCount: compDocs.length };
}

async function bootstrapMundialStructure() {
  const comp = await api.getCompetition(MUNDIAL_ID);
  await cosmos.upsert('catalog', {
    id: `competitions-${MUNDIAL_ID}-detail`, entityType: 'competitions-detail', competitionId: MUNDIAL_ID, ...comp, _fetchedAt: now(),
  });
  log(`  → Mundial detail (id=${MUNDIAL_ID})`);

  const related = await api.getRelatedEntities(MUNDIAL_ID);
  await cosmos.bulkInsert('catalog', [{
    id: `relatedEntities-mundial-${MUNDIAL_ID}`,
    entityType: 'relatedEntities',
    competitionId: MUNDIAL_ID,
    ...related,
    _fetchedAt: now(),
  }]);
  log(`  → related entities`);

  const brackets = await api.getBrackets(MUNDIAL_ID);
  const r1 = await cosmos.upsert('brackets', {
    id: `${MUNDIAL_ID}`, competitionId: MUNDIAL_ID, ...brackets, _fetchedAt: now(),
  });
  log(`  → brackets (returned id=${r1?.id})`);
  const cB = await cosmos.count('brackets');
  log(`  → brackets verify: count=${cB}`);

  const history = await api.getCompetitionHistory(MUNDIAL_ID);
  const historyDocs = (history.table?.rows || []).map((row) => ({
    id: `${MUNDIAL_ID}-se${row.seasonNum}`,
    competitionId: MUNDIAL_ID,
    seasonNum: row.seasonNum,
    ...row,
    _fetchedAt: now(),
  }));
  await cosmos.bulkInsert('competition_history', historyDocs);
  log(`  → ${historyDocs.length} ediciones in history`);

  const tow = await api.getTeamOfWeek(MUNDIAL_ID);
  if (tow.teamOfTheWeek) {
    const key = tow.teamOfTheWeek.key || 'current';
    await cosmos.upsert('highlights', {
      id: `tow-${key}`, kind: 'team_of_week', competitionId: MUNDIAL_ID, ...tow, _fetchedAt: now(),
    });
    log(`  → team of the week (key=${key})`);
  }
  const fixtures = await api.getFixtures(MUNDIAL_ID);
  await cosmos.upsert('fixtures', {
    id: `${MUNDIAL_ID}-fixtures`, competitionId: MUNDIAL_ID, ...fixtures, _fetchedAt: now(),
  });
  log(`  → fixtures`);

  const outrights = await api.getOutrights(MUNDIAL_ID);
  await cosmos.upsert('odds_misc', {
    id: `outrights-${MUNDIAL_ID}`, kind: 'outrights', competitionId: MUNDIAL_ID, ...outrights, _fetchedAt: now(),
  });
  log(`  → outrights`);

  state.markMundialStructureDone();
}

async function bootstrapGames() {
  const docs = [];
  const startD = new Date('2026-06-11T00:00:00');
  const endD = new Date('2026-07-31T23:59:59');
  let cursor = new Date(startD);
  let attempts = 0;
  while (cursor <= endD) {
    const chunkEnd = addDays(cursor, 6);
    const cEnd = chunkEnd > endD ? endD : chunkEnd;
    let res;
    try {
      res = await api.getGamesAllScores(ddmmyyyy(cursor), ddmmyyyy(cEnd), 1, { onlyMajorGames: true, withTop: true, showOdds: true });
      attempts = 0;
    } catch (e) {
      attempts++;
      if (attempts > 3) throw e;
      log(`  ! chunk ${ddmmyyyy(cursor)}–${ddmmyyyy(cEnd)} falló (${e.status}), reintento ${attempts}/3`);
      await new Promise((r) => setTimeout(r, 5000 * attempts));
      continue;
    }
    for (const g of res.games || []) {
      if (g.competitionId === MUNDIAL_ID) {
        docs.push({
          id: String(g.id), competitionId: MUNDIAL_ID, ...g, _fetchedAt: now(),
        });
      }
    }
    cursor = addDays(cEnd, 1);
    await new Promise((r) => setTimeout(r, 200));
  }
  if (docs.length) await cosmos.bulkInsert('games', docs);
  log(`  → ${docs.length} Mundial games`);
  for (const d of docs) state.markGame(d.id);
  return docs;
}

async function bootstrapGameDetail(games) {
  let preCount = 0, h2hCount = 0, ovCount = 0, skipH2h = 0, skipOv = 0, skipPre = 0;
  const s = state.loadState();
  const cached = s.gameDetails.ids || {};
  const cachedMembers = s.athletes.memberIdsByGame || {};
  const FRESH_MS = 6 * 60 * 60 * 1000;
  const nowTs = Date.now();
  const newMembers = {};
  const pendingFetch = [];
  for (const g of games) {
    const gameId = g.id;
    const fetchedAt = cached[gameId];
    const isFresh = fetchedAt && (nowTs - new Date(fetchedAt).getTime()) < FRESH_MS;
    if (!isFresh || !cachedMembers[gameId]) {
      pendingFetch.push({ game: g, isFresh, hasCachedMembers: !!cachedMembers[gameId] });
    } else {
      skipH2h++;
      skipOv++;
    }
  }

  log(`  · ${pendingFetch.length} juegos pendientes (de ${games.length})`);

  for (const item of pendingFetch) {
    const g = item.game;
    const gameId = g.id;
    const matchupId = `${g.homeCompetitor?.id || 0}-${g.awayCompetitor?.id || 0}-${MUNDIAL_ID}`;
    try {
      const h2h = await api.getGameH2H(gameId, matchupId, true);
      await cosmos.upsert('game_h2h', {
        id: String(gameId), gameId: Number(gameId), matchupId, ...h2h, _fetchedAt: now(),
      });
      h2hCount++;
      state.markGameDetail(gameId, now());
    } catch (e) { log(`    ! h2h ${gameId}: ${e.message?.substring(0, 100)}`); }
    await new Promise((r) => setTimeout(r, 50));
  }

  for (const item of pendingFetch) {
    const g = item.game;
    const gameId = g.id;
    const matchupId = `${g.homeCompetitor?.id || 0}-${g.awayCompetitor?.id || 0}-${MUNDIAL_ID}`;
    if (item.isFresh && item.hasCachedMembers) continue;
    try {
      const overview = await api.getGameOverview(gameId, matchupId);
      const idOv = `${gameId}-${overview.lastUpdateId || 0}`;
      const r = await cosmos.upsert('game_overviews', {
        id: idOv,
        gameId: Number(gameId), lastUpdateId: overview.lastUpdateId, ...overview, _fetchedAt: now(),
      });
      if (r && r.id) {
        ovCount++;
        if (!item.hasCachedMembers) {
          const members = overview?.members || overview?.game?.members || [];
          newMembers[gameId] = members.map((m) => m.athleteId).filter((id) => id && id > 0);
        }
      }
    } catch (e) { log(`    ! ov ${gameId}: ${e.message?.substring(0, 100)}`); }
    await new Promise((r) => setTimeout(r, 50));
  }

  const pendingPre = pendingFetch.filter((it) => it.game.statusGroup === 2 && !it.isFresh);
  for (const item of pendingPre) {
    const gameId = item.game.id;
    try {
      const pre = await api.getGamePreStats(gameId);
      await cosmos.upsert('game_pre_stats', {
        id: String(gameId), gameId: Number(gameId), ...pre, _fetchedAt: now(),
      });
      preCount++;
      state.markPreStat(gameId);
    } catch (e) { log(`    ! pre ${gameId}: ${e.message?.substring(0, 100)}`); }
    await new Promise((r) => setTimeout(r, 50));
  }

  if (Object.keys(newMembers).length > 0) {
    const s2 = state.loadState();
    Object.assign(s2.athletes.memberIdsByGame, newMembers);
    state.saveState();
  }
  log(`  → ${ovCount} overviews, ${h2hCount} h2h, ${preCount} preStats (skipped: h2h=${skipH2h}, ov=${skipOv}, pre=${skipPre})`);
}

async function bootstrapStats() {
  const stand = await api.getStandings(MUNDIAL_ID, 1, 25);
  await cosmos.upsert('standings', {
    id: `${MUNDIAL_ID}-s1-se25`, competitionId: MUNDIAL_ID, stageNum: 1, seasonNum: 25, ...stand, _fetchedAt: now(),
  });
  log(`  → standings phase de grupos`);
  state.markStandingsDone();

  const tStats = await api.getTournamentStats(MUNDIAL_ID, 25);
  if (tStats.stats) {
    const docs = Object.entries(tStats.stats).map(([statKey, payload]) => ({
      id: `${MUNDIAL_ID}-se25-${statKey}`,
      competitionId: MUNDIAL_ID, seasonNum: 25, statKey: String(statKey), payload, _fetchedAt: now(),
    }));
    await cosmos.bulkInsert('tournament_stats', docs);
    log(`  → ${docs.length} tournament stat blocks (${docs.map((d) => d.statKey).join(', ')})`);
    for (const d of docs) state.markTournamentStat(d.statKey);
  }

  const news = await api.getNews('competition', MUNDIAL_ID);
  if (news.news) {
    const docs = news.news.map((n) => {
      const { id: _ni, ...nRest } = n;
      return { ...nRest, id: `comp-${n.id}`, scope: 'competition', competitionId: MUNDIAL_ID, _fetchedAt: now() };
    });
    await cosmos.bulkInsert('news', docs);
    log(`  → ${docs.length} Mundial news`);
    for (const d of docs) state.markNews('competition', String(d.id).replace('comp-', ''));
  }

  const trendsTop = await api.getTrends('competition', MUNDIAL_ID);
  if (trendsTop.trends) {
    const docs = trendsTop.trends.map((t) => {
      const { id: _ti, ...tRest } = t;
      return { ...tRest, id: `comp-${MUNDIAL_ID}-${t.id}`, scope: 'competition', competitionId: MUNDIAL_ID, _fetchedAt: now() };
    });
    await cosmos.bulkInsert('trends', docs);
    log(`  → ${docs.length} top Mundial trends`);
    for (const d of docs) state.markTrend('competition', String(d.id).split('-').pop());
  }

  const predictions = await api.getPredictions(1, '');
  if (predictions.games) {
    const docs = predictions.games
      .filter((g) => g.competitionId === MUNDIAL_ID)
      .map((g) => ({
        id: String(g.id), gameId: Number(g.id), ...g, _fetchedAt: now(),
      }));
    await cosmos.bulkInsert('predictions', docs);
    log(`  → ${docs.length} Mundial predictions`);
    for (const d of docs) state.markPrediction(d.id);
  }
}

async function bootstrapAthletes(games) {
  const athleteIds = new Set();
  for (const g of games) {
    let memberIds = state.getGameMembers(g.id);
    if (!memberIds) {
      try {
        const overview = await cosmos.queryOne('game_overviews', { query: 'SELECT TOP 1 c.members, c.game FROM c WHERE c.gameId = @gid ORDER BY c._ts DESC', parameters: [{ name: '@gid', value: Number(g.id) }] });
        const members = overview?.members || overview?.game?.members || [];
        memberIds = members.map((m) => m.athleteId).filter((id) => id && id > 0);
        state.setGameMembers(g.id, memberIds);
      } catch (_) { memberIds = []; }
    }
    for (const id of memberIds) athleteIds.add(Number(id));
  }
  log(`  → ${athleteIds.size} unique athletes across squads`);

  const s = state.loadState();
  const pending = [...athleteIds].filter((id) => !s.athletes.fetched.includes(String(id)));
  log(`  → ya ingestados (state): ${athleteIds.size - pending.length}, pendientes: ${pending.length}`);

  if (!pending.length) {
    log(`  ✔ 0 atletas nuevos (${athleteIds.size}/${athleteIds.size} total)`);
    return;
  }

  let count = 0;
  const concurrency = 3;
  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);
    await Promise.all(batch.map(async (id) => {
      try {
        const data = await api.getAthlete(id, true);
        const a = data.athletes?.[0];
        if (!a) return;
        const { id: _ignored, ...aRest } = a;
        await cosmos.upsert('athletes', { id: String(id), ...aRest, _fetchedAt: now() });

        const trophies = a.trophies;
        if (trophies) {
          const { id: _ti, ...tRest } = trophies;
          await cosmos.upsert('athlete_trophies', { id: String(id), athleteId: id, ...tRest, _fetchedAt: now() });
        }
        const transfers = a.transfers;
        if (Array.isArray(transfers)) {
          const tdocs = transfers.map((t) => {
            const { id: _xi, ...tRest } = t;
            return { id: `${id}-${t.transferId}`, athleteId: id, ...tRest, _fetchedAt: now() };
          });
          if (tdocs.length) await cosmos.bulkInsert('athlete_transfers', tdocs);
        }
        const careers = a.careerStats?.seasons || [];
        const cdocs = careers.map((c) => {
          const { id: _ci, ...cRest } = c;
          return {
            id: `${id}-${c.key}`,
            athleteId: id,
            seasonKey: c.key,
            ...cRest,
            _fetchedAt: now(),
          };
        });
        if (cdocs.length) await cosmos.bulkInsert('athlete_careers', cdocs);

        const gamesRes = await api.getAthleteGames(id);
        if (gamesRes.games?.length) {
          const gdocs = gamesRes.games.map((g) => ({
            id: `${id}-${g.gameId || g.id}`, athleteId: id, ...g, _fetchedAt: now(),
          }));
          await cosmos.bulkInsert('athlete_games', gdocs);
        }

        const chartRes = await api.getAthleteChartEvents(id);
        if (chartRes) {
          const { id: _ci, ...cRest } = chartRes;
          await cosmos.upsert('athlete_chart_events', {
            id: String(id), athleteId: id, ...cRest, _fetchedAt: now(),
          });
        }

        state.markAthleteFetched(id);
        count++;
      } catch (e) {
        log(`  ! athlete ${id} falló: ${e.message?.substring(0, 80)}`);
        state.markAthleteFailed(id);
      }
    }));
    if ((i / concurrency) % 10 === 0) log(`  … ${i + batch.length}/${pending.length} atletas`);
    await new Promise((r) => setTimeout(r, 100));
  }
  log(`  ✔ ${count} atletas nuevos (${athleteIds.size - pending.length + count}/${athleteIds.size} total)`);
}

async function generateBettingTips(games) {
  const s = state.loadState();
  const pending = games.filter((g) => !s.bettingTips.ids.includes(String(g.id)));
  log(`  → ${pending.length} partidos pendientes de tip (de ${games.length} total)`);

  let tipCount = 0, trendCount = 0;
  for (const g of pending) {
    try {
      const trendsRes = await api.getTrends('game', g.id);
      const trends = trendsRes.trends || [];
      if (!trends.length) {
        state.markBettingTip(g.id);
        continue;
      }
      if (trends.length) {
        const trendDocs = trends.map((trend) => {
          const { id: _ti, ...trendRest } = trend;
          return {
            ...trendRest,
            id: `game-${g.id}-${trend.id}`,
            scope: 'game',
            gameId: Number(g.id),
            competitionId: MUNDIAL_ID,
            _fetchedAt: now(),
          };
        });
        const inserted = await cosmos.bulkInsert('trends', trendDocs);
        const ok = inserted.filter((r) => r.statusCode === 200 || r.statusCode === 201);
        trendCount += ok.length;
        for (const d of trendDocs) state.markTrend('game', String(d.id));
      }
      const sorted = trends.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
      const top = sorted.slice(0, 5);
      const confidence = top.reduce((s, t) => s + (t.percentage || 0), 0) / top.length;

      await cosmos.upsert('betting_tips', {
        id: `${g.id}-composite`,
        gameId: Number(g.id),
        tipType: 'composite',
        confidenceScore: Number(confidence.toFixed(4)),
        generatedAt: now(),
        topTrends: top,
        allTrends: trends,
        _fetchedAt: now(),
      });
      state.markBettingTip(g.id);
      tipCount++;
    } catch (e) {
      log(`  ! tips game ${g.id}: ${e.message?.substring(0, 80)}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  log(`  ✔ ${tipCount} betting tips, ${trendCount} trends per-game`);
}

async function main() {
  const h = await cosmos.health();
  if (!h.ok) {
    log(`✘ Cosmos no disponible: ${h.error}`);
    process.exit(1);
  }
  log(`Cosmos OK → db=${h.database}`);
  const sum = state.summary();
  log(`State: lastRun=${sum.lastRun || 'never'}, games=${sum.games}, athletes=${sum.athletesFetched}, tips=${sum.bettingTips}`);

  const startSummary = Date.now();
  await step('Catálogo', bootstrapCatalog);
  await step('Estructura Mundial', bootstrapMundialStructure);
  const games = await step('Games', bootstrapGames);
  await step('Game details', () => bootstrapGameDetail(games));
  await step('Stats globales', bootstrapStats);
  await step('Atletas', () => bootstrapAthletes(games));
  await step('Betting tips', () => generateBettingTips(games));

  const totalSec = ((Date.now() - startSummary) / 1000).toFixed(1);
  log(`===== BOOTSTRAP COMPLETO (${totalSec}s) =====`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});