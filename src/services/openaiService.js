import { OpenAI } from "openai";
import dotenv from "dotenv";
import { handleApiError } from "../utils/errorApi.js";
import NodeCache from "node-cache";
import axios from "axios";

dotenv.config();

// Configuration du cache avec une durée de vie plus longue pour les réponses génériques
const cache = new NodeCache({ 
  stdTTL: 3600, // 1 heure pour les réponses générales
  checkperiod: 120 // Vérification toutes les 2 minutes
});

// Initialisation du client OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Service principal pour les conseils de roadtrip
export const roadtripAdvisorService = async (options) => {
  try {
    const { 
      query, 
      location = null, 
      duration = null, 
      budget = null, 
      travelStyle = null,
      interests = [],
      includeWeather = false,
      includeAttractions = true,
      includeDrivingTips = true
    } = options;

    // Création d'une clé de cache unique basée sur tous les paramètres
    const cacheKey = generateCacheKey(options);
    
    // Vérifier le cache sauf pour les requêtes spécifiques à un lieu avec météo
    if (cache.has(cacheKey) && (!location || !includeWeather)) {
      console.log("Utilisation des données en cache pour la requête");
      return cache.get(cacheKey);
    }

    // Enrichir la requête avec des données météorologiques si demandé
    let enrichedContext = "";
    if (location && includeWeather) {
      const weatherData = await getWeatherData(location);
      if (weatherData) {
        enrichedContext = `\nInformations météo actuelles pour ${location}: ${weatherData.condition}, ${weatherData.temperature}°C, précipitations: ${weatherData.precipitation}mm, vent: ${weatherData.windSpeed}km/h.`;
      }
    }

    // Obtenir des attractions populaires si demandé
    if (location && includeAttractions) {
      const attractions = await getPopularAttractions(location);
      if (attractions && attractions.length > 0) {
        enrichedContext += `\nAttractions populaires à proximité de ${location}: ${attractions.join(", ")}.`;
      }
    }
    
    // Créer le prompt système enrichi
    const systemPrompt = createSystemPrompt(travelStyle, duration, budget, interests, includeDrivingTips);
    
    // Générer la réponse via l'API OpenAI
    const assistantResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `${query}${enrichedContext ? `\n\nContexte supplémentaire: ${enrichedContext}` : ""}` 
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const responseText = assistantResponse?.choices?.[0]?.message?.content;
    if (!responseText) {
      return {
        type: "error",
        message: "Aucune réponse valide reçue de l'IA."
      };
    }

    // Traiter et enrichir la réponse si nécessaire
    const rawResponse = JSON.parse(responseText);
    const processedResponse = postProcessResponse(rawResponse, options);
    
    // Mettre en cache sauf si données météo incluses (qui changent régulièrement)
    if (!includeWeather) {
      cache.set(cacheKey, processedResponse);
    }

    return processedResponse;
  } catch (error) {
    console.error("Erreur dans le service de conseils roadtrip:", error);
    return handleApiError(error, "RoadtripAdvisor");
  }
};

export const openaiService = async (query) => {
  return roadtripAdvisorService({ query });
};

const createSystemPrompt = (travelStyle, duration, budget, interests, includeDrivingTips) => {
  let prompt = `Tu es un conseiller expert en roadtrips avec plus de 20 ans d'expérience. 
Tu aides les voyageurs à planifier des roadtrips parfaits et personnalisés en fonction de leurs besoins spécifiques.

Réponds TOUJOURS au format JSON avec une structure adaptée au type de demande :

Pour les itinéraires de roadtrip :
{
  "type": "roadtrip_itinerary",
  "destination": "Nom de la région/pays",
  "duree_recommandee": "X jours",
  "budget_estime": {
    "montant": "XXX€",
    "details": { "hebergement": "XX€/jour", "nourriture": "XX€/jour", "carburant": "XX€/jour", "activites": "XX€/jour" }
  },
  "saison_ideale": "Printemps/Été/Automne/Hiver",
  "itineraire": [
    { 
      "jour": 1, 
      "trajet": "Ville A → Ville B (XXX km)", 
      "temps_conduite": "X heures", 
      "etapes_recommandees": ["Point d'intérêt 1", "Point d'intérêt 2"],
      "hebergement": "Type d'hébergement recommandé",
      "activites": ["Activité 1", "Activité 2"]
    }
  ],
  "conseils_route": ["Conseil 1", "Conseil 2"],
  "equipement_essentiel": ["Équipement 1", "Équipement 2"]
}

Pour les conseils généraux ou recommandations :
{
  "type": "roadtrip_advice",
  "sujet": "Sujet de la question",
  "reponse": "Ta réponse détaillée",
  "recommandations": ["Recommandation 1", "Recommandation 2"],
  "ressources_utiles": ["Ressource 1", "Ressource 2"]
}`;

  // Personnaliser le prompt selon les informations disponibles
  if (travelStyle) {
    prompt += `\n\nL'utilisateur préfère un voyage de style: ${travelStyle}. Adapte tes recommandations en conséquence.`;
  }
  
  if (duration) {
    prompt += `\n\nL'utilisateur envisage un voyage d'environ ${duration} jours. Propose un itinéraire adapté à cette durée.`;
  }
  
  if (budget) {
    prompt += `\n\nL'utilisateur a un budget d'environ ${budget}. Veille à ce que tes suggestions soient abordables.`;
  }
  
  if (interests && interests.length > 0) {
    prompt += `\n\nL'utilisateur s'intéresse particulièrement à: ${interests.join(", ")}. Mets l'accent sur ces centres d'intérêt.`;
  }

  if (includeDrivingTips) {
    prompt += `\n\nInclus toujours des conseils pratiques de conduite spécifiques à la région, comme la signalisation routière locale, les limitations de vitesse, les règles de stationnement, et les précautions de sécurité.`;
  }

  return prompt;
};

//Génère une clé de cache unique basée sur tous les paramètres de la requête
const generateCacheKey = (options) => {
  const { 
    query, 
    location, 
    duration, 
    budget, 
    travelStyle,
    interests,
    includeWeather,
    includeAttractions
  } = options;
  
  return `roadtrip_${Buffer.from(JSON.stringify({
    q: query,
    loc: location,
    dur: duration,
    bud: budget,
    sty: travelStyle,
    int: interests ? interests.sort().join('') : '',
    att: includeAttractions
  })).toString('base64')}`;
};

//Récupère les données météo pour une localisation
const getWeatherData = async (location) => {
  try {
    const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
    if (!WEATHER_API_KEY) {
      console.warn("Clé API météo non configurée");
      return null;
    }
    
    // Définir la langue en français
    const lang = "fr";
    
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${WEATHER_API_KEY}&units=metric&lang=${lang}`
    );
    
    // Structure adaptée à l'API OpenWeatherMap
    return {
      condition: response.data.weather[0].description,
      temperature: response.data.main.temp,
      precipitation: response.data.rain ? response.data.rain["1h"] || 0 : 0,
      windSpeed: (response.data.wind.speed * 3.6) // Conversion de m/s en km/h
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération des données météo pour ${location}:`, error);
    return null;
  }
};

// Post-traitement de la réponse pour ajouter des informations complémentaires
const postProcessResponse = (response, options) => {
  // Ajouter des métadonnées sur la demande
  const enrichedResponse = {
    ...response,
    metadata: {
      generated_at: new Date().toISOString(),
      query_parameters: {
        location: options.location || "non spécifié",
        duration: options.duration || "non spécifié",
        budget: options.budget || "non spécifié",
        style: options.travelStyle || "standard"
      }
    }
  };
  
  // Ajouter des recommandations supplémentaires selon le type de roadtrip
  if (response.type === "roadtrip_itinerary" && !response.apps_recommandees) {
    enrichedResponse.apps_recommandees = [
      { nom: "Maps.me", description: "Cartes hors ligne avec navigation" },
      { nom: "GasBuddy", description: "Trouver les stations-service les moins chères" },
      { nom: "Roadtrippers", description: "Planification d'itinéraire avec points d'intérêt" },
      { nom: "iOverlander", description: "Emplacements de camping et aires de repos" },
      { nom: "Waze", description: "Navigation avec alertes trafic en temps réel" }
    ];
  }
  
  return enrichedResponse;
};

// Service spécifique pour les recommandations d'itinéraires multi-étapes
export const getDetailedRoadtripItinerary = async (options) => {
  const { startPoint, endPoint, waypoints = [], duration, travelStyle, interests = [] } = options;
  
  if (!startPoint || !endPoint) {
    return {
      type: "error",
      message: "Les points de départ et d'arrivée sont requis pour générer un itinéraire."
    };
  }
  
  try {
    // Construire une requête détaillée pour l'itinéraire
    const queryText = `Crée un itinéraire de roadtrip détaillé de ${startPoint} à ${endPoint} 
      ${waypoints.length > 0 ? `en passant par ${waypoints.join(', ')}` : ''} 
      pour un voyage de ${duration || '7'} jours 
      ${travelStyle ? `de style ${travelStyle}` : ''}
      ${interests.length > 0 ? `avec intérêt pour ${interests.join(', ')}` : ''}.
      Inclus les distances entre les étapes, les temps de conduite estimés, et les attractions incontournables.`;
      
    // Utiliser le service principal avec des options spécifiques
    return roadtripAdvisorService({
      query: queryText,
      includeDrivingTips: true,
      includeAttractions: true,
      includeWeather: true
    });
  } catch (error) {
    console.error("Erreur lors de la génération de l'itinéraire détaillé:", error);
    return handleApiError(error, "DetailedItineraryService");
  }
};