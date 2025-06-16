const { roadtripAdvisorService } = require("../services/aiService.js");
const dataService = require("../services/dataService");
const {
  aiRequestsTotal,
  aiResponseTime
} = require("../services/metricsService");
const logger = require("../utils/logger.js");

// Demande à l'IA un conseil personnalisé
const askRoadtripAdvisor = async (req, res) => {
  const { prompt, query, ...params } = req.body;
  const input = prompt || query;

  if (!input) return res.status(400).json({ error: "Le champ 'prompt' est requis." });

  const start = process.hrtime();
  try {
    aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'started' });

    const result = await roadtripAdvisorService({ query: input, ...params });

    const [s, ns] = process.hrtime(start);
    const seconds = s + ns / 1e9;
    aiResponseTime.observe({ type: 'roadtrip_advisor' }, seconds);

    if (result.type === 'error') {
      aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'failed' });
      return res.status(500).json(result);
    }

    aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'success' });
    res.status(200).json(result);
  } catch (error) {
    aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'failed' });
    logger.error("💥 Erreur IA:", error);
    res.status(500).json({ error: "Erreur serveur IA." });
  }
};

// Sauvegarder un message de conversation
const saveConversation = async (req, res) => {
  const { role, content, conversationId } = req.body;
  const userId = req.user?.userId;

  if (!role || !content || !conversationId) {
    return res.status(400).json({ error: "Données de conversation incomplètes." });
  }

  try {
    const message = await dataService.createMessage({ role, content, userId, conversationId });
    res.status(201).json({ success: true, message });
  } catch (error) {
    logger.error("💥 Erreur saveConversation :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Récupérer tout l'historique utilisateur
const getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const messages = await dataService.getMessagesByUser(userId);

    const grouped = messages.reduce((acc, msg) => {
      const id = msg.conversationId || "default";
      acc[id] = acc[id] || [];
      acc[id].push(msg);
      return acc;
    }, {});

    res.status(200).json(grouped);
  } catch (error) {
    logger.error("💥 Erreur getHistory :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Supprimer tout l'historique utilisateur
const deleteHistory = async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Non authentifié." });

  try {
    await dataService.deleteMessagesByUser(userId);
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("💥 Erreur deleteHistory :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Récupérer une conversation spécifique
const getConversationById = async (req, res) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.userId;

  if (!conversationId) return res.status(400).json({ error: "ID manquant." });

  try {
    const messages = await dataService.getMessagesByConversation(userId, conversationId);
    res.status(200).json(messages);
  } catch (error) {
    logger.error("💥 Erreur getConversationById :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Supprimer une conversation spécifique
const deleteConversation = async (req, res) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.userId;

  if (!conversationId) return res.status(400).json({ error: "ID manquant." });
  if (!userId) return res.status(401).json({ error: "Non authentifié." });

  try {
    await dataService.deleteConversation(userId, conversationId);
    res.status(200).json({ success: true, message: "Conversation supprimée." });
  } catch (error) {
    logger.error("💥 Erreur deleteConversation :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

module.exports = {
  askRoadtripAdvisor,
  saveConversation,
  getHistory,
  deleteHistory,
  getConversationById,
  deleteConversation,
};
