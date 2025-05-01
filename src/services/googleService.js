import { LanguageServiceClient } from "@google-cloud/language";
import dotenv from "dotenv";
import { handleApiError } from "../utils/errorApi.js";
import path from "path";
import OpenAI from "openai";
import axios from "axios";

dotenv.config();

// Configuration des clients API
const keyPath = path.resolve("src/config/google-key.json");
const client = new LanguageServiceClient({
  keyFilename: keyPath,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// Fonction pour analyser le sentiment d'une description
export const googleAnalyzeService = async (text) => {
  try {
    if (!text) throw new Error("La description du roadtrip est vide.");

    const document = {
      content: text,
      type: "PLAIN_TEXT",
      language: "fr",
    };

    // Analyse du sentiment
    const [sentimentResult] = await client.analyzeSentiment({ document });

    // Analyse des entités (lieux, moyens de transport, activités)
    const [entityResult] = await client.analyzeEntities({ document });

    // Extraire les informations clés
    const locations = entityResult.entities
      .filter(entity => entity.type === "LOCATION")
      .map(entity => entity.name);
    
    const activities = entityResult.entities
      .filter(entity => ["EVENT", "CONSUMER_GOOD", "WORK_OF_ART"].includes(entity.type))
      .map(entity => entity.name);

    const dates = extractDatesFromText(text);
    
    // Vérifier si c'est un roadtrip et extraire le type de voyage
    const tripClassification = await classifyTripType(text);
    
    // Obtenir les conditions météorologiques pour les destinations
    const weatherInfo = await getWeatherForLocations(locations, dates);
    
    // Générer des recommandations personnalisées
    const recommendations = await generateRecommendations({
      locations,
      activities,
      dates,
      tripType: tripClassification.tripType,
      travelStyle: tripClassification.travelStyle,
      sentiment: sentimentResult.documentSentiment.score,
      weather: weatherInfo
    });

    return {
      type: "roadtrip_analysis",
      sentiment: {
        score: sentimentResult.documentSentiment.score,
        magnitude: sentimentResult.documentSentiment.magnitude,
        interpretation: interpretSentiment(sentimentResult.documentSentiment.score)
      },
      trip_classification: tripClassification,
      locations: locations.map(location => ({
        name: location,
        weather: weatherInfo[location] || null
      })),
      activities,
      travel_dates: dates,
      recommendations
    };
  } catch (error) {
    console.error("Erreur lors de l'analyse du roadtrip:", error);
    return handleApiError(error, "Roadtrip Analysis Service");
  }
};

// Fonction pour classer les types
const classifyTripType = async (text) => {
  try {
    // Types de voyage possibles
    const tripTypes = [
      "roadtrip urbain", "roadtrip nature", "roadtrip culturel", 
      "roadtrip gastronomique", "roadtrip historique", "roadtrip aventure"
    ];
    
    // Styles de voyage
    const travelStyles = [
      "luxe", "budget", "famille", "solo", "romantique", "entre amis", 
      "écologique", "sportif", "détente"
    ];

    // Utiliser un modèle IA pour classifier
    const prompt = `Analyse ce texte décrivant un voyage: "${text}". 
    Détermine le type de roadtrip parmi ces options: ${tripTypes.join(", ")}.
    Détermine également le style de voyage parmi ces options: ${travelStyles.join(", ")}.
    Réponds au format JSON avec deux propriétés: "tripType" et "travelStyle".`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      tripType: result.tripType,
      travelStyle: result.travelStyle,
      isRoadtrip: true
    };
  } catch (error) {
    console.error("Erreur lors de la classification du voyage:", error);
    return {
      tripType: "non déterminé",
      travelStyle: "non déterminé",
      isRoadtrip: false
    };
  }
};

// Extraire les dates mentionnées dans le texte
const extractDatesFromText = (text) => {
  // Regex pour détecter les formats de date courants en français
  const dateRegex = /\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b|\b(\d{1,2}) (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)( \d{2,4})?\b/gi;
  
  const matches = [...text.matchAll(dateRegex)];
  if (matches.length === 0) {
    // Si aucune date spécifique n'est trouvée, renvoyer la saison actuelle
    const today = new Date();
    const month = today.getMonth();
    let season;
    
    if (month >= 2 && month <= 4) season = "printemps";
    else if (month >= 5 && month <= 7) season = "été";
    else if (month >= 8 && month <= 10) season = "automne";
    else season = "hiver";
    
    return [season];
  }
  
  return matches.map(match => match[0]);
};

// Récupérer les prévisions météo pour chaque lieu identifié
const getWeatherForLocations = async (locations, dates) => {
  const weatherInfo = {};
  
  try {
    const weatherPromises = locations.map(async (location) => {
      try {
        // Définir la langue (français)
        const lang = "fr";
        
        // 1. Appel à l'API pour obtenir la météo actuelle
        const currentWeatherResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${WEATHER_API_KEY}&units=metric&lang=${lang}`
        );
        
        // 2. Appel à l'API pour obtenir les prévisions sur 5 jours
        const forecastResponse = await axios.get(
          `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${WEATHER_API_KEY}&units=metric&lang=${lang}`
        );
        
        // Traiter les données de prévision pour obtenir des prévisions quotidiennes
        // L'API renvoie des prévisions toutes les 3 heures, nous prenons une prévision par jour
        const dailyForecasts = [];
        const forecastList = forecastResponse.data.list;
        const processedDates = new Set();
        
        forecastList.forEach(forecast => {
          const forecastDate = forecast.dt_txt.split(' ')[0]; // Format YYYY-MM-DD
          
          // Si nous n'avons pas encore traité cette date et que c'est à midi (proche)
          if (!processedDates.has(forecastDate) && forecast.dt_txt.includes('12:00')) {
            processedDates.add(forecastDate);
            
            dailyForecasts.push({
              date: forecastDate,
              max_temp_c: forecast.main.temp_max,
              min_temp_c: forecast.main.temp_min,
              condition: forecast.weather[0].description,
              chance_of_rain: forecast.pop * 100 // Probabilité de précipitation en pourcentage
            });
          }
        });
        
        // Structurer les informations météo
        weatherInfo[location] = {
          current: {
            temp_c: currentWeatherResponse.data.main.temp,
            condition: currentWeatherResponse.data.weather[0].description,
            precipitation_mm: currentWeatherResponse.data.rain ? currentWeatherResponse.data.rain["1h"] || 0 : 0
          },
          forecast: dailyForecasts
        };
      } catch (error) {
        console.error(`Erreur lors de l'obtention de la météo pour ${location}:`, error);
        weatherInfo[location] = "Information météo non disponible";
      }
    });
    
    await Promise.all(weatherPromises);
    return weatherInfo;
  } catch (error) {
    console.error("Erreur lors de la récupération des données météo:", error);
    return {};
  }
};

// Génère des recommandations personnalisées basées sur l'analyse
const generateRecommendations = async (analysisData) => {
  try {
    const { locations, activities, dates, tripType, travelStyle, sentiment, weather } = analysisData;
    
    // Préparer les données météo pour le prompt
    const weatherSummary = Object.entries(weather)
      .map(([location, data]) => {
        if (typeof data === "string") return `${location}: ${data}`;
        return `${location}: ${data.current.condition}, ${data.current.temp_c}°C`;
      })
      .join("; ");
    
    const prompt = `En tant qu'expert en voyages roadtrip, génère des recommandations personnalisées pour un voyage de type "${tripType}" avec un style "${travelStyle}".
    
    Destinations: ${locations.join(", ")}
    Période: ${dates.join(", ")}
    Activités d'intérêt: ${activities.join(", ") || "non spécifiées"}
    Météo: ${weatherSummary || "information non disponible"}
    
    Réponds avec un JSON contenant ces sections:
    1. "itineraire": suggestions d'itinéraire optimisé entre les lieux
    2. "activites": 3-5 activités recommandées selon le type de voyage
    3. "hebergement": 2-3 types d'hébergement adaptés au style de voyage
    4. "conseils_pratiques": 3-5 conseils pratiques (équipement, logistique, etc.)
    5. "options_transport": recommandations sur les moyens de transport
    6. "budget": estimation de budget journalier selon le style de voyage`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Erreur lors de la génération des recommandations:", error);
    return {
      erreur: "Impossible de générer des recommandations personnalisées",
      message: error.message
    };
  }
};

// Interprète le score de sentiment en langage naturel
const interpretSentiment = (score) => {
  if (score >= 0.5) return "très enthousiaste";
  if (score >= 0.2) return "positif";
  if (score > -0.2 && score < 0.2) return "neutre";
  if (score <= -0.5) return "très négatif";
  return "plutôt négatif";
};