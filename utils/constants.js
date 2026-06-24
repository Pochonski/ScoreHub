// Constantes del proyecto - Mundial 2026
// Nota: Los equipos ahora se buscan dinámicamente via API usando TEAM_NAME_MAP
// Esta lista es para referencia rápida y detección de equipos en el parser

const LIGAS = {
  MUNDIAL: { id: 77, nombre: 'Copa Mundial 2026', pais: 'Mundial' }
};

// Equipos del Mundial 2026 - IDs correctos de la API
// Usados para detección rápida en queryParser.js
const EQUIPOS_MUNDIAL = {
  // CONCACAF
  'mexico': { id: '6710', nombre: 'Mexico' },
  'usa': { id: '6713', nombre: 'USA' },
  'canada': { id: '5810', nombre: 'Canada' },
  'jamaica': { id: '5806', nombre: 'Jamaica' },
  'honduras': { id: '5808', nombre: 'Honduras' },
  'costa rica': { id: '6705', nombre: 'Costa Rica' },
  'panama': { id: '5922', nombre: 'Panama' },
  'guatemala': { id: '5858', nombre: 'Guatemala' },

  // CONMEBOL
  'brasil': { id: '8256', nombre: 'Brazil' },
  'argentina': { id: '6706', nombre: 'Argentina' },
  'uruguay': { id: '5796', nombre: 'Uruguay' },
  'colombia': { id: '8258', nombre: 'Colombia' },
  'chile': { id: '9762', nombre: 'Chile' },
  'peru': { id: '5798', nombre: 'Peru' },
  'ecuador': { id: '6707', nombre: 'Ecuador' },
  'venezuela': { id: '5800', nombre: 'Venezuela' },
  'paraguay': { id: '6724', nombre: 'Paraguay' },
  'bolivia': { id: '5797', nombre: 'Bolivia' },

  // UEFA - Europa
  'alemania': { id: '8570', nombre: 'Germany' },
  'francia': { id: '6723', nombre: 'France' },
  'inglaterra': { id: '8491', nombre: 'England' },
  'espan a': { id: '6720', nombre: 'Spain' },
  'espana': { id: '6720', nombre: 'Spain' },
  'italia': { id: '8204', nombre: 'Italy' },
  'portugal': { id: '8361', nombre: 'Portugal' },
  'holanda': { id: '6708', nombre: 'Netherlands' },
  'paises bajos': { id: '6708', nombre: 'Netherlands' },
  'belgica': { id: '8263', nombre: 'Belgium' },
  'croacia': { id: '10155', nombre: 'Croatia' },
  'suiza': { id: '6717', nombre: 'Switzerland' },
  'polonia': { id: '8568', nombre: 'Poland' },
  'dinamarca': { id: '8238', nombre: 'Denmark' },
  'suecia': { id: '8520', nombre: 'Sweden' },
  'noruega': { id: '8492', nombre: 'Norway' },
  'austria': { id: '8255', nombre: 'Austria' },
  'gales': { id: '5790', nombre: 'Wales' },
  'escocia': { id: '8498', nombre: 'Scotland' },
  'irlanda': { id: '5791', nombre: 'Ireland' },
  'rep checa': { id: '8496', nombre: 'Czech Republic' },
  'hungria': { id: '8565', nombre: 'Hungary' },
  'rumania': { id: '9730', nombre: 'Romania' },
  'serbia': { id: '8205', nombre: 'Serbia' },
  'eslovaquia': { id: '8497', nombre: 'Slovakia' },
  'finlandia': { id: '7871', nombre: 'Finland' },
  'grecia': { id: '6383', nombre: 'Greece' },
  'ucrania': { id: '6718', nombre: 'Ukraine' },
  'turquia': { id: '10251', nombre: 'Turkey' },

  // AFC - Asia
  'japon': { id: '6715', nombre: 'Japan' },
  'corea': { id: '7804', nombre: 'South Korea' },
  'corea del sur': { id: '7804', nombre: 'South Korea' },
  'arabia': { id: '7795', nombre: 'Saudi Arabia' },
  'arabia saudita': { id: '7795', nombre: 'Saudi Arabia' },
  'iran': { id: '6711', nombre: 'Iran' },
  'australia': { id: '6716', nombre: 'Australia' },
  'qatar': { id: '5902', nombre: 'Qatar' },
  'emiratos': { id: '5789', nombre: 'United Arab Emirates' },

  // CAF - Africa
  'marruecos': { id: '6262', nombre: 'Morocco' },
  'senegal': { id: '6395', nombre: 'Senegal' },
  'ghana': { id: '6714', nombre: 'Ghana' },
  'camerun': { id: '6629', nombre: 'Cameroon' },
  'nigeria': { id: '6346', nombre: 'Nigeria' },
  'egipto': { id: '10255', nombre: 'Egypt' },
  'argelia': { id: '6317', nombre: 'Algeria' },
  'tunez': { id: '6719', nombre: 'Tunisia' },
  'sudafrica': { id: '6316', nombre: 'South Africa' },
  'zambia': { id: '6277', nombre: 'Zambia' },

  // OFC - Oceania
  'nueva zelanda': { id: '5820', nombre: 'New Zealand' },
  'fiji': { id: '5925', nombre: 'Fiji' },
};

const INTENTOS = {
  PARTIDOS_HOY: 'partidos_hoy',
  PARTIDOS_FECHA: 'partidos_fecha',
  RESULTADO: 'resultado',
  RESULTADO_VS: 'resultado_vs',
  ESTADISTICA: 'estadistica',
  INFO_EQUIPO: 'info_equipo',
  TABLA: 'tabla',
  TABLA_MUNDIAL: 'tabla_mundial',
  TABLA_GRUPO: 'tabla_grupo',
  ANALISIS: 'analisis',
  SEGUIR_EQUIPO: 'seguir_equipo',
  DEJAR_SEGUIR: 'dejar_seguir',
  MIS_EQUIPOS: 'mis_equipos',
  HELP: 'help',
  SALUDO: 'saludo',
  DESCONOCIDO: 'desconocido'
};

const ESTADOS_USUARIO = {
  REGISTRADO: 'registrado',
  ESPERANDO_ALIAS: 'esperando_alias'
};

// Exportar para compatibilidad
const EQUIPOS_POPULARES = EQUIPOS_MUNDIAL;

module.exports = {
  LIGAS,
  EQUIPOS_POPULARES,
  EQUIPOS_MUNDIAL,
  INTENTOS,
  ESTADOS_USUARIO
};
