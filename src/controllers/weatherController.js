import { weatherService } from "../services/weatherService.js";

export const weatherController = async (req, res) => {
  try {
    const city = req.params && req.params.city;

    console.log(`Requête météo reçue pour la ville: "${city}"`);
    
    if (!city || city.trim() === "") {
      return res.status(400).json({
        type: "error",
        message: "Le paramètre 'city' est requis",
      });
    }

    const options = {
      forceFresh: req.query.fresh === "true",
    };

    const result = await weatherService(city, options);
    res.json(result);
  } catch (error) {
    console.error("Erreur de météo:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des données météo", message: error.message });
  }
};

export default weatherController;
