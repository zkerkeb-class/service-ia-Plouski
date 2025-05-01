import axios from "axios";
import dotenv from "dotenv";
import NodeCache from "node-cache";
import logger from "../utils/logger.js";
import { handleApiError } from "../utils/errorApi.js";

dotenv.config();

// Configuration du cache avec différentes TTL
const cache = new NodeCache({ 
  stdTTL: 600,          // 10 minutes pour les données normales
  checkperiod: 60,      // Vérification toutes les minutes
  useClones: false      // Pour économiser de la mémoire
});

// Cache de secours pour les données de fallback (plus longue durée)
const fallbackCache = new NodeCache({ 
  stdTTL: 86400 * 7,    // 7 jours
  checkperiod: 3600,    // Vérification toutes les heures
  useClones: false
});

const weatherApiKey = process.env.WEATHER_API_KEY;

export const weatherService = async (city, options = {}) => {
  try {
    // Vérification que city est définie et est une chaîne
    if (!city || typeof city !== 'string') {
      throw new Error("Veuillez fournir un nom de ville valide.");
    }

    // Utilisation sécurisée de toLowerCase()
    const cityName = city.toLowerCase();
    const cacheKey = `weather_${cityName}`;
    
    const { forceFresh = false } = options;
    
    // Vérifier le cache
    if (!forceFresh && cache.has(cacheKey)) {
      console.log("Cache utilisé !");
      return cache.get(cacheKey);
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${weatherApiKey}&units=metric&lang=fr`;
    const response = await axios.get(url, { timeout: 5000 }); // Timeout de 5 secondes
    const weatherData = response.data;

    const formattedDate = new Date(weatherData.dt * 1000).toLocaleString("fr-FR");

    const result = {
      type: "weather",
      date: formattedDate,
      city: weatherData.name,
      temperature: weatherData.main.temp,
      weather: weatherData.weather[0].description,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
    };

    // Stockage dans les deux caches
    cache.set(cacheKey, result);
    fallbackCache.set(cacheKey, result);

    logger.info(`Données météo actualisées pour ${city}`);

    return result;
  } catch (error) {
    console.error("Erreur dans l'appel à l'API OpenWeather :", error);
    
    // Message d'erreur plus spécifique
    if (!city || typeof city !== 'string') {
      return handleApiError(new Error("Le nom de ville est invalide ou non fourni"), "OpenWeather");
    }

    // Log de l'erreur
    logger.error(`Erreur dans l'appel à l'API OpenWeather pour ${city}:`, error);
    
    // Tentative de récupération depuis le fallback cache
    return getFallbackWeatherData(city);
  }
};

const getFallbackWeatherData = (city) => {
  const cacheKey = `weather_${city.toLowerCase()}`;
  
  // Vérifier si des données existent dans le cache de secours
  if (fallbackCache.has(cacheKey)) {
    const cachedData = fallbackCache.get(cacheKey);
    return {
      ...cachedData,
      source: "fallback_cache",
      note: "Ces données peuvent ne pas être à jour en raison d'une erreur de connexion à l'API météo."
    };
  }
  
  // Générer des données synthétiques basées sur la saison si aucune donnée n'est disponible
  const now = new Date();
  const month = now.getMonth();
  let seasonalTemp, seasonalWeather;
  
  // Estimations très approximatives basées sur les saisons en Europe
  if (month >= 11 || month <= 1) {
    // Hiver
    seasonalTemp = Math.floor(Math.random() * 10) - 5; // -5 à 5°C
    seasonalWeather = "ciel nuageux";
  } else if (month >= 2 && month <= 4) {
    // Printemps
    seasonalTemp = 10 + Math.floor(Math.random() * 10); // 10 à 20°C
    seasonalWeather = "partiellement nuageux";
  } else if (month >= 5 && month <= 8) {
    // Été
    seasonalTemp = 20 + Math.floor(Math.random() * 15); // 20 à 35°C
    seasonalWeather = "ensoleillé";
  } else {
    // Automne
    seasonalTemp = 5 + Math.floor(Math.random() * 15); // 5 à 20°C
    seasonalWeather = "pluie légère";
  }
  
  return {
    type: "weather",
    date: new Date().toLocaleString("fr-FR"),
    city: city,
    temperature: seasonalTemp,
    weather: seasonalWeather,
    humidity: 70 + Math.floor(Math.random() * 20), // 70-90%
    windSpeed: Math.floor(Math.random() * 20), // 0-20 km/h
    source: "synthetic",
    note: "Ces données sont des estimations basées sur la saison actuelle et ne sont pas des données météo réelles."
  };
};

export default weatherService;