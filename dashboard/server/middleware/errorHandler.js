function errorHandler(err, req, res, _next) {
  const status = err.status || 500
  const message = err.status ? err.message : 'Error interno del servidor'
  req.log?.error?.({ err, status, path: req.path }, message)
  res.status(status).json({ error: message })
}

module.exports = errorHandler
