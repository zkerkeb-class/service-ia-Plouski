const express = require("express");
const router = express.Router();

const aiController = require("../controllers/aiController");
const { authMiddleware, roleMiddleware } = require("../middlewares/authMiddleware");

// Définir l'accès réservé aux utilisateurs premium ou administrateurs
const premiumAccess = roleMiddleware(["premium", "admin"]);

// Poser une question à l'assistant IA
router.post("/ask", authMiddleware, premiumAccess, aiController.askRoadtripAdvisor);

// Sauvegarder un message dans l'historique
router.post("/save", authMiddleware, premiumAccess, aiController.saveConversation);

// Récupérer l'historique complet d'un utilisateur
router.get("/history", authMiddleware, premiumAccess, aiController.getHistory);

// Supprimer l'historique complet d'un utilisateur
router.delete("/history", authMiddleware, premiumAccess, aiController.deleteHistory);

// Récupérer une conversation spécifique par ID
router.get("/conversation/:id", authMiddleware, premiumAccess, aiController.getConversationById);

// Supprimer une conversation spécifique par ID
router.delete("/conversation/:id", authMiddleware, premiumAccess, aiController.deleteConversation);

module.exports = router;
