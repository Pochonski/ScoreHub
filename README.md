# BotMundialista 🤖⚽

**Tu asistente personal de fútbol y apuestas deportivas por WhatsApp**

---

## ¿Qué es BotMundialista?

BotMundialista es un bot de WhatsApp inteligente que combina información deportiva en tiempo real con un sistema completo de seguimiento de apuestas deportivas. Diseñado para aficionados al fútbol que quieren estar informados y hacer seguimiento de sus apuestas de forma automática.

### Características Principales

**📊 Información de Fútbol**

- Resultados en vivo y pasados de cualquier equipo
- Estadísticas detalladas de equipos y jugadores
- Análisis de enfrentamientos históricos
- Tablas de posiciones de múltiples ligas
- Información de todos los equipos del Mundial 2026

**🎰 Seguimiento de Apuestas**

- Envía una captura de pantalla de tu apuesta y el bot la procesa automáticamente
- Utiliza OCR para extraer datos de imágenes de Bet365, Betway, y otras casas de apuestas
- Normaliza mercados: Over/Under, Corners, Tarjetas, Resultado Final, Ambos Marcan, Handicaps
- Monitoreo en tiempo real cada 60 segundos
- Notificaciones automáticas cuando se cumplen o fallan tus selecciones

**🇺🇸 Banderas de Países**

- El bot muestra automáticamente la bandera del país junto al nombre de cada equipo
- Notificaciones más visuales y fáciles de identificar

---

## ¿Cómo Funciona?

### 1. Registro Rápido

Cuando envías tu primer mensaje, el bot te pide crear un alias personalizado:

```
¡Hola! 👋 Soy BotMundialista, tu asistente de fútbol.
¿Cómo quieres que te llame? Escribe tu alias:
```

### 2. Consulta Resultados

Pregunta por el resultado de cualquier partido:

```
📩 "¿Cómo quedó Brasil?"
📩 "México vs Argentina"
```

### 3. Analiza Partidos

Obtén análisis detallados de enfrentamientos:

```
📩 "Analiza Brasil vs Francia"
📩 "Estadísticas de España"
```

### 4. Sigue Equipos

Recibe actualizaciones de tus equipos favoritos:

```
📩 "Seguir Brasil"
📩 "Mis equipos"
```

### 5. Apuestas con Imágenes 📸

Esta es la función más poderosa. Envía una captura de pantalla de tu apuesta y el bot:

1. **Analiza la imagen** usando OCR (reconocimiento óptico de caracteres)
2. **Extrae los datos** del partido y las selecciones
3. **Busca el partido** en la API de fútbol para verificar
4. **Guarda la apuesta** en la base de datos
5. **Monitorea en tiempo real** cada 60 segundos
6. **Notifica** cuando se cumplen o fallan las selecciones

---

## Tipos de Mercados Soportados

El normalizador reconoce automáticamente estos tipos de apuestas:

| Tipo                | Ejemplos                                           |
| ------------------- | -------------------------------------------------- |
| **Goles**           | Over 2.5, Under 3, Más de 2, Menos de 3.5          |
| **Corners**         | Over 5 corners, Under 10 corners, Más de 7 córners |
| **Tarjetas**        | Over 3.5 tarjetas, Under 5 cards                   |
| **Ambos Marcan**    | Both Teams To Score (BTTS), Ambos marcan           |
| **Resultado Final** | Gana Brasil, Local, Visitante, Empate              |
| **Handicaps**       | Handicap -1, Handicap +2                           |
| **Tiros**           | Shots on target Over/Under                         |
| **Posesión**        | Over 55% posesión                                  |

---

## Notificaciones Personalizadas

El bot tiene personalidad propia y envía notificaciones entusiastas:

**🎉 ¡Selección Cumplida!**

```
📐 ¡¡¡ Increíble! 🔥 !!!

📋 Tu selección: Over 5 corners
📏 Línea: 5

✅ ¡CUMPLIDA!
```

**⚽ ¡GOOOL!**

```
⚽ ¡¡¡ GOOOOOOOL de 🇧🇷 Brasil !!!

⏱️ Minuto 45'
📊 Marcador: 2 - 1

🔥 ¡¡El partido está que arde!!
```

**❌ Selección Fallida**

```
📋 No fue esta vez...

📋 Tu selección: Over 2.5
📏 Línea: 2.5

❌ Fallida - ¡Pero viene la próxima! 💪
```

---

## Arquitectura del Proyecto

```
┌─────────────────────────────────────────────────────────┐
│                      WhatsApp                             │
│                   (whatsapp-web.js)                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   messageHandler.js                       │
│              Router principal de mensajes                  │
└──────────┬──────────────────────────────────┬───────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────────┐
│   matchHandler.js   │          │   betImageHandler.js   │
│   Partidos/Resultados│          │   Procesamiento OCR     │
└─────────────────────┘          └───────────┬─────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────────┐
│    footballApi.js   │          │    betTrackingEngine    │
│   API SportAPI7     │          │   Monitoreo en tiempo   │
└─────────────────────┘          └───────────┬─────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────┐
│               notificationService.js                      │
│         Notificaciones WhatsApp con personalidad         │
└─────────────────────────────────────────────────────────┘
```

---

## Estructura de Archivos

```
BotMundialista/
├── bot.js                      # Punto de entrada principal
├── admin/
│   ├── server.js               # Servidor Express (panel admin)
│   └── public/                 # Frontend del panel admin
│       ├── index.html
│       └── images/             # Imágenes de apuestas guardadas
├── database/
│   ├── connection.js           # Conexión Supabase PostgreSQL
│   └── schema.sql             # Schema completo de BD
├── handlers/
│   ├── messageHandler.js       # Router principal de mensajes
│   ├── matchHandler.js         # Resultados y partidos
│   ├── teamHandler.js          # Info y seguimiento de equipos
│   ├── statsHandler.js         # Estadísticas
│   ├── bettingHandler.js        # Análisis de apuestas
│   ├── tableHandler.js         # Tablas de posiciones
│   ├── queryParser.js          # NLP para detectar intents
│   ├── betImageHandler.js      # Procesamiento de imágenes OCR
│   └── summaryHandler.js       # Resúmenes inteligentes
├── services/
│   ├── footballApi.js          # Cliente API SportAPI7
│   ├── betTrackingEngine.js    # Motor de monitoreo 60s
│   ├── notificationService.js  # Envío de notificaciones WA
│   ├── marketNormalizer.js     # Normaliza mercados de apuestas
│   ├── betParserService.js    # Parser OCR → JSON
│   ├── ocrService.js          # Wrapper Tesseract.js
│   ├── countryFlagsService.js  # Banderas de países
│   ├── imageStorageService.js # Almacenamiento de imágenes
│   └── cacheService.js        # Cache en memoria con TTL
├── utils/
│   ├── constants.js           # Constantes y mappings
│   └── formatters.js          # Formateadores de respuesta
└── node_modules/
```

---

## Tecnologías Utilizadas

| Categoría         | Tecnología            | Propósito                           |
| ----------------- | --------------------- | ----------------------------------- |
| **WhatsApp**      | whatsapp-web.js       | Conexión a WhatsApp Web             |
| **OCR**           | Tesseract.js          | Reconocimiento de texto en imágenes |
| **Base de Datos** | Supabase (PostgreSQL) | Persistencia de datos               |
| **API Fútbol**    | SportAPI7 (RapidAPI)  | Datos de partidos y estadísticas    |
| **Servidor**      | Express.js            | Panel administrativo                |
| **Programación**  | Node.js               | Runtime JavaScript                  |
| **Scheduling**    | node-cron             | Tareas programadas cada 60s         |

---

## Requisitos Previos

- **Node.js** 18+ instalado
- **WhatsApp** activo para escanear QR
- **Supabase** cuenta (o PostgreSQL local)
- **RapidAPI** key para SportAPI7
- **npm/pnpm** como gestor de paquetes

---

## Instalación

1. **Clonar el repositorio**

```bash
git clone <repo-url>
cd BotMundialista
```

2. **Instalar dependencias**

```bash
pnpm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. **Configurar base de datos**

```bash
# Ejecutar schema en Supabase o PostgreSQL
psql -h your-host -U postgres -d your-db -f database/schema.sql
```

5. **Iniciar el bot**

```bash
node bot.js
```

6. **Escanear QR** con WhatsApp

7. **Iniciar panel admin** (opcional, en otra terminal)

```bash
node admin/server.js
```

---

## Variables de Entorno

```env
# WhatsApp Session
WA_SESSION_DIR=.wwebjs_auth

# Base de Datos (Supabase)
DB_HOST=db.your-project.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=postgres
DB_SSL=true

# API Fútbol (RapidAPI)
RAPIDAPI_KEY=your-api-key
RAPIDAPI_HOST=sportapi7.p.rapidapi.com

# Servidor Admin
ADMIN_PORT=3001
```

---

## Panel Administrativo

El bot incluye un panel web para administrators en `http://localhost:3001`:

- 📊 Estadísticas generales (usuarios, consultas, equipos seguidos)
- 👥 Lista de usuarios registrados
- 📝 Historial de consultas
- 🏆 Equipos más seguidos
- 📈 Consultas por tipo de intent

---

## Workflow de una Apuesta

```
1. Usuario envía captura de pantalla por WhatsApp

2. messageHandler detecta que es una imagen
   └── betImageHandler.procesarImagenApuesta()

3. OCR extrae texto con Tesseract.js
   └── ocrService.procesarImagen()

4. Parser normaliza los datos
   └── betParserService.parseBetText()
   └── marketNormalizer.normalizarMercado()

5. Se busca el partido en la API
   └── footballApi.buscarPartidoReal()

6. Se guarda en base de datos
   └── INSERT apuestas, apuesta_selecciones

7. Si el partido existe, se inicia monitoreo
   └── betTrackingEngine.iniciar(60)

8. Cada 60 segundos se evalúan las selecciones
   └── betTrackingEngine.cicloEvaluacion()
   └── evaluarSeleccion() para cada apuesta

9. Cuando cambia el estado, se notifica
   └── notificationService.notificarSeleccionCumplida()
   └── notificationService.notificarSeleccionFallida()

10. Al terminar el partido, todo se cierra
    └── cerrarApuesta()
```

---

## Consideraciones Importantes

### ⚠️ Limitaciones del OCR

- El reconocimiento de texto **no es 100% preciso**
- Imágenes borrosas o con poco contraste reducen la calidad
- Bet365 y otras casas pueden tener CAPTCHA que bloquean automatización
- La confianza OCR se guarda para mostrar al usuario

### ⚠️ Rate Limits

- **RapidAPI**: 100 requests/día en el plan gratuito de SportAPI7
- El cacheo inteligente minimiza llamadas a la API
- El modo demo funciona sin API externa

### ⚠️ Privacidad

- Los mensajes de usuarios **no se almacenan** (solo el alias y consultas)
- Los IDs de WhatsApp se ocultan en logs de producción
- El modo demo funciona completamente sin base de datos

---

## Comandos Disponibles

| Comando                    | Descripción                    |
| -------------------------- | ------------------------------ |
| `ayuda`                    | Muestra todos los comandos     |
| `¿Cómo quedó [equipo]?`    | Resultado del último partido   |
| `[equipo] vs [equipo]`     | Resultado de enfrentamiento    |
| `Analiza [eq1] vs [eq2]`   | Análisis detallado del partido |
| `Dame info de [equipo]`    | Información del equipo         |
| `Estadísticas de [equipo]` | Estadísticas completas         |
| `Seguir [equipo]`          | Agregar a favoritos            |
| `Mis equipos`              | Ver equipos seguidos           |
| `Tabla del Mundial`        | Clasificación del Mundial      |
| `Tabla de [liga]`          | Tabla de cualquier liga        |

---

## License

Este proyecto es para uso personal y educativo.

---

## Créditos

Desarrollado con 🤖 Claude (Anthropic) + ❤️ para el fútbol

---

**¿Preguntas o problemas?** Abre un issue en el repositorio.
 
 