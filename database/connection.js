require('dotenv').config();
const { Pool } = require('pg');

// Configuración común al pool: sizing, timeouts y application_name para
// depurar conexiones desde el lado de la base de datos.
const COMMON = {
  max: parseInt(process.env.DB_POOL_MAX || '25', 10),
  idleTimeoutMillis: 30000,
  maxUses: 7500, // recicla conexiones viejas para evitar leaks en conexiones largas
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000, // aborta queries que excedan 30s
  query_timeout: 30000,
  application_name: 'scorehub',
  family: 4, // fuerza IPv4 — el host de Supabase resuelve a ::1 y da EACCES
};

let poolConfig;
if (process.env.SUPABASE_DB_URL) {
  poolConfig = {
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    ...COMMON,
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    ...COMMON,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Pool error (idle client):', err.message);
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const r = await client.query('SELECT NOW() as now, current_database() as db');
    console.log(`Database connected (${r.rows[0].db}) @ ${r.rows[0].now.toISOString()}`);
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

module.exports = { pool, testConnection };
