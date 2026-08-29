/**
 * src/infrastructure/persistence/PgBetRepository.js — Adapter para IBetRepository.
 *
 * Tablas `apuestas` + `apuesta_selecciones`. Todas las queries usan
 * `db.execAdvanced` (pg pool) porque incluyen RETURNING, json_agg con
 * FILTER (agregado por FK) y jsonb que PostgREST no soporta directamente.
 */

const db = require('../../../database/db');

class PgBetRepository {
  constructor({ logger } = {}) {
    this._log = logger;
  }

  async insert(input) {
    const rows = await db.execAdvanced(
      `INSERT INTO apuestas (
         id_usuario,
         partido_extrado,
         minuto_extrado,
         marcador_local,
         marcador_visitante,
         id_partido_api,
         partido_normalizado,
         confianza_ocr,
         fecha_partido
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.idUsuario,
        input.partidoExtrado,
        input.minutoExtrado ?? null,
        input.marcadorLocal ?? null,
        input.marcadorVisitante ?? null,
        input.idPartidoApi ?? null,
        input.partidoNormalizado ?? null,
        input.confianzaOcr ?? null,
        input.fechaPartido ?? null,
      ]
    );
    return this._toDto(rows[0]);
  }

  async setImagenUrl(id, imagenUrl) {
    await db.execAdvanced(
      `UPDATE apuestas SET imagen_url = $1 WHERE id = $2`,
      [imagenUrl, id]
    );
  }

  async insertSelection(input) {
    await db.execAdvanced(
      `INSERT INTO apuesta_selecciones (
         id_apuesta, tipo_mercado, valor_seleccion, linea, estado
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        input.idApuesta,
        input.tipoMercado,
        input.valorSeleccion,
        input.linea ?? null,
        input.estado ?? null,
      ]
    );
  }

  async listByUser(userId) {
    const result = await db.execAdvanced(
      `SELECT a.*,
              json_agg(json_build_object(
                'id', s.id,
                'id_apuesta', s.id_apuesta,
                'tipo_mercado', s.tipo_mercado,
                'valor_seleccion', s.valor_seleccion,
                'linea', s.linea,
                'estado', s.estado,
                'valor_actual', s.valor_actual,
                'detalle', s.detalle
              )) FILTER (WHERE s.id IS NOT NULL) AS selecciones
       FROM apuestas a
       LEFT JOIN apuesta_selecciones s ON s.id_apuesta = a.id
       WHERE a.id_usuario = $1
       GROUP BY a.id
       ORDER BY a.fecha_creacion DESC`,
      [userId]
    );
    return result.map((r) => this._toDto(r));
  }

  _toDto(row) {
    return {
      id: row.id,
      idUsuario: row.id_usuario,
      imagenUrl: row.imagen_url,
      partidoExtrado: row.partido_extrado,
      minutoExtrado: row.minuto_extrado,
      marcadorLocal: row.marcador_local,
      marcadorVisitante: row.marcador_visitante,
      idPartidoApi: row.id_partido_api,
      partidoNormalizado: row.partido_normalizado,
      confianzaOcr: row.confianza_ocr,
      estado: row.estado,
      resultadoFinal: row.resultado_final,
      fechaCreacion: row.fecha_creacion,
      fechaPartido: row.fecha_partido,
      fechaCierre: row.fecha_cierre,
      selecciones: row.selecciones || [],
    };
  }
}

module.exports = { PgBetRepository };
