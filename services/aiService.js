const { OpenAI } = require("openai");
const dotenv = require("dotenv");
const NodeCache = require("node-cache");
const axios = require("axios");

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cache = new NodeCache({ stdTTL: 3600 });

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
      duration,
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

// Prompt système destiné à guider l’IA
const createSystemPrompt = ({
  travelStyle,
  duration,
  budget,
  interests,
  contextAddition,
}) => {
  let prompt = `
Tu es un expert en organisation de roadtrips. Génère un itinéraire structuré au format JSON suivant :

{
  "type": "roadtrip_itinerary",
  "destination": "Nom du pays ou région",
  "duree_recommandee": "X jours",
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
  if (duration) prompt += `\nDurée : ${duration} jours.`;
  if (budget) prompt += `\nBudget : ${budget}€.`;
  if (interests.length) prompt += `\nIntérêts : ${interests.join(", ")}.`;
  if (contextAddition) {
    prompt += `\n\nInformations supplémentaires à prendre en compte :\n${contextAddition}\n`;
    prompt += `Incorpore ces informations dans l’itinéraire, les activités ou les conseils.`;
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