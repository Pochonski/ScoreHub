# Fase 10 — Limpieza final

**Estado:** ⏳ Pendiente
**Esfuerzo:** 2 h
**Riesgo:** Mínimo
**Bloquea deploy:** No
**PR:** `hardening/phase-10-cleanup`

## Objetivo

Eliminar archivos y código muerto identificado en la auditoría:
- Scripts de smoke redundantes con Jest.
- Script backfill que duplica migración 007.
- `.env.bak.*` files.
- Snapshots Jest obsoletos.

## Cambios

### 10.1 — Eliminar scripts redundantes

**Archivos a borrar:**
- `scripts/test-365-commands.js` — duplica `tests/telegramBot.commands.test.js`.
- `scripts/test-365-commands-integration.js` — idem.
- `scripts/backfill-athletes-canonical.js` — duplica `database/migrations/007_athletes_canonical.sql`.

**Verificación previa:**
```bash
grep -r "test-365-commands\|backfill-athletes-canonical" --include="*.js" --include="*.json" --include="*.md" .
```

Si hay referencias (CI, docs), actualizarlas antes de borrar.

**Esfuerzo:** 15 min.

### 10.2 — Mover scripts activos a `npm run`

**Archivos conservados:**
- `scripts/check-supabase-config.js` — diagnóstico.
- `scripts/activate-supabase-http.js` — idem.
- `scripts/simulate-bot.js` — seeder de DB.

**Cambio en `package.json`:**
```json
"scripts": {
  "start": "node telegramBot.js",
  "start:telegram": "node telegramBot.js",
  "admin": "node admin/server.js",
  "start:dashboard": "node dashboard/server/index.js",
  "start:sync": "pm2 startOrReload ecosystem.config.js --only scores365-sync",
  "deploy:sync": "git pull --ff-only && pm2 startOrReload ecosystem.config.js --only scores365-sync && pm2 save",
  "test": "jest",
  "test:dashboard": "cd dashboard/server && npm test",
  "check:supabase": "node scripts/check-supabase-config.js",
  "activate:supabase": "node scripts/activate-supabase-http.js",
  "seed:bot": "node scripts/simulate-bot.js"
}
```

**Esfuerzo:** 10 min.

### 10.3 — Eliminar `.env.bak.*`

**Archivo:** `.env.bak.1785973505`

**Verificación previa:**
```bash
grep -r "1785973505" --include="*" --exclude-dir=node_modules --exclude-dir=.git .
```

Si no hay referencias, eliminar. Si las hay (commits previos, docs), reemplazarlas por `.env.example`.

**Esfuerzo:** 5 min.

### 10.4 — Regenerar snapshots Jest obsoletos

**Archivos:** `tests/__snapshots__/*.snap`

**Cambio:** ejecutar `npx jest -u` después de los cambios de Fase 0–5 que puedan haber alterado output (formatters, presenters). Verificar diff antes de commitear.

**Esfuerzo:** 15 min.

### 10.5 — `.gitignore` defensive additions

**Archivo:** `.gitignore`

**Cambio:** agregar:
```
# Certs / keys
*.pem
*.key
*.p12
*.pfx

# Test coverage
coverage/
.nyc_output/

# Cache
.cache/
.parcel-cache/
.eslintcache
.stylelintcache
```

**Esfuerzo:** 5 min.

### 10.6 — Eliminar `legacy/README.md` referencias obsoletas

**Verificación:** leer `legacy/README.md` y `docs/architecture.md` por referencias a archivos eliminados.

**Esfuerzo:** 15 min.

## Criterios de aceptación

- [ ] `scripts/test-365-commands*.js` borrados.
- [ ] `scripts/backfill-athletes-canonical.js` borrado.
- [ ] `package.json` tiene `check:supabase`, `activate:supabase`, `seed:bot`.
- [ ] `.env.bak.1785973505` borrado.
- [ ] Snapshots Jest regenerados y commiteados.
- [ ] `.gitignore` extendido.
- [ ] CI verde.

## Rollback

`git revert` del commit. Sin impacto funcional — son archivos borrados.

## Archivos tocados

| Archivo | Acción |
|---|---|
| `scripts/test-365-commands.js` | borrar |
| `scripts/test-365-commands-integration.js` | borrar |
| `scripts/backfill-athletes-canonical.js` | borrar |
| `.env.bak.1785973505` | borrar |
| `package.json` | +3 scripts |
| `tests/__snapshots__/*.snap` | regenerar |
| `.gitignore` | +10 líneas |