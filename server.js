import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import axios from 'axios';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const weather = process.env.WEATHER_API_KEY;

// Route pour obtenir des informations sur un roadtrip
app.post("/ia/roadtrip", async (req, res) => {
  try {
    const { query } = req.body;

    const assistantResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Tu es un expert en voyages et en roadtrips. Tu fournis des conseils personnalisés sur tous les aspects du voyage : itinéraires, budget, hébergement, transports, attractions, gastronomie locale, astuces pratiques, et plus encore.
            
            Pour les questions spécifiques sur des itinéraires, fournis une réponse JSON structurée selon ce format : 
            {
              "type": "itinerary",
              "destination": "Nom du pays ou région",
              "durée": "Nombre de jours recommandés",
              "budget": "Budget total estimé",
              "itinéraire": [
                { "jour": 1, "lieu": "Ville", "activités": ["Activité 1", "Activité 2"] }
              ],
              "conseils": ["Conseil 1", "Conseil 2"]
            }
            
            Pour les questions générales, conseils ou recommandations, fournis une réponse JSON structurée selon ce format :
            {
              "type": "advice",
              "sujet": "Sujet de la question",
              "réponse": "Ta réponse détaillée",
              "suggestions": ["Suggestion 1", "Suggestion 2"]
            }`,
        },
        {
          role: "user",
          content: query,
        },
      ],
    });

    const jsonResponse = JSON.parse(
      assistantResponse.choices[0].message.content
    );
    res.json(jsonResponse);
  } catch (error) {
    console.error("Erreur originale:", error);

    if (error instanceof SyntaxError) {
      try {
        const textResponse = {
          type: "text",
          réponse: error.message.includes("JSON")
            ? assistantResponse.choices[0].message.content
            : "Désolé, une erreur est survenue lors du traitement de votre demande.",
        };
        return res.json(textResponse);
      } catch (innerError) {
        console.error("Erreur secondaire:", innerError);
      }
    }

    res.status(500).json({
      error: "Erreur lors du traitement de votre demande de voyage.",
      message: error.message,
    });
  }
});

// Route pour obtenir la météo d'une ville
app.post("/ia/weather", async (req, res) => {
  try {
    const { city } = req.body;

    if (!city) {
      return res.status(400).json({ error: "Veuillez fournir une ville." });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${weather}&units=metric&lang=fr`
    );

    const weatherData = response.data;

    const weatherInfo = {
      type: "weather",
      city: weatherData.name,
      temperature: weatherData.main.temp,
      description: weatherData.weather[0].description,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
    };

    res.json(weatherInfo);
  } catch (error) {
    console.error("Erreur de l'API météo:", error);
    res
      .status(500)
      .json({
        error: "Erreur lors de la récupération des données météo.",
        message: error.message,
      });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`)
);
