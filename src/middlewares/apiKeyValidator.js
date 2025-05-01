import dotenv from "dotenv";

dotenv.config();

export const validateApiKeys = () => {
  const requiredKeys = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'WEATHER_API_KEY': process.env.WEATHER_API_KEY,
    'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  };

  const missingKeys = [];
  
  for (const [keyName, keyValue] of Object.entries(requiredKeys)) {
    if (!keyValue) {
      missingKeys.push(keyName);
    }
  }
  
  if (missingKeys.length > 0) {
    console.error("🔑 ERREUR DE CONFIGURATION: Clés API manquantes:");
    missingKeys.forEach(key => console.error(`- ${key}`));
    console.error("Veuillez configurer ces clés dans votre fichier .env");
    
    // En développement, on peut se contenter d'un avertissement
    return false;
  }
  
  console.log("✅ Toutes les clés API requises sont configurées");
  return true;
};