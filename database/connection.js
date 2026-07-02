require('dotenv').config();
const { Pool } = require('pg');

// Soporta dos modos de conexión:
// - Directo: DB_HOST=db.<ref>.supabase.co (puede resolver a IPv6)
// - Pooler:  DB_HOST=aws-0-<region>.pooler.supabase.com (IPv4, recomendado para serverless)
const usePooler = (process.env.DB_HOST || '').includes('pooler.supabase.com');

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // IPv4 forzado para entornos que no soportan IPv6 (Azure App Service Free tier)
  family: 4,
  connectionTimeoutMillis: 10000,
};

// Si el usuario viene como "postgres", para el pooler Supavisor hay que prefijar con el project ref
if (usePooler && poolConfig.user === 'postgres' && process.env.DB_PROJECT_REF) {
  poolConfig.user = `postgres.${process.env.DB_PROJECT_REF}`;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ Pool error (idle client):', err.message);
});

// Test connection on startup
async function testConnection() {
  try {
    const client = await pool.connect();
    const r = await client.query('SELECT NOW() as now, current_database() as db');
    console.log(`✅ Database connected (${r.rows[0].db}) @ ${r.rows[0].now.toISOString()}`);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    if (usePooler) {
      console.error('   Usando pooler Supavisor. Verifica DB_USER=postgres.<ref>, DB_PASSWORD, DB_HOST y DB_PORT=6543');
    } else {
      console.error('   Si falla por ENOTFOUND, intenta el pooler: DB_HOST=aws-0-us-east-1.pooler.supabase.com, DB_PORT=6543, DB_USER=postgres.<ref>');
    }
    return false;
  }
}

module.exports = { pool, testConnection };