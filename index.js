require("dotenv").config();
const express = require("express");
const cors = require("cors");
const aiRoutes = require("./routes/aiRoutes");
const logger = require("./utils/logger");
const {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  updateServiceHealth,
  updateActiveConnections,
  updateExternalServiceHealth
} = require("./metrics");

const app = express();
const PORT = process.env.PORT || 5003;
const METRICS_PORT = process.env.METRICS_PORT || 9003;
const SERVICE_NAME = "ai-service";

console.log(`🔥 Lancement du ${SERVICE_NAME}...`);

// CONFIGURATION DE BASE

// Vérifications
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY manquante!");
  updateServiceHealth(SERVICE_NAME, false);
  process.exit(1);
}

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));

// MIDDLEWARE DE MÉTRIQUES

let currentConnections = 0;

app.use((req, res, next) => {
  const start = Date.now();
  currentConnections++;
  updateActiveConnections(currentConnections);

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    currentConnections--;
    updateActiveConnections(currentConnections);

    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode,
      },
      duration
    );

    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });

    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${Math.round(duration * 1000)}ms`);
  });

  next();
});

// ROUTES STANDARD

// Métriques Prometheus
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get("/health", (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: SERVICE_NAME,
    version: "1.0.0"
  };

  if (!process.env.OPENAI_API_KEY) {
    health.status = "unhealthy";
  }

  const isHealthy = health.status === "healthy";
  updateServiceHealth(SERVICE_NAME, isHealthy);

  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json(health);
});

// Vitals
app.get("/vitals", (req, res) => {
  const vitals = {
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    status: "running",
    active_connections: currentConnections
  };

  res.json(vitals);
});

// Ping
app.get("/ping", (req, res) => {
  res.json({
    status: "pong ✅",
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ROUTES SPÉCIFIQUES AU SERVICE

app.use("/api/ai", aiRoutes);

// GESTION D'ERREURS

app.use((req, res) => {
  res.status(404).json({
    error: "Route non trouvée",
    service: SERVICE_NAME,
    availableRoutes: [
      "GET /health", "GET /vitals", "GET /metrics", "GET /ping",
      "POST /api/ai/ask"
    ],
  });
});

app.use((err, req, res, next) => {
  logger.error(`💥 Erreur ${SERVICE_NAME}:`, err.message);
  
  res.status(500).json({
    error: "Erreur serveur",
    service: SERVICE_NAME,
    message: err.message
  });
});

// DÉMARRAGE

// Serveur principal
app.listen(PORT, () => {
  console.log(`🤖 ${SERVICE_NAME} démarré sur le port ${PORT}`);
  console.log(`📊 Métriques: http://localhost:${PORT}/metrics`);
  console.log(`❤️ Health: http://localhost:${PORT}/health`);
  console.log(`📈 Vitals: http://localhost:${PORT}/vitals`);
  
  updateServiceHealth(SERVICE_NAME, true);
  updateExternalServiceHealth("openai", true);
  
  logger.info(`✅ ${SERVICE_NAME} démarré avec métriques`);
});

// Serveur métriques séparé (pour Prometheus)
const metricsApp = express();
metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

metricsApp.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: `${SERVICE_NAME}-metrics` });
});

metricsApp.listen(METRICS_PORT, () => {
  console.log(`📊 Metrics server running on port ${METRICS_PORT}`);
});

// GRACEFUL SHUTDOWN

function gracefulShutdown(signal) {
  console.log(`🔄 Arrêt ${SERVICE_NAME} (${signal})...`);
  updateServiceHealth(SERVICE_NAME, false);
  updateActiveConnections(0);
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  updateServiceHealth(SERVICE_NAME, false);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  updateServiceHealth(SERVICE_NAME, false);
  process.exit(1);
});

module.exports = app;