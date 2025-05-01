import { openaiService } from "../services/openaiService.js";

export const roadtripController = async (req, res) => {
  try {
    const { query } = req.body;
    const response = await openaiService(query);
    res.json(response);
  } catch (error) {
    console.error("Erreur de roadtrip:", error);
    res.status(500).json({ error: "Erreur lors du traitement de votre demande de voyage.", message: error.message });
  }
};
