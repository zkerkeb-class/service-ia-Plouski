# 🔧 Configuration des Variables d'Environnement - RoadTrip Microservices

## 📋 Vue d'ensemble

Ce guide détaille la configuration des variables d'environnement pour l'architecture microservices RoadTrip.

## 🚀 Configuration Rapide (Minimum pour démarrer)

### 1. Variables Globales Obligatoires

Créez ces variables dans **TOUS** les services :

```bash
# JWT (OBLIGATOIRE - même valeur partout)
JWT_SECRET=roadTripTopSecret2024-super-secure-key
JWT_REFRESH_SECRET=roadTripRefreshSecret2024-ultra-secure

# Base de données (OBLIGATOIRE)
MONGODB_URI=mongodb://localhost:27017/roadtrip-dev
MONGO_URI=mongodb://localhost:27017/roadtrip-dev

# Environnement
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### 2. Variables par Service

#### AI Service (Port 5003)
```bash
# ai-service/.env
PORT=5003
SERVICE_NAME=ai-service
OPENAI_API_KEY=sk-your-openai-key-here
DATA_SERVICE_URL=http://localhost:5002
WEATHER_API_KEY=your-openweathermap-key
```

## 📁 Fichiers .env.example Complets par Service

### ai-service/.env.example
```bash
# Configuration de base
NODE_ENV=development
PORT=5003
SERVICE_NAME=ai-service

# JWT (OBLIGATOIRE)
JWT_SECRET=roadTripTopSecret2024-super-secure-key
JWT_REFRESH_SECRET=roadTripRefreshSecret2024-ultra-secure
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# APIs (OBLIGATOIRE pour l'IA)
OPENAI_API_KEY=sk-your-openai-api-key-here
WEATHER_API_KEY=your-openweathermap-api-key

# Services
DATA_SERVICE_URL=http://localhost:5002
FRONTEND_URL=http://localhost:3000
```

## 🔑 Obtenir les Clés API

### OpenAI (AI Service)
1. Aller sur [platform.openai.com](https://platform.openai.com)
2. Créer un compte et ajouter des crédits
3. Aller dans API Keys
4. Créer une nouvelle clé : `sk-...`

### OpenWeather (AI Service)
1. Aller sur [openweathermap.org](https://openweathermap.org)
2. Créer un compte gratuit
3. Aller dans API Keys
4. Récupérer votre clé gratuite

## 📦 Installation et Démarrage

### 1. Cloner et installer
```bash
git clone <votre-repo>
cd roadtrip-microservices

# Pour chaque service
cd auth-service && npm install && cd ..
cd data-service && npm install && cd ..
cd ai-service && npm install && cd ..
cd paiement-service && npm install && cd ..
cd notification-service && npm install && cd ..
cd metrics-service && npm install && cd ..
```

### 2. Créer les fichiers .env
```bash
# Copier les .env.example et les remplir
cp auth-service/.env.example auth-service/.env
cp data-service/.env.example data-service/.env
cp ai-service/.env.example ai-service/.env
cp paiement-service/.env.example paiement-service/.env
cp notification-service/.env.example notification-service/.env
cp metrics-service/.env.example metrics-service/.env

# Éditer chaque fichier avec vos vraies clés API
```

### 3. Démarrer avec Docker
```bash
# Lancer tout l'écosystème
docker-compose up -d

# Ou lancer service par service
docker-compose up -d mongodb prometheus grafana
docker-compose up -d data-service notification-service
docker-compose up -d auth-service ai-service paiement-service
docker-compose up -d metrics-service
```

### 4. Démarrer en développement
```bash
# Terminal 1 - MongoDB
mongod

# Terminal 2 - Data Service (en premier)
cd data-service && npm run dev

# Terminal 3 - Notification Service
cd notification-service && npm run dev

# Terminal 4 - Auth Service
cd auth-service && npm run dev

# Terminal 5 - AI Service
cd ai-service && npm run dev

# Terminal 6 - Payment Service
cd paiement-service && npm run dev

# Terminal 7 - Metrics Service
cd metrics-service && npm run dev
```

## 🧪 Tester la Configuration

### Health Checks
```bash
# Vérifier que tous les services répondent
curl http://localhost:5001/health  # Auth
curl http://localhost:5002/health  # Data
curl http://localhost:5003/health  # AI
curl http://localhost:5004/health  # Payment
curl http://localhost:5005/health  # Notification
curl http://localhost:5006/health  # Metrics
```

### Tests de fonctionnalité
```bash
# Test Data Service
cd data-service && npm test

# Test Notification Service
cd notification-service && npm test
```

## 🔒 Sécurité en Production

### Variables à changer absolument :
```bash
# Remplacer par des valeurs sécurisées
JWT_SECRET=super-secure-random-string-64-chars-minimum
JWT_REFRESH_SECRET=another-super-secure-random-string-64-chars
SESSION_SECRET=yet-another-secure-random-string

# Utiliser HTTPS et vrais domaines
FRONTEND_URL=https://votre-domaine.com
CORS_ORIGIN=https://votre-domaine.com

# MongoDB sécurisé
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/roadtrip

# Environnement production
NODE_ENV=production
LOG_LEVEL=warn
```

## 🆘 Dépannage

### Problèmes courants

1. **Service ne démarre pas**
   - Vérifiez que MongoDB est lancé
   - Vérifiez les variables JWT_SECRET

2. **Erreurs d'authentification**
   - Vérifiez que JWT_SECRET est identique partout
   - Vérifiez les URLs des services

3. **Erreurs de CORS**
   - Vérifiez CORS_ORIGIN dans tous les services
   - Vérifiez FRONTEND_URL

4. **AI Service ne fonctionne pas**
   - Vérifiez OPENAI_API_KEY
   - Vérifiez les crédits OpenAI

5. **Emails ne partent pas**
   - Vérifiez MAILJET_API_KEY et SECRET
   - Vérifiez EMAIL_FROM_ADDRESS

### Logs utiles
```bash
# Voir les logs d'un service
docker-compose logs -f service-name

# En développement
cd service-name && npm run dev
```

## 📞 Support

Si vous avez des problèmes :
1. Vérifiez les health checks de tous les services
2. Consultez les logs pour identifier l'erreur
3. Vérifiez que toutes les clés API sont valides
4. Assurez-vous que MongoDB est accessible

---

**Ordre de démarrage recommandé :** MongoDB → Data Service → Notification Service → Auth Service → AI Service → Payment Service → Metrics Service
