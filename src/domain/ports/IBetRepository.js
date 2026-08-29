/**
 * src/domain/ports/IBetRepository.js — Puerto de repositorio de apuestas (Fase 8).
 *
 * Tablas: `apuestas` (registro principal) y `apuesta_selecciones` (selecciones
 * por apuesta). Las filas se acceden principalmente por `id_usuario` (dueño
 * de la apuesta) y por `id` (consulta individual).
 *
 * @typedef {Object} BetDTO
 * @property {number} id
 * @property {string} idUsuario
 * @property {string} [imagenUrl]
 * @property {string} [partidoExtrado]
 * @property {number} [minutoExtrado]
 * @property {number} [marcadorLocal]
 * @property {number} [marcadorVisitante]
 * @property {number} [idPartidoApi]
 * @property {string} [partidoNormalizado]
 * @property {number} [confianzaOcr]
 * @property {string} [estado]
 * @property {string} [resultadoFinal]
 * @property {string} [fechaCreacion]
 * @property {string} [fechaPartido]
 * @property {string} [fechaCierre]
 * @property {BetSelectionDTO[]} [selecciones]
 *
 * @typedef {Object} BetSelectionDTO
 * @property {number} id
 * @property {number} idApuesta
 * @property {string} tipoMercado
 * @property {string} valorSeleccion
 * @property {number} [linea]
 * @property {string} [estado]
 * @property {number} [valorActual]
 * @property {string} [detalle]
 *
 * @typedef {Object} NewBetInput
 * @property {string} idUsuario
 * @property {string} partidoExtrado
 * @property {number} [minutoExtrado]
 * @property {number} [marcadorLocal]
 * @property {number} [marcadorVisitante]
 * @property {number} [idPartidoApi]
 * @property {string} [partidoNormalizado]
 * @property {number} [confianzaOcr]
 * @property {string} [fechaPartido]
 *
 * @typedef {Object} NewBetSelectionInput
 * @property {number} idApuesta
 * @property {string} tipoMercado
 * @property {string} valorSeleccion
 * @property {number} [linea]
 * @property {string} [estado]
 *
 * @typedef {Object} IBetRepository
 * @property {(input:NewBetInput) => Promise<BetDTO>} insert
 * @property {(id:number, imagenUrl:string) => Promise<void>} setImagenUrl
 * @property {(input:NewBetSelectionInput) => Promise<void>} insertSelection
 * @property {(userId:string) => Promise<BetDTO[]>} listByUser
 */

const REQUIRED_METHODS = [
  'insert',
  'setImagenUrl',
  'insertSelection',
  'listByUser',
];

function createBetRepository(adapter = {}) {
  if (typeof adapter !== 'object' || adapter === null) {
    throw new Error('createBetRepository: adapter must be an object');
  }
  const handler = {
    get(target, prop) {
      if (typeof prop !== 'string') return target[prop];
      if (REQUIRED_METHODS.includes(prop)) {
        if (typeof target[prop] !== 'function') {
          throw new Error(
            `betRepository.${prop} is not implemented. ` +
            `Required methods: ${REQUIRED_METHODS.join(', ')}`
          );
        }
      }
      return target[prop];
    },
  };
  return new Proxy(adapter, handler);
}

module.exports = { createBetRepository, REQUIRED_METHODS };
