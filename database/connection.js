require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
};

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