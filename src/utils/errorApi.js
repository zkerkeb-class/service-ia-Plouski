export const handleApiError = (error, serviceName) => {
    if (error.response) {
        console.error(`[${serviceName} API Error]`, error.response.data);
        return { success: false, message: `Erreur ${serviceName}: ${error.response.statusText}` };
    } else if (error.request) {
        console.error(`[${serviceName} API Error]`, "Aucune réponse reçue.");
        return { success: false, message: `Erreur ${serviceName}: Aucune réponse reçue.` };
    } else {
        console.error(`[${serviceName} Error]`, error.message);
        return { success: false, message: `Erreur ${serviceName}: ${error.message}` };
    }
};
