import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import compression from "compression";
import apiRoutes from "./routes/apiRoutes.js";
import { validateApiKeys } from "./middlewares/apiKeyValidator.js";
import { requestLogger, errorLogger } from "./utils/logger.js";
import logger from "./utils/logger.js";
import { setupSwagger } from "./config/swagger.js";
import fs from "fs";
import path from "path";

// Charger les variables d'environnement
dotenv.config();

// Vérifier les clés API requises
validateApiKeys();

// Créer l'application Express
const app = express();

// Middleware de base
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet()); // Sécurisation des en-têtes HTTP
app.use(compression()); // Compression des réponses

// Middleware de logging des requêtes
app.use(requestLogger);

// Limiteur de taux de requêtes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limite chaque IP à 100 requêtes par fenêtre de 15 min
    standardHeaders: true, // Retourner info rate limit dans les en-têtes
    legacyHeaders: false, // Désactiver les anciens en-têtes X-RateLimit
    message: "Trop de requêtes. Veuillez réessayer plus tard.",
    skipSuccessfulRequests: false // Compter aussi les requêtes réussies
});

// Assurer que les dossiers requis existent
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    logger.info(`Répertoire créé: ${directory}`);
  }
};

ensureDirectoryExists(path.join(process.cwd(), 'logs'));

// Configurer Swagger avant les routes
setupSwagger(app);

// Configurer les routes
app.use("/ia", apiLimiter, apiRoutes);

// Route racine pour vérifier que le serveur fonctionne
app.get("/", (req, res) => {
  res.json({
    message: "API de Service Roadtrip IA",
    status: "online",
    documentation: "/api-docs",
    version: process.env.npm_package_version || "1.0.0"
  });
});

// Middleware pour gérer les erreurs
app.use(errorLogger);
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    type: "error",
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Middleware pour gérer les routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    type: "error",
    message: "Route non trouvée"
  });
});

// Lancement du serveur
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`🚀 Serveur lancé sur http://localhost:${PORT}`);
  logger.info(`📚 Documentation API disponible sur http://localhost:${PORT}/api-docs`);
});