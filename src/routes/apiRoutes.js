import express from "express";
import { roadtripController } from "../controllers/roadtripController.js";
import { weatherController } from "../controllers/weatherController.js";
import { analyzeController } from "../controllers/google-analyzeController.js";
import { requestLogger } from "../utils/logger.js";

const router = express.Router();

router.use(requestLogger);

router.post("/roadtrip", roadtripController);
router.get("/weather/:city", weatherController);
router.post("/analyze", analyzeController);

export default router;
