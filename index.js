require("dotenv").config();
const express = require("express");
const cors = require("cors");
const aiRoutes = require("./routes/aiRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const logger = require("./utils/logger");
const {
  httpRequestsTotal,
  httpDurationHistogram,
  serviceHealthStatus,
  cacheHitRate,
} = require('./services/metricsService');

const app = express();
const PORT = process.env.PORT || 5003;

console.log("🔥Lancement du AI Service...");

// Vérifications essentielles
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY manquante!");
  process.exit(1);
}

// Middlewares essentiels
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.FRONTEND_URL || "http://localhost:3000"
  ],
  credentials: true
}));

app.use(express.json({ limit: "2mb" }));

// Middleware de métriques Prometheus 
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const duration = process.hrtime(start);
    const seconds = duration[0] + duration[1] / 1e9;

    httpDurationHistogram.observe(
      {
        method: req.method,
        route: req.route ? req.route.path : req.path,
        status_code: res.statusCode,
      },
      seconds
    );

    httpRequestsTotal.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });
  });

  next();
});

// Logging avec métriques 
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Routes 
app.use("/api/ai", aiRoutes);
app.use("/metrics", metricsRoutes);

// Health check avec métriques 
app.get("/health", (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "ai-service",
    version: "1.0.0",
    services: {
      openai: process.env.OPENAI_API_KEY ? "configured" : "missing",
      weather: process.env.WEATHER_API_KEY ? "configured" : "not-configured"
    }
  };

  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith("sk-")) {
    health.status = "degraded";
    health.services.openai = "misconfigured";
  }

  const isHealthy = health.status === "healthy" ? 1 : 0;
  serviceHealthStatus.set({ service_name: "ai-service" }, isHealthy);

  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get("/ping", (req, res) => {
  res.json({
    status: "pong ✅",
    timestamp: new Date().toISOString(),
    service: "ai-service",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// Endpoint de métriques custom 
app.get("/vitals", (req, res) => {
  const vitals = {
    service: "ai-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    pid: process.pid,
    node_version: process.version,
    environment: process.env.NODE_ENV || "development",
    
    features: {
      roadtrip_validation: true,
      duration_limit: 14,
      topic_filtering: true,
      weather_integration: !!process.env.WEATHER_API_KEY,
      cache_enabled: true
    },
    
    cache: getCacheStats(),
    
    limits: {
      max_duration_days: 14,
      cache_ttl_seconds: 3600,
      request_timeout_ms: 30000
    }
  };

  res.json(vitals);
});

// Gestion d'erreurs avec métriques 
app.use((req, res) => {
  httpRequestsTotal.inc({
    method: req.method,
    route: "404",
    status_code: 404,
  });

  res.status(404).json({
    error: "Route non trouvée",
    message: `${req.method} ${req.path} n'existe pas`,
    availableRoutes: [
      "GET /health",
      "GET /ping",
      "GET /vitals",
      "GET /metrics", 
      "POST /api/ai/ask"
    ]
  });
});

app.use((err, req, res, next) => {
  logger.error("💥 Erreur:", err.message);
  
  httpRequestsTotal.inc({
    method: req.method,
    route: req.route ? req.route.path : req.path,
    status_code: 500,
  });

  if (err.message.includes("OpenAI")) {
    return res.status(503).json({
      error: "Service IA indisponible",
      message: "L'assistant IA est temporairement indisponible"
    });
  }

  if (err.message.includes("CORS")) {
    return res.status(403).json({
      error: "Accès non autorisé",
      message: "Origin non autorisée"
    });
  }

  res.status(500).json({
    error: "Erreur serveur",
    message: err.message || "Une erreur est survenue"
  });
});

// Fonction utilitaire pour les stats de cache 
function getCacheStats() {
  try {
    const NodeCache = require("node-cache");
    const testCache = new NodeCache();
    const stats = testCache.getStats();
    
    const hitRate = stats.hits > 0 
      ? stats.hits / (stats.hits + stats.misses) 
      : 0;
    
    cacheHitRate.set(hitRate);
    
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hit_rate: hitRate,
      status: "healthy"
    };
  } catch (error) {
    return {
      status: "error",
      message: error.message
    };
  }
}

// Démarrage 
app.listen(PORT, () => {
  console.log(`🤖 AI service démarré sur http://localhost:${PORT}`);
  console.log(`🔐 Environnement: ${process.env.NODE_ENV || "development"}`);
  console.log(`❤️ Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Métriques: http://localhost:${PORT}/metrics`);
  console.log(`📈 Vitals: http://localhost:${PORT}/vitals`);
  console.log(`🧠 API IA: http://localhost:${PORT}/api/ai`);
  
  serviceHealthStatus.set({ service_name: "ai-service" }, 1);
  
  logger.info("✅ AI Service démarré avec succès");
});

// Gestion graceful shutdown 
process.on('SIGTERM', () => {
  console.log('🔄 Arrêt gracieux du service...');
  serviceHealthStatus.set({ service_name: "ai-service" }, 0);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Arrêt gracieux du service...');
  serviceHealthStatus.set({ service_name: "ai-service" }, 0);
  process.exit(0);
});

module.exports = app;