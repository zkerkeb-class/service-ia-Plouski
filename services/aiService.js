const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const NodeCache = require("node-cache");
const axios = require("axios");

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cache = new NodeCache({ stdTTL: 3600 });

// Validation du contenu roadtrip
const isRoadtripRelated = (query) => {
  try {
    if (!query || typeof query !== 'string') {
      return false;
    }

    const queryLower = query.toLowerCase().trim();
    
    const travelKeywords = [
      // Voyage général
      'voyage', 'voyager', 'partir', 'aller', 'visiter', 'trip', 'travel',
      'roadtrip', 'road trip', 'itinéraire', 'itinerary', 'route',
      
      // Destinations
      'pays', 'ville', 'région', 'destination', 'country', 'city',
      
      // Durée
      'jour', 'jours', 'semaine', 'semaines', 'mois', 'day', 'days', 'week', 'weeks', 'month',
      
      // Transport
      'voiture', 'conduire', 'rouler', 'car', 'drive', 'driving',
      
      // Hébergement
      'hébergement', 'hôtel', 'hotel', 'logement', 'dormir', 'rester',
      
      // Activités
      'voir', 'faire', 'activité', 'activités', 'visiter', 'découvrir',
      'restaurant', 'manger', 'culture', 'musée', 'monument',
      
      // Budget
      'budget', 'prix', 'coût', 'coûter', 'euro', 'euros', '€', 'money',
      
      // Noms de pays/régions populaires
      'france', 'espagne', 'italie', 'allemagne', 'portugal', 'maroc',
      'tunisie', 'grèce', 'croatie', 'suisse', 'belgique', 'pays-bas',
      'norvège', 'suède', 'danemark', 'islande', 'irlande', 'ecosse',
      'angleterre', 'pologne', 'république tchèque', 'hongrie', 'autriche',
      'europe', 'méditerranée', 'scandinavie', 'balkans'
    ];

    const hasKeyword = travelKeywords.some(keyword => 
      queryLower.includes(keyword)
    );

    const travelPatterns = [
      /\b(je|j'|nous|on)\s+(veux|voudrait|aimerais|aimerions|souhaite|projette|prévoit|pense)\s+.*(partir|aller|visiter|voir|découvrir)/i,
      /\b(où|comment|quand|combien)\s+.*(partir|aller|voyager|visiter)/i,
      /\b(itinéraire|programme|planning|plan)\s+.*(voyage|trip|roadtrip)/i,
      /\b(conseils?|suggestions?|recommandations?|idées?)\s+.*(voyage|destination|roadtrip)/i,
      /\b(budget|prix|coût)\s+.*(voyage|trip|roadtrip)/i,
      /\b(que|quoi)\s+.*(faire|voir|visiter)\s+.*(pendant|durant|lors)/i
    ];

    const hasPattern = travelPatterns.some(pattern => 
      pattern.test(queryLower)
    );

    console.log(`🔍 Validation roadtrip pour: "${query}"`);
    console.log(`   - Mots-clés détectés: ${hasKeyword}`);
    console.log(`   - Patterns détectés: ${hasPattern}`);
    
    return hasKeyword || hasPattern;
    
  } catch (error) {
    console.error("❌ Erreur dans isRoadtripRelated:", error.message);
    return false;
  }
};

// Extraction de la durée depuis la requête
const extractDurationFromQuery = (query) => {
  try {
    if (!query || typeof query !== 'string') {
      return null;
    }

    const queryLower = query.toLowerCase().trim();
    
    const monthKeywords = ['mois', 'month', 'months'];
    const weekKeywords = ['semaine', 'semaines', 'week', 'weeks'];
    const dayKeywords = ['jour', 'jours', 'day', 'days'];
    
    const numberMatches = queryLower.match(/\b(\d+)\b/g);
    if (!numberMatches || numberMatches.length === 0) {
      return null;
    }
    
    for (const numberStr of numberMatches) {
      const num = parseInt(numberStr, 10);
      
      if (isNaN(num) || num <= 0) {
        continue;
      }
      
      if (monthKeywords.some(keyword => queryLower.includes(keyword))) {
        return num * 30;
      }
      
      if (weekKeywords.some(keyword => queryLower.includes(keyword))) {
        return num * 7;
      }
      
      if (dayKeywords.some(keyword => queryLower.includes(keyword))) {
        return num;
      }
    }
    
    return null;
  } catch (error) {
    console.error("❌ Erreur dans extractDurationFromQuery:", error.message);
    return null;
  }
};

// Service principal pour générer un itinéraire de roadtrip personnalisé
const roadtripAdvisorService = async (options) => {
  try {
    const {
      query,
      location,
      duration,
      budget,
      travelStyle,
      interests = [],
      includeWeather = false,
    } = options;

    console.log("🔍 Requête reçue:", query);

    if (!isRoadtripRelated(query)) {
      console.log("❌ Requête non liée aux roadtrips détectée");
      return {
        type: "error",
        message: "❌ Je suis un assistant spécialisé dans les roadtrips et voyages. Je ne peux vous aider que pour planifier des itinéraires de voyage, conseiller des destinations, ou organiser des roadtrips. Pourriez-vous me poser une question liée aux voyages ?",
        error_type: "invalid_topic"
      };
    }

    let finalDuration = duration;
    
    if (!finalDuration && query) {
      finalDuration = extractDurationFromQuery(query);
      console.log("📅 Durée extraite:", finalDuration);
    }

    if (finalDuration && finalDuration > 14) {
      console.log("⚠️ Durée dépassée:", finalDuration, "jours > 14 jours");
      return {
        type: "error",
        message: "❌ La durée maximale pour un roadtrip est de 2 semaines (14 jours). Veuillez réduire la durée de votre voyage.",
        max_duration: 14,
        requested_duration: finalDuration
      };
    }

    const cacheKey = generateCacheKey(options);
    if (cache.has(cacheKey)) {
      console.log("✅ Réponse récupérée depuis le cache.");
      return cache.get(cacheKey);
    }

    let weatherInfo = null;
    let contextAddition = "";

    if (location && includeWeather) {
      weatherInfo = await getWeatherData(location);
      if (weatherInfo) {
        contextAddition += `Météo actuelle à ${location} : ${weatherInfo.condition}, ${weatherInfo.temperature}°C.`;
      }
    }

    const systemPrompt = createSystemPrompt({
      travelStyle,
      duration: finalDuration,
      budget,
      interests,
      contextAddition,
    });

    const userPrompt = query;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
      return { type: "error", message: "Aucune réponse générée." };
    }

    const parsed = JSON.parse(content);
    const finalResponse = {
      ...parsed,
      generated_at: new Date().toISOString(),
      location,
      ...(weatherInfo && {
        meteo_actuelle: {
          lieu: location,
          condition: weatherInfo.condition,
          temperature: `${weatherInfo.temperature}°C`,
        },
      }),
    };

    cache.set(cacheKey, finalResponse);
    return finalResponse;
  } catch (error) {
    console.error("❌ Erreur dans roadtripAdvisorService :", error.message);
    return {
      type: "error",
      message: "Erreur lors de la génération des recommandations.",
      error: error.message,
    };
  }
};

// Prompt système destiné à guider l'IA
const createSystemPrompt = ({
  travelStyle,
  duration,
  budget,
  interests,
  contextAddition,
}) => {
  let prompt = `
Tu es un expert en organisation de roadtrips. Génère un itinéraire structuré au format JSON suivant :

🚨 RÈGLE IMPORTANTE : La durée maximale pour un roadtrip est de 14 jours (2 semaines). Ne génère jamais d'itinéraires dépassant cette limite.

{
  "type": "roadtrip_itinerary",
  "destination": "Nom du pays ou région",
  "duree_recommandee": "X jours (maximum 14 jours)",
  "budget_estime": {
    "montant": "XXX€",
    "details": {
      "hebergement": "XX€/jour",
      "nourriture": "XX€/jour",
      "carburant": "XX€/jour",
      "activites": "XX€/jour"
    }
  },
  "saison_ideale": "Saison conseillée",
  "itineraire": [
    {
      "jour": 1,
      "trajet": "Ville de départ → Ville d'arrivée",
      "distance": "en km",
      "etapes_recommandees": ["Lieu 1", "Lieu 2"],
      "hebergement": "Type ou nom de logement",
      "activites": ["Activité 1", "Activité 2"]
    }
  ],
  "conseils_route": ["Conseil 1", "Conseil 2"],
  "equipement_essentiel": ["Objet 1", "Objet 2"],
  "meteo_actuelle": {
    "lieu": "Nom de la ville",
    "condition": "Ciel clair",
    "temperature": "25°C"
  }
}

Remplis le champ "meteo_actuelle" uniquement si des données météo sont fournies.

Utilise des lieux réels, donne des conseils utiles, et adapte les suggestions au climat si connu.`.trim();

  if (travelStyle) prompt += `\nStyle : ${travelStyle}.`;
  if (duration) prompt += `\nDurée : ${duration} jours (maximum 14 jours autorisés).`;
  if (budget) prompt += `\nBudget : ${budget}€.`;
  if (interests.length) prompt += `\nIntérêts : ${interests.join(", ")}.`;
  if (contextAddition) {
    prompt += `\n\nInformations supplémentaires à prendre en compte :\n${contextAddition}\n`;
    prompt += `Incorpore ces informations dans l'itinéraire, les activités ou les conseils.`;
  }

  return prompt;
};

// Génère une clé de cache
const generateCacheKey = (options) => {
  return `roadtrip_${Buffer.from(
    JSON.stringify({
      query: options.query,
      location: options.location,
      duration: options.duration,
      budget: options.budget,
      travelStyle: options.travelStyle,
      interests: (options.interests || []).sort(),
    })
  ).toString("base64")}`;
};

// Récupère la météo actuelle via OpenWeatherMap
const getWeatherData = async (location) => {
  try {
    const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
    if (!WEATHER_API_KEY) return null;

    const { data } = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      {
        params: {
          q: location,
          appid: WEATHER_API_KEY,
          units: "metric",
          lang: "fr",
        },
      }
    );

    return {
      condition: data.weather[0].description,
      temperature: data.main.temp,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la récupération météo :", error.message);
    return null;
  }
};

module.exports = { roadtripAdvisorService };