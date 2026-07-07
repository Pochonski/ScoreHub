# Variables de entorno

El bot lee las variables de `.env` (local) o **App Service Configuration → Application Settings** (producción en Azure).

## Categorías

### 1. Bases de datos

#### Azure PostgreSQL Flexible Server (DB principal)
| Var | Ejemplo | Notas |
|---|---|---|
| `DB_HOST` | `botmundialista-pg-srv.postgres.database.azure.com` | FQDN del servidor Azure PostgreSQL |
| `DB_PORT` | `5432` | Puerto estándar PostgreSQL |
| `DB_USER` | `postgres` | Admin user del servidor |
| `DB_PASSWORD` | `xxxxx` | |
| `DB_NAME` | `botmundialista` | Nombre de la base de datos |
| `DB_SSL` | `true` | Requerido por Azure |

#### Azure Cosmos DB (DB secundaria - cache 365scores)
| Var | Ejemplo | Notas |
|---|---|---|
| `COSMOS_ENDPOINT` | `https://botmundialista-cosmos.documents.azure.com:443/` | |
| `COSMOS_DATABASE` | `scores365` | |
| `COSMOS_KEY` | (master key) | **Opcional** en Azure (usa Managed Identity); **requerido** en local |

> **Auth preferida:** Managed Identity (System Assigned) del Web App → `Cosmos DB Built-in Data Contributor` sobre `dbs/scores365`. No requiere `COSMOS_KEY`.

### 2. APIs externas

| Var | Servicio | Notas |
|---|---|---|
| `RAPIDAPI_KEY` | RapidAPI - Free Football Data | Legacy, no usado activamente |
| `RAPIDAPI_HOST` | `free-api-live-football-data.p.rapidapi.com` | Legacy |
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash | Para NLU y generación de respuestas |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Default |
| `TELEGRAM_BOT_TOKEN` | Telegram BotFather | Para el bot de Telegram |

### 3. 365scores (web API)

| Var | Default | Notas |
|---|---|---|
| `SCORES365_TIMEZONE` | `America/Costa_Rica` | Zona horaria del usuario |
| `SCORES365_USER_COUNTRY` | `153` | ID de Costa Rica en 365scores |
| `SCORES365_LANG` | `14` | 14 = español |
| `SCORES365_APP_TYPE` | `5` | 5 = web |
| `SCORES365_POLL_MS` | `25000` | Cada cuánto el `liveGamesPoller` hace requests |
| `SCORES365_COMPETITION_MUNDIAL` | `5930` | ID del Mundial 2026 en 365scores |
| `SCORES365_MIN_INTERVAL_MS` | `120` | Throttle mínimo entre llamadas HTTP |

### 4. Notificaciones live

| Var | Default | Notas |
|---|---|---|
| `ENABLE_LIVE_NOTIFIER` | `false` | Si `true`, el `telegramBot.js` registra el listener del notifier. **Default off** porque requiere partidos en vivo y suscriptores activos. |

### 5. Server y misc

| Var | Default | Notas |
|---|---|---|
| `PORT` | `8080` | Puerto HTTP del health server (Azure lo requiere) |
| `ADMIN_PORT` | `3001` | Puerto del panel admin |
| `WA_SESSION_DIR` | `.wwebjs_auth` | Directorio de sesión de WhatsApp Web |

---

## Configuración en Azure App Service

```powershell
# Setear todas las variables en bloque
$ht = @{
  COSMOS_ENDPOINT      = 'https://botmundialista-cosmos.documents.azure.com:443/'
  COSMOS_DATABASE      = 'scores365'
  SCORES365_TIMEZONE   = 'America/Costa_Rica'
  SCORES365_USER_COUNTRY= '153'
  SCORES365_LANG        = '14'
  SCORES365_APP_TYPE    = '5'
  SCORES365_POLL_MS     = '25000'
  SCORES365_COMPETITION_MUNDIAL = '5930'
  SCORES365_MIN_INTERVAL_MS = '120'
  ENABLE_LIVE_NOTIFIER  = 'false'
  TELEGRAM_BOT_TOKEN    = '<token>'
  GEMINI_API_KEY        = '<key>'
  DB_HOST               = 'botmundialista-pg-srv.postgres.database.azure.com'
  DB_PORT               = '5432'
  DB_USER               = 'postgres'
  DB_PASSWORD           = '<password>'
  DB_NAME               = 'botmundialista'
  DB_SSL                = 'true'
}
Set-AzWebApp -ResourceGroupName 'botmundialista-rg' -Name 'botmundialista' -AppSettings $ht

# Reiniciar para que tome efecto
Restart-AzWebApp -ResourceGroupName 'botmundialista-rg' -Name 'botmundialista'
```

---

## `.env.example` completo

```bash
# WhatsApp Session
WA_SESSION_DIR=.wwebjs_auth

# Database Azure PostgreSQL Flexible Server
DB_HOST=botmundialista-pg-srv.postgres.database.azure.com
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=botmundialista
DB_SSL=true

# Football API (Free API Live Football Data - RapidAPI) - legacy
RAPIDAPI_KEY=your-rapidapi-key
RAPIDAPI_HOST=free-api-live-football-data.p.rapidapi.com

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Gemini AI (Free tier - 1,500 requests/day)
GEMINI_API_KEY=your-gemini-key

# Server
ADMIN_PORT=3001
PORT=8080

# 365scores (webws.365scores.com)
SCORES365_TIMEZONE=America/Costa_Rica
SCORES365_USER_COUNTRY=153
SCORES365_LANG=14
SCORES365_APP_TYPE=5
SCORES365_POLL_MS=25000
SCORES365_COMPETITION_MUNDIAL=5930
SCORES365_MIN_INTERVAL_MS=120

# Azure Cosmos DB (Free tier, Central US, RG botmundialista-rg)
COSMOS_ENDPOINT=https://botmundialista-cosmos.documents.azure.com:443/
COSMOS_DATABASE=scores365
COSMOS_KEY=your-cosmos-key-or-empty-for-managed-identity

# Notificaciones live (goles, tarjetas, etc.)
ENABLE_LIVE_NOTIFIER=false
```

---

## Variables usadas en runtime

| Componente | Variables |
|---|---|
| `telegramBot.js` | TELEGRAM_BOT_TOKEN, COSMOS_*, SCORES365_*, GEMINI_API_KEY, DB_* |
| `bot.js` (WhatsApp) | DB_*, SCORES365_*, COSMOS_*, GEMINI_API_KEY |
| `services/scores365Service.js` | SCORES365_* |
| `services/footballApi.js` | RAPIDAPI_* |
| `services/geminiService.js` | GEMINI_API_KEY, GEMINI_MODEL |
| `services/liveGamesPoller.js` | SCORES365_*, COSMOS_* |
| `services/cosmosRefresh.js` | SCORES365_*, COSMOS_* |
| `services/telegramNotifier.js` | ENABLE_LIVE_NOTIFIER (gate) |
| `services/betEvaluator.js` | DB_*, COSMOS_* |
| `scripts/cosmos-bootstrap.js` | SCORES365_*, COSMOS_* |
| `scripts/test-365-mundial.js` | SCORES365_*, COSMOS_* |

---

## Costes estimados

| Servicio | Tier | Coste/mes |
|---|---|---|
| Azure App Service | Free | $0 |
| Azure Cosmos DB | Free | $0 (1000 RU/s, 25 GB) |
| Azure PostgreSQL Flexible Server | Burstable B1ms | ~$14.50/mes |
| Gemini 2.5 Flash | Free | $0 (~1,500 req/día) |
| 365scores (web) | — | $0 (público) |
| **TOTAL** | | **$0/mes** |

Si se excede el free tier:
- Cosmos autoscale 1000-10000 RU/s: ~$5-50/mes
- App Service Basic B1: ~$13/mes
- Gemini paid: ~$0.075/1M input tokens
