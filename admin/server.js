require('dotenv').config();
const express = require('express');
const { pool } = require('../database/connection');
const path = require('path');

const app = express();
const PORT = process.env.ADMIN_PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Estadísticas generales
app.get('/api/stats', async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) as total FROM usuarios');
    const queries = await pool.query('SELECT COUNT(*) as total FROM historial_consultas');
    const teamsFollowed = await pool.query('SELECT COUNT(*) as total FROM equipos_seguidos');

    const todayQueries = await pool.query(
      'SELECT COUNT(*) as total FROM historial_consultas WHERE DATE(fecha) = CURRENT_DATE'
    );

    res.json({
      totalUsers: parseInt(users.rows[0].total),
      totalQueries: parseInt(queries.rows[0].total),
      teamsFollowed: parseInt(teamsFollowed.rows[0].total),
      todayQueries: parseInt(todayQueries.rows[0].total)
    });
  } catch (error) {
    console.error('Error /api/stats:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Usuarios recientes
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, alias, fecha_registro FROM usuarios ORDER BY fecha_registro DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/users:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Consultas recientes
app.get('/api/queries', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(
      `SELECT h.id, h.consulta, h.tipo, h.respuesta, h.fecha, u.alias
       FROM historial_consultas h
       JOIN usuarios u ON h.id_usuario = u.id
       ORDER BY h.fecha DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/queries:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Equipos seguidos
app.get('/api/followed-teams', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.nombre_equipo, u.alias, e.fecha_seguimiento
       FROM equipos_seguidos e
       JOIN usuarios u ON e.id_usuario = u.id
       ORDER BY e.fecha_seguimiento DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/followed-teams:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Consultas por tipo
app.get('/api/queries-by-type', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tipo, COUNT(*) as total
       FROM historial_consultas
       GROUP BY tipo
       ORDER BY total DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error /api/queries-by-type:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Solo iniciar servidor independiente si ADMIN_STANDALONE=true (para desarrollo local)
// En producción las rutas /admin/* se sirven desde el servidor principal del bot
if (process.env.ADMIN_STANDALONE === 'true') {
  app.listen(PORT, () => {
    console.log(`🚀 Panel Admin corriendo en http://localhost:${PORT}`);
  });
} else {
  console.log(`📋 Panel Admin integrado en servidor principal (rutas /admin/*)`);
}