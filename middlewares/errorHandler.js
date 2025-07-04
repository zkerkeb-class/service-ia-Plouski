const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('💥 Middleware Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Erreurs spécifiques IA
  if (err.message && err.message.includes('OpenAI')) {
    return res.status(503).json({
      error: 'Service IA temporairement indisponible',
      message: 'L\'assistant IA est actuellement indisponible',
      timestamp: new Date().toISOString(),
    });
  }

  // Erreurs d'authentification
  if (err.name === 'UnauthorizedError' || err.message.includes('token')) {
    return res.status(401).json({
      error: 'Authentification requise',
      message: 'Accès premium requis pour utiliser l\'assistant IA',
      timestamp: new Date().toISOString(),
    });
  }

  // Erreurs de quota/rate limit
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Trop de requêtes',
      message: 'Limite d\'utilisation de l\'IA atteinte, veuillez patienter',
      timestamp: new Date().toISOString(),
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Erreur serveur interne'
    : err.message || 'Une erreur est survenue';

  res.status(statusCode).json({
    error: 'Erreur serveur',
    message,
    timestamp: new Date().toISOString(),
    path: req.path,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;