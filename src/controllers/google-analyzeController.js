import { googleAnalyzeService } from "../services/googleService.js";

export const analyzeController = async (req, res) => {
  try {
    const { query } = req.body;
    const response = await googleAnalyzeService(query);
    res.json(response);
  } catch (error) {
    console.error("Erreur d'analyze :", error);
    res.status(500).json({ error: "Erreur lors de l'analyze des sentiments", message: error.message });
  }
};