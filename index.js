require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const aiRoutes = require("./routes/aiRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const logger = require("./utils/logger");
const {
  httpRequestsTotal,
  httpDurationHistogram,
  serviceHealthStatus,
  externalServiceHealth,
  cacheHitRate,
} = require('./services/metricsService');
const basicLimiter = require("./middlewares/rateLimiter");

const app = express();
const PORT = process.env.PORT || 5003;

console.log("🔥 Lancement du AI Service...");

(async () => {
  try {
    // ───────────── Vérification des services dépendants ─────────────
    if (!process.env.OPENAI_API_KEY) {
      logger.warn("⚠️ OpenAI API key non configurée - service IA limité");
    } else {
      logger.info("✅ OpenAI API configurée");
    }

    // ───────────── Middlewares globaux ─────────────
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: [
              "'self'",
              "https://api.openai.com",
              "https://api.openweathermap.org",
            ],
          },
        },
      })
    );

    app.use(basicLimiter);

    const corsOptions = {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          process.env.CORS_ORIGIN || "http://localhost:3000",
        ];

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`❌ Origin ${origin} not allowed by CORS`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Access-Control-Allow-Origin",
      ],
      credentials: true,
      optionsSuccessStatus: 200,
      preflightContinue: false,
    };

    app.use(cors(corsOptions));
    app.use(express.json({ limit: "2mb", strict: true }));
    app.use(express.urlencoded({ extended: true, limit: "2mb" }));

    // ───────────── Middleware de monitoring temps de réponse ─────────────
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

    // ───────────── Middleware de logging ─────────────
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        logger.info(
          `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
        );
      });
      next();
    });

    // ───────────── Routes ─────────────
    app.use("/api/ai", aiRoutes);
    app.use("/metrics", metricsRoutes);

    // ───────────── Route de santé avec métriques ─────────────
    app.get("/health", async (req, res) => {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        services: {},
        version: "1.0.0",
      };

      // Vérifier data-service
      try {
        const axios = require("axios");
        const dataServiceUrl =
          process.env.DATA_SERVICE_URL || "http://localhost:5002";

        const response = await axios.get(`${dataServiceUrl}/api/health`, {
          timeout: 3000,
        });

        if (response.status === 200 && response.data.status === "healthy") {
          health.services.dataService = "healthy";
          externalServiceHealth.set({ service_name: "data-service" }, 1);
        } else {
          health.services.dataService = response.data.status || "unknown";
          health.status = "degraded";
          externalServiceHealth.set({ service_name: "data-service" }, 0);
        }
      } catch (error) {
        if (error.code === "ECONNREFUSED") {
          health.services.dataService = "unreachable";
          health.status = "degraded";
          externalServiceHealth.set({ service_name: "data-service" }, 0);
          logger.warn(`⚠️ Data-service unreachable: ${error.message}`);
        } else if (error.response?.status) {
          health.services.dataService = `error-${error.response.status}`;
          health.status = "degraded";
          externalServiceHealth.set({ service_name: "data-service" }, 0);
          logger.warn(`⚠️ Data-service error: ${error.message}`);
        } else {
          health.services.dataService = "timeout";
          health.status = "degraded";
          externalServiceHealth.set({ service_name: "data-service" }, 0);
          logger.warn(`⚠️ Data-service timeout: ${error.message}`);
        }
      }

      // Vérifier OpenAI API
      try {
        if (
          process.env.OPENAI_API_KEY &&
          process.env.OPENAI_API_KEY.startsWith("sk-")
        ) {
          health.services.openai = "configured";
          externalServiceHealth.set({ service_name: "openai" }, 1);
        } else {
          throw new Error("OpenAI API key not properly configured");
        }
      } catch (error) {
        health.services.openai = "misconfigured";
        health.status = "degraded";
        externalServiceHealth.set({ service_name: "openai" }, 0);
        logger.warn(`⚠️ OpenAI unhealthy: ${error.message}`);
      }

      // Vérifier API météo
      health.services.weather = process.env.WEATHER_API_KEY
        ? "configured"
        : "not-configured";
      externalServiceHealth.set(
        { service_name: "weather-api" },
        process.env.WEATHER_API_KEY ? 1 : 0
      );

      // Cache status
      const NodeCache = require("node-cache");
      try {
        const testCache = new NodeCache();
        const cacheStats = testCache.getStats();
        health.cache = {
          keys: cacheStats.keys,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate:
            cacheStats.hits > 0
              ? cacheStats.hits / (cacheStats.hits + cacheStats.misses)
              : 0,
        };

        cacheHitRate.set(health.cache.hitRate);
      } catch (error) {
        health.cache = { status: "error", message: error.message };
      }

      const isHealthy = health.status === "healthy" ? 1 : 0;
      serviceHealthStatus.set({ service_name: "ai-service" }, isHealthy);

      const statusCode = health.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(health);
    });

    app.get("/ping", (req, res) => {
      res.status(200).json({
        status: "pong ✅",
        timestamp: new Date().toISOString(),
        service: "ai-service",
        uptime: process.uptime(),
      });
    });

    // ───────────── Gestion 404 ─────────────
    app.use((req, res) => {
      logger.warn("📍 Route non trouvée", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(404).json({
        error: "Route non trouvée",
        message: `La route ${req.method} ${req.path} n'existe pas`,
        availableRoutes: [
          "GET /health",
          "GET /ping",
          "POST /api/ai/ask",
          "POST /api/ai/save",
          "GET /api/ai/history",
          "DELETE /api/ai/history",
          "GET /api/ai/conversation/:id",
          "DELETE /api/ai/conversation/:id",
          "GET /metrics",
        ],
        timestamp: new Date().toISOString(),
      });
    });

    // ───────────── Gestion d'erreurs globales ─────────────
    app.use((err, req, res, next) => {
      logger.error("💥 Erreur Express:", {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
      });

      // Erreurs spécifiques IA
      if (err.message && err.message.includes("OpenAI")) {
        return res.status(503).json({
          error: "Service IA temporairement indisponible",
          message: "L'assistant IA est actuellement indisponible",
          timestamp: new Date().toISOString(),
        });
      }

      // Erreurs d'authentification JWT
      if (err.name === "UnauthorizedError" || err.message.includes("token")) {
        return res.status(401).json({
          error: "Authentification requise",
          message: "Accès premium requis pour utiliser l'assistant IA",
          timestamp: new Date().toISOString(),
        });
      }

      // Erreurs de quota/rate limit
      if (err.status === 429) {
        return res.status(429).json({
          error: "Trop de requêtes",
          message: "Limite d'utilisation de l'IA atteinte, veuillez patienter",
          timestamp: new Date().toISOString(),
        });
      }

      // Erreurs CORS
      if (err.message && err.message.includes("CORS")) {
        return res.status(403).json({
          error: "Accès CORS non autorisé",
          message: "Origin non autorisée pour accéder à cette ressource",
          timestamp: new Date().toISOString(),
        });
      }

      // Erreurs de connexion aux services externes
      if (
        err.message &&
        (err.message.includes("data-service") ||
          err.message.includes("ECONNREFUSED"))
      ) {
        return res.status(503).json({
          error: "Service temporairement indisponible",
          message: "Un service externe est actuellement indisponible",
          timestamp: new Date().toISOString(),
        });
      }

      const statusCode = err.statusCode || err.status || 500;
      const message =
        process.env.NODE_ENV === "production" && statusCode === 500
          ? "Erreur serveur interne"
          : err.message || "Une erreur est survenue";

      res.status(statusCode).json({
        error: "Erreur serveur",
        message,
        timestamp: new Date().toISOString(),
        path: req.path,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
      });
    });

    // ───────────── Démarrage du serveur ─────────────
    app.listen(PORT, () => {
      console.log(`🤖 AI service démarré sur http://localhost:${PORT}`);
      logger.info(`🤖 AI service démarré sur http://localhost:${PORT}`);
      logger.info(`🔐 Environnement: ${process.env.NODE_ENV || "development"}`);
      logger.info(
        `🌐 CORS autorisé pour: ${
          process.env.CORS_ORIGIN || "http://localhost:3000"
        }`
      );
      logger.info(
        `📊 Métriques disponibles sur: http://localhost:${PORT}/metrics`
      );
      logger.info(
        `❤️ Health check disponible sur: http://localhost:${PORT}/health`
      );
      logger.info(`🧠 API IA disponible sur: http://localhost:${PORT}/api/ai`);
    });

    
  } catch (err) {
    console.error("❌ Erreur fatale au démarrage :", err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();

module.exports = app;
