# 01 — Sistema de Diseño

## Filosofía

El diseño del dashboard toma su identidad visual de la **noche de estadio iluminada por reflectores**: un fondo oscuro profundo con acentos cálidos (dorado del trofeo) y fríos (azul de las pantallas gigantes). El lenguaje visual evoca las transmisiones deportivas televisivas traducidas a web — cada elemento se siente como un overlay de broadcast.

## Colores

Los valores se definen como CSS Custom Properties en `:root` y también en `tailwind.config.ts` para uso con clases utilitarias.

```css
:root {
  /* Backgrounds */
  --bg-base:       #070B15;   /* Noche de estadio — fondo principal */
  --bg-card:       #111B2E;   /* Superficie de tarjetas */
  --bg-elevated:   #1A2642;   /* Superficies elevadas (hover, modales) */

  /* Accents */
  --accent-gold:   #F5A623;   /* Dorado — trofeo, goles, datos clave */
  --accent-blue:   #38BDF8;   /* Azul cielo — información, interactivos */
  --accent-live:   #22C55E;   /* Verde esmeralda — indicador EN VIVO */
  --accent-red:    #EF4444;   /* Rojo — alertas, tarjetas rojas */

  /* Text */
  --text-primary:  #F1F5F9;   /* Texto principal */
  --text-muted:    #8899AA;   /* Texto secundario */
  --text-dim:      #64748B;   /* Texto terciario (captions, metadata) */

  /* Borders */
  --border-card:   rgba(56, 189, 248, 0.08);
  --border-hover:  rgba(56, 189, 248, 0.2);
}
```

### Por qué este palette huye de los templates AI

| Template AI común | Este proyecto |
|-------------------|--------------|
| Fondo crema (#F4F1EA) + serif + terracota | ⛔ Fondo oscuro profundo #070B15 |
| Negro + verde ácido neón | ⛔ Navy #111B2E + dorado #F5A623 |
| Periódico con reglas + columnas | ⛔ Layout broadcast con tarjetas flotantes |

El **dorado** conecta con el trofeo de la Copa del Mundo. El **azul cielo** remite a las banderas de las tres sedes (EEUU, Canadá, México). El **verde** se reserva exclusivamente para el estado "EN VIVO".

## Tipografía

```css
:root {
  --font-display: 'Teko', sans-serif;     /* Marcadores, números, titulares */
  --font-body:    'Sora', sans-serif;      /* Texto general, etiquetas */
  --font-mono:    'JetBrains Mono', monospace; /* Stats, datos, timestamps */
}
```

### Roles y escalas

| Rol | Font | Weight | Size | Tracking | Uso |
|-----|------|--------|------|----------|-----|
| **Score hero** | Teko | 700 | clamp(56px, 10vw, 96px) | 0 | Marcador del partido destacado |
| **Score card** | Teko | 600 | clamp(28px, 5vw, 44px) | 0 | Marcador en tarjetas de partido |
| **Stat number** | Teko | 600 | clamp(24px, 4vw, 36px) | 0 | Goles, asistencias, ratings |
| **Section title** | Sora | 600 | 20px | 0.02em | Títulos de sección |
| **Team name** | Sora | 500 | 15px | 0.01em | Nombre de equipo en tarjetas |
| **Body** | Sora | 400 | 14px | normal | Texto general, descripciones |
| **Caption** | Sora | 400 | 12px | 0.01em | Metadatos, fechas |
| **Data** | JetBrains Mono | 500 | 13px | -0.02em | Stats, minutos, porcentajes |
| **Eyebrow** | Sora | 700 | 11px | 0.08em | Etiquetas de estado (EN VIVO, FINAL) |

### Por qué Teko + Sora

- **Teko** es una semicondensada india diseñada para contextos deportivos. Su energía dinámica la hace perfecta para marcadores sin caer en la obviedad de Oswald o Bebas Neue.
- **Sora** es una geométrica moderna con terminales ligeramente redondeados. Contrasta con Teko al ser más calmada y legible, y es menos común que Inter o DM Sans.
- **JetBrains Mono** aporta precisión técnica a los datos, con ligaduras que hacen legibles los números compuestos (ej: `1-2`, `78%`).

## Layout

### Estructura general

```
┌──────────────────────────────────────────────────────────┐
│ [LOGO]  MUNDIALISTA 2026      EN VIVO  PARTIDOS  TABLA  │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │              HERO MATCH (full-width)                 │ │
│ │   broadcast-style featured match con timeline + stats│ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌───────────────┐  ┌──────────────────────────────────┐ │
│ │  MATCH TICKER  │  │  STANDINGS PANEL                │ │
│ │  (horizontal)   │  │  (right sidebar desktop,        │ │
│ │                 │  │   full-width mobile)            │ │
│ ├───────────────┤  │                                  │ │
│ │  MATCH GRID   │  │  ┌────────────────────────┐      │ │
│ │  (cards)       │  │  │ TOP SCORERS / ASSISTS  │      │ │
│ │                 │  │  └────────────────────────┘      │ │
│ │                 │  │  ┌────────────────────────┐      │ │
│ │                 │  │  │ BETTING TRENDS          │      │ │
│ │                 │  │  └────────────────────────┘      │ │
│ ├───────────────┤  │  ┌────────────────────────┐      │ │
│ │  NEWS FEED    │  │  │ TEAM OF THE WEEK        │      │ │
│ │                 │  │  └────────────────────────┘      │ │
│ └───────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Comportamiento responsive

| Breakpoint | Layout |
|------------|--------|
| < 768px | Stack vertical: Hero → Ticker → Standings → Stats → Tips → News |
| 768–1024px | Grid 2 columnas: contenido principal + sidebar stats |
| >= 1024px | Grid asimétrico: 60% principal + 40% sidebar con scroll independiente |

## Elemento Firma: "El Marcador Cinético"

El héroe de la página es un **marcador en vivo con movimiento broadcast**:

- **Score shimmer**: cuando el marcador se actualiza (nuevo gol), el número vibra y emite un destello dorado
- **Rayo de gol animado**: una línea horizontal cruza brevemente la tarjeta cuando ocurre un gol (solo en live)
- **Pulso ECG**: el indicador LIVE late con una animación de electrocardiograma
- **Sticky en mobile**: al scrollear, el marcador principal se encoge y se pega al top como barra compacta

Este elemento es la **única animación llamativa**. El resto de la página se mantiene contenido y disciplinado.

### Consideraciones de accesibilidad

- `prefers-reduced-motion`: todas las animaciones se desactivan
- `focus-visible`: todos los interactivos tienen outline azul cielo
- Contraste WCAG AA en todos los textos
- Estados de carga con skeleton shimmer
