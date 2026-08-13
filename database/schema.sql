-- ═══════════════════════════════════════════════════════════════
-- HISTORICAL — Auditoría 2026-Q3 Fase 6.3
--
-- Este archivo es histórico y está SUPERSEDIDO por database/migrations/
-- (002-025). NO ejecutar. Se conserva sólo como referencia de la
-- estructura original del proyecto (era MySQL).
--
-- Para aplicar el schema actual, ejecutar las migraciones en orden:
--   node database/migrate.js
-- (que ya valida la conexión a Supabase y aplica 002-025 secuencialmente).
-- ═══════════════════════════════════════════════════════════════

-- Tabla de usuarios
CREATE TABLE usuarios (
  id VARCHAR(255) PRIMARY KEY,
  alias VARCHAR(100) NOT NULL,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estado VARCHAR(50) DEFAULT 'registrado'
);

-- Tabla de equipos seguidos
CREATE TABLE equipos_seguidos (
  id SERIAL PRIMARY KEY,
  id_usuario VARCHAR(255) NOT NULL,
  id_equipo INT NOT NULL,
  nombre_equipo VARCHAR(100) NOT NULL,
  fecha_seguimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id_usuario, id_equipo)
);

-- Tabla de historial de consultas
CREATE TABLE historial_consultas (
  id SERIAL PRIMARY KEY,
  id_usuario VARCHAR(255) NOT NULL,
  consulta TEXT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  respuesta TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_historial_fecha ON historial_consultas(fecha);
CREATE INDEX idx_historial_tipo ON historial_consultas(tipo);

-- =============================================
-- MÓDULO DE APUESTAS - Bet Tracking
-- =============================================

-- Tabla principal de apuestas
CREATE TABLE apuestas (
  id SERIAL PRIMARY KEY,
  id_usuario VARCHAR(255) NOT NULL,
  imagen_url VARCHAR(500),                -- URL de la imagen almacenada
  partido_extrado VARCHAR(255),           -- Partido reconocido de imagen
  minuto_extrado INTEGER,
  marcador_local INTEGER,
  marcador_visitante INTEGER,
  id_partido_api INTEGER,                 -- ID del partido en API (null si no se encontró)
  partido_normalizado VARCHAR(255),       -- Nombre normalizado del partido
  estado VARCHAR(20) DEFAULT 'abierta',   -- 'abierta', 'completada'
  resultado_final VARCHAR(20),            -- 'ganada', 'perdida', 'nula'
  confianza_ocr DECIMAL(5,2),           -- 0.00 a 1.00
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_partido TIMESTAMP,
  fecha_cierre TIMESTAMP
);

-- Selecciones individuales dentro de cada apuesta
CREATE TABLE apuesta_selecciones (
  id SERIAL PRIMARY KEY,
  id_apuesta INTEGER REFERENCES apuestas(id) ON DELETE CASCADE,
  tipo_mercado VARCHAR(100),             -- 'resultado_final', 'corners_over', etc.
  valor_seleccion VARCHAR(255),           -- 'Brasil', 'Over 5', etc.
  linea DECIMAL(5,2),                    -- Línea numérica (e.g., 5.5)
  estado VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'cumplida', 'fallida'
  valor_actual DECIMAL(5,2),            -- Valor actual vs línea
  detalle TEXT                           -- Descripción extra
);

-- Historial de eventos para cada apuesta (para debugging/notifications)
CREATE TABLE eventos_apuesta (
  id SERIAL PRIMARY KEY,
  id_apuesta INTEGER REFERENCES apuestas(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(50),               -- 'gol', 'corner', 'tarjeta', 'cambio_marcador'
  descripcion TEXT,
  minuto INTEGER,
  datos JSONB,                          -- Datos adicionales del evento
  fecha TIMESTAMP DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX idx_apuestas_usuario ON apuestas(id_usuario);
CREATE INDEX idx_apuestas_estado ON apuestas(estado);
CREATE INDEX idx_apuestas_partido_api ON apuestas(id_partido_api);
CREATE INDEX idx_selecciones_estado ON apuesta_selecciones(estado);
CREATE INDEX idx_eventos_apuesta ON eventos_apuesta(id_apuesta);