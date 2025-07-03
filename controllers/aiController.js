const { roadtripAdvisorService } = require("../services/aiService.js");
const dataService = require("../services/dataService");
const {
  aiRequestsTotal,
  aiResponseTime
} = require("../services/metricsService");
const logger = require("../utils/logger.js");

/* Demande à l'IA un conseil personnalisé de roadtrip */
const askRoadtripAdvisor = async (req, res) => {
  const { prompt, query, ...params } = req.body;
  const input = prompt || query;

  if (!input) {
    return res.status(400).json({ error: "Le champ 'prompt' est requis." });
  }

  const start = process.hrtime();
  
  try {
    aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'started' });

    const result = await roadtripAdvisorService({ query: input, ...params });

    const [s, ns] = process.hrtime(start);
    const seconds = s + ns / 1e9;
    aiResponseTime.observe({ type: 'roadtrip_advisor' }, seconds);

    // 🔧 CORRECTION : Distinguer les erreurs de validation des vraies erreurs
    if (result.type === 'error') {
      // Vérifier si c'est une erreur de validation (durée dépassée)
      if (result.max_duration && result.requested_duration) {
        // C'est une erreur de validation de durée - Status 200 avec le message d'erreur
        aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'validation_error' });
        
        return res.status(200).json({
          role: 'assistant',
          content: result.message,
          userId: params.userId,
          conversationId: params.conversationId,
          error: true,
          errorType: 'validation_duration',
          details: result
        });
      } else if (result.error_type === 'invalid_topic') {
        // C'est une erreur de sujet non valide - Status 200 avec le message d'erreur
        aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'invalid_topic' });
        
        return res.status(200).json({
          role: 'assistant',
          content: result.message,
          userId: params.userId,
          conversationId: params.conversationId,
          error: true,
          errorType: 'invalid_topic',
          details: result
        });
      } else {
        // C'est une vraie erreur technique - Status 500
        aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'failed' });
        logger.error("💥 Erreur technique dans roadtripAdvisorService:", result);
        return res.status(500).json(result);
      }
    }

    // Succès - Formater la réponse
    const formattedContent = formatRoadtripResponse(result);
    
    const response = {
      role: 'assistant',
      content: formattedContent,
      userId: params.userId,
      conversationId: params.conversationId
    };

    aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'success' });
    res.status(200).json(response);

  } catch (error) {
    aiRequestsTotal.inc({ type: 'roadtrip_advisor', status: 'failed' });
    logger.error("💥 Erreur IA:", error);
    res.status(500).json({ error: "Erreur serveur IA." });
  }
};

// 🔧 NOUVELLE FONCTION : Formater la réponse roadtrip
const formatRoadtripResponse = (result) => {
  if (result.type === 'error') {
    return result.message;
  }
  
  // Formatage selon votre style existant
  let formatted = `\n✨ **ROADTRIP : ${result.destination?.toUpperCase()}**\n`;
  formatted += `🗓️ Durée recommandée : **${result.duree_recommandee}**\n`;
  formatted += `📅 Saison idéale : **${result.saison_ideale}**\n`;
  formatted += `💰 Budget estimé : **${result.budget_estime?.montant}**\n\n`;
  
  if (result.meteo_actuelle) {
    formatted += `🌤️ **Météo à ${result.meteo_actuelle.lieu}**\n`;
    formatted += `   🌤️ ${result.meteo_actuelle.condition}, ${result.meteo_actuelle.temperature}\n\n`;
  }
  
  if (result.budget_estime?.details) {
    formatted += `📊 **Répartition du budget :**\n`;
    formatted += `   🏨 Hébergement : ${result.budget_estime.details.hebergement}\n`;
    formatted += `   🍽️ Nourriture : ${result.budget_estime.details.nourriture}\n`;
    formatted += `   ⛽ Carburant : ${result.budget_estime.details.carburant}\n`;
    formatted += `   🎯 Activités : ${result.budget_estime.details.activites}\n\n`;
  }
  
  formatted += `🗺️ **ITINÉRAIRE DÉTAILLÉ**\n───\n\n`;
  
  if (result.itineraire && Array.isArray(result.itineraire)) {
    result.itineraire.forEach((jour) => {
      formatted += `📍 **Jour ${jour.jour} :** ${jour.trajet}\n`;
      formatted += `   📏 Distance : ${jour.distance}\n`;
      
      if (jour.etapes_recommandees && Array.isArray(jour.etapes_recommandees)) {
        formatted += `   🎯 Étapes recommandées :\n`;
        jour.etapes_recommandees.forEach(etape => {
          formatted += `     • ${etape}\n`;
        });
      }
      
      if (jour.activites && Array.isArray(jour.activites)) {
        formatted += `   🎨 Activités proposées :\n`;
        jour.activites.forEach(activite => {
          formatted += `     • ${activite}\n`;
        });
      }
      
      formatted += `   🏨 Hébergement suggéré : ${jour.hebergement}\n`;
      formatted += `\n🔸🔸🔸\n\n`;
    });
  }
  
  if (result.conseils_route && Array.isArray(result.conseils_route)) {
    formatted += `💡 **CONSEILS PRATIQUES**\n───\n`;
    result.conseils_route.forEach(conseil => {
      formatted += `🔸 ${conseil}\n`;
    });
    formatted += `\n`;
  }
  
  if (result.equipement_essentiel && Array.isArray(result.equipement_essentiel)) {
    formatted += `🎒 **ÉQUIPEMENT ESSENTIEL**\n───\n`;
    result.equipement_essentiel.forEach(equipement => {
      formatted += `✅ ${equipement}\n`;
    });
  }
  
  return formatted;
};

/* Sauvegarde un message de conversation */
const saveConversation = async (req, res) => {
  const { role, content, conversationId } = req.body;
  const userId = req.user?.userId;

  if (!role || !content || !conversationId) {
    return res.status(400).json({ error: "Données de conversation incomplètes." });
  }

  try {
    const message = await dataService.createMessage({ 
      role, 
      content,
      userId, 
      conversationId 
    });

    res.status(201).json({ success: true, message });

  } catch (error) {
    logger.error("💥 Erreur saveConversation :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

/* Récupère tout l'historique des conversations utilisateur */
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

/* Supprime tout l'historique des conversations utilisateur */
const deleteHistory = async (req, res) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "Non authentifié." });
  }

  try {
    await dataService.deleteMessagesByUser(userId);
    
    logger.info(`Historique supprimé pour utilisateur: ${userId}`);
    res.status(200).json({ success: true });

  } catch (error) {
    logger.error("💥 Erreur deleteHistory :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

/* Récupère une conversation spécifique par ID */
const getConversationById = async (req, res) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.userId;

  if (!conversationId) {
    return res.status(400).json({ error: "ID de conversation manquant." });
  }

  try {
    const messages = await dataService.getMessagesByConversation(userId, conversationId);
    
    res.status(200).json(messages);

  } catch (error) {
    logger.error("💥 Erreur getConversationById :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

/* Supprime une conversation spécifique */
const deleteConversation = async (req, res) => {
  const { id: conversationId } = req.params;
  const userId = req.user?.userId;

  if (!conversationId) {
    return res.status(400).json({ error: "ID de conversation manquant." });
  }
  
  if (!userId) {
    return res.status(401).json({ error: "Non authentifié." });
  }

  try {
    await dataService.deleteConversation(userId, conversationId);
    
    logger.info(`Conversation supprimée: ${conversationId} pour utilisateur: ${userId}`);
    res.status(200).json({ 
      success: true, 
      message: "Conversation supprimée avec succès." 
    });

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