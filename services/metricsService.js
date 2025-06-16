const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;

const register = new Registry();
collectDefaultMetrics({ register });

// Métriques HTTP
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Nombre total de requêtes HTTP',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpDurationHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Métriques IA
const aiRequestsTotal = new client.Counter({
  name: 'ai_requests_total',
  help: 'Nombre total de requêtes à l\'assistant IA',
  labelNames: ['type', 'status'],
  registers: [register],
});

const aiResponseTime = new client.Histogram({
  name: 'ai_response_time_seconds',
  help: 'Temps de réponse des requêtes IA',
  labelNames: ['type'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Métriques cache
const cacheHitRate = new client.Gauge({
  name: 'ai_cache_hit_rate',
  help: 'Taux de succès du cache IA',
  registers: [register],
});

// Métriques de santé
const serviceHealthStatus = new client.Gauge({
  name: 'service_health_status',
  help: 'État de santé du service (1=healthy, 0=unhealthy)',
  labelNames: ['service_name'],
  registers: [register],
});

const externalServiceHealth = new client.Gauge({
  name: 'external_service_health',
  help: 'État de santé des services externes (1=up, 0=down)',
  labelNames: ['service_name'],
  registers: [register],
});

module.exports = {
  register,
  httpRequestsTotal,
  httpDurationHistogram,
  aiRequestsTotal,
  aiResponseTime,
  cacheHitRate,
  serviceHealthStatus,
  externalServiceHealth,
};