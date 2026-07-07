# 00 — Visión General

## Propósito

Dashboard web premium para la **Copa Mundial FIFA 2026**. Un centro de comando visual que expone todos los datos del torneo — partidos en vivo, tabla de posiciones, estadísticas de jugadores, tendencias de apuestas, noticias e historia — en una superficie con identidad propia, diseñada para el hincha hispanohablante que quiere seguir el Mundial con la misma calidad visual que una transmisión televisiva.

## Audiencia

- Usuarios del bot de Telegram `@botmundialistabot` que quieren una experiencia visual
- Hinchas de fútbol latinoamericanos y españoles
- Seguidores de apuestas deportivas que consultan tips y tendencias

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS 3 + CSS Custom Properties |
| Backend API | Express.js (servidor independiente en nuevo dominio) |
| Fuente de datos | Azure Cosmos DB (25 containers, ~44,000 docs) + live fallback a 365scores API |
| CDN imágenes | `imagecache.365scores.com` (escudos, fotos, banderas) |
| Despliegue | Azure App Service (dominio separado del bot) |

## Principios de diseño

1. **Identidad propia** — No es un template. El palette navy + gold + sky blue, la tipografía Teko + Sora, y el lenguaje visual broadcast son elecciones deliberadas para este torneo.
2. **Data-first** — Cada elemento visual existe para comunicar un dato. Sin decoración gratuita.
3. **Premium desde el día 1** — Animaciones broadcast, skeleton loaders, responsive hasta mobile, foco de teclado, reduced motion.
4. **Orientado al rendimiento** — Carga rápida, refetch inteligente, code splitting por sección.
5. **Fases incrementales** — Fase 1: fundación + scaffold. Fase 2: partidos + tabla + héroe. Fase 3: stats + tips + noticias + jugadores. Fase 4: polish premium + live polling + PWA.

## Arquitectura del proyecto

```
BotMundialista/
├── dashboard/              ← NUEVO: app React independiente
│   ├── docs/               ← Documentación por fase
│   ├── server/             ← Express API (despliegue separado)
│   └── src/                ← React + Clean Architecture
├── admin/                  ← Admin panel existente (sin cambios)
├── bot/                    ← Lógica del bot (sin cambios)
...
```

El dashboard tiene su propio servidor Express que consulta Cosmos DB directamente, resuelve URLs de CDN, y sirve la SPA compilada. Se despliega en un dominio diferente al del bot (ej: `mundialista.app`).
