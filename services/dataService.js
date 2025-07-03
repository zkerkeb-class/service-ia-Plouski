const axios = require('axios');

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:5002';

// Créer un nouveau message
const createMessage = async (messageData) => {
  const response = await axios.post(`${DATA_SERVICE_URL}/api/messages`, messageData);
  return response.data;
};

// Récupérer tous les messages d'un utilisateur
const getMessagesByUser = async (userId) => {
  const response = await axios.get(`${DATA_SERVICE_URL}/api/messages/user/${userId}`);
  return response.data;
};

// Récupérer tous les messages d'une conversation spécifique
const getMessagesByConversation = async (userId, conversationId) => {
  const response = await axios.get(`${DATA_SERVICE_URL}/api/messages/conversation/${conversationId}`, {
    params: { userId }
  });
  return response.data;
};

// Supprimer tous les messages d'un utilisateur
const deleteMessagesByUser = async (userId) => {
  const response = await axios.delete(`${DATA_SERVICE_URL}/api/messages/user/${userId}`);
  return response.data;
};

// Supprimer tous les messages d'une conversation spécifique
const deleteConversation = async (userId, conversationId) => {
  const response = await axios.delete(`${DATA_SERVICE_URL}/api/messages/conversation/${conversationId}`, {
    params: { userId } 
  });
  return response.data;
};

module.exports = {
  createMessage,
  getMessagesByUser,
  getMessagesByConversation,
  deleteMessagesByUser,
  deleteConversation,
};
