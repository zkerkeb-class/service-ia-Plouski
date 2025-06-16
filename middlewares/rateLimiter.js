const rateLimit = require('express-rate-limit');

const basicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Trop de requêtes. Réessayez plus tard.",
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = basicLimiter;