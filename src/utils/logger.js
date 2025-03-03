import winston from "winston";
import path from "path";

// Créer un format personnalisé pour les logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss"
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Créer un logger avec plusieurs transports (console et fichier)
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: logFormat,
  defaultMeta: { service: "roadtrip-ai-service" },
  transports: [
    // Écrire tous les logs de niveau 'info' ou moins dans 'combined.log'
    // Écrire tous les logs de niveau 'error' dans 'error.log'
    new winston.transports.File({ 
      filename: path.join("logs", "error.log"), 
      level: "error" 
    }),
    new winston.transports.File({ 
      filename: path.join("logs", "combined.log") 
    })
  ]
});

// Si nous ne sommes pas en production, log également sur la console
if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Middleware pour logger les requêtes
export const requestLogger = (req, res, next) => {
  // Créer un ID unique pour cette requête
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  req.requestId = requestId;

  // Logger le début de la requête
  logger.info(`Requête entrante [${requestId}]: ${req.method} ${req.url}`, {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers["user-agent"]
  });

  // Mesurer le temps de traitement
  const start = Date.now();

  // Logger la fin de la requête après envoi de la réponse
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`Réponse [${requestId}]: ${res.statusCode} (${duration}ms)`, {
      requestId,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
};

// Middleware pour capturer et logger les erreurs
export const errorLogger = (err, req, res, next) => {
  logger.error(`Erreur [${req.requestId}]: ${err.message}`, {
    requestId: req.requestId,
    error: err,
    stack: err.stack
  });
  
  next(err);
};

export default logger;