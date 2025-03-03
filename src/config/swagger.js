import swaggerUi from "swagger-ui-express";

// Spécification Swagger directement intégrée dans le code
const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "API de Service Roadtrip IA",
    version: "1.0.0",
    description:
      "API permettant d'analyser et de recommander des itinéraires de roadtrip avec des outils d'intelligence artificielle",
  },
  servers: [
    {
      url: "/ia",
      description: "Serveur actuel",
    },
  ],
  tags: [
    {
      name: "Roadtrip",
      description: "Opérations liées aux roadtrips",
    },
    {
      name: "Météo",
      description: "Opérations liées à la météo",
    },
    {
      name: "Analyse",
      description: "Opérations d'analyse de texte",
    },
  ],
  paths: {
    "/roadtrip": {
      post: {
        summary: "Génère des conseils pour un roadtrip",
        description:
          "Utilise l'IA pour analyser la demande et produire des recommandations personnalisées pour un roadtrip",
        tags: ["Roadtrip"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: {
                    type: "string",
                    description:
                      "Description ou question sur le roadtrip souhaité",
                    example:
                      "Je veux faire un roadtrip en Normandie pendant 5 jours",
                  },
                  location: {
                    type: "string",
                    description: "Destination principale (optionnel)",
                    example: "Normandie",
                  },
                  duration: {
                    type: "number",
                    description: "Durée du voyage en jours (optionnel)",
                    example: 5,
                  },
                  budget: {
                    type: "string",
                    description: "Budget disponible (optionnel)",
                    example: "moyen",
                  },
                  travelStyle: {
                    type: "string",
                    description: "Style de voyage préféré (optionnel)",
                    example: "culturel",
                  },
                  interests: {
                    type: "array",
                    description: "Centres d'intérêt (optionnel)",
                    items: {
                      type: "string",
                    },
                    example: ["histoire", "gastronomie"],
                  },
                  includeWeather: {
                    type: "boolean",
                    description: "Inclure les informations météo (optionnel)",
                    example: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Recommandations générées avec succès",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          example: "roadtrip_itinerary",
                        },
                        destination: {
                          type: "string",
                          example: "Normandie",
                        },
                        duree_recommandee: {
                          type: "string",
                          example: "5 jours",
                        },
                        budget_estime: {
                          type: "object",
                          properties: {
                            montant: {
                              type: "string",
                              example: "800€",
                            },
                            details: {
                              type: "object",
                              properties: {
                                hebergement: {
                                  type: "string",
                                  example: "80€/jour",
                                },
                                nourriture: {
                                  type: "string",
                                  example: "40€/jour",
                                },
                                carburant: {
                                  type: "string",
                                  example: "30€/jour",
                                },
                                activites: {
                                  type: "string",
                                  example: "20€/jour",
                                },
                              },
                            },
                          },
                        },
                        saison_ideale: {
                          type: "string",
                          example: "Printemps/Été",
                        },
                        itineraire: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              jour: {
                                type: "number",
                                example: 1,
                              },
                              trajet: {
                                type: "string",
                                example: "Caen → Bayeux (30 km)",
                              },
                              temps_conduite: {
                                type: "string",
                                example: "30 minutes",
                              },
                              etapes_recommandees: {
                                type: "array",
                                items: {
                                  type: "string",
                                },
                                example: [
                                  "Mémorial de Caen",
                                  "Tapisserie de Bayeux",
                                ],
                              },
                              hebergement: {
                                type: "string",
                                example: "Hôtel à Bayeux",
                              },
                              activites: {
                                type: "array",
                                items: {
                                  type: "string",
                                },
                                example: [
                                  "Visite guidée du centre historique",
                                  "Dégustation de cidre",
                                ],
                              },
                            },
                          },
                        },
                        conseils_route: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                          example: [
                            "Évitez l'A13 pendant les heures de pointe",
                            "Prévoyez des pauses toutes les 2 heures",
                          ],
                        },
                        equipement_essentiel: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                          example: [
                            "Imperméable",
                            "Chaussures de marche",
                            "Appareil photo",
                          ],
                        },
                      },
                    },
                    {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          example: "roadtrip_advice",
                        },
                        sujet: {
                          type: "string",
                          example: "Roadtrip en Normandie",
                        },
                        reponse: {
                          type: "string",
                          example:
                            "La Normandie est une destination idéale pour un roadtrip de 5 jours. La région offre un riche patrimoine historique, de magnifiques paysages côtiers et une gastronomie réputée.",
                        },
                        recommandations: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                          example: [
                            "Visitez les plages du débarquement",
                            "Ne manquez pas le Mont-Saint-Michel",
                            "Goûtez aux spécialités locales comme le camembert",
                          ],
                        },
                        ressources_utiles: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                          example: [
                            "Office de tourisme de Normandie",
                            "Application Normandie Secrets",
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: "Requête invalide",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "error",
                    },
                    message: {
                      type: "string",
                      example: "La requête est vide ou invalide",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Erreur interne du serveur",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "error",
                    },
                    message: {
                      type: "string",
                      example:
                        "Erreur lors de la génération des recommandations",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/weather/{city}": {
      get: {
        summary: "Récupère les données météo pour une ville",
        description:
          "Fournit les conditions météorologiques actuelles pour la ville spécifiée",
        tags: ["Météo"],
        parameters: [
          {
            in: "path",
            name: "city",
            required: true,
            description: "Nom de la ville",
            schema: {
              type: "string",
            },
            example: "Paris",
          },
          {
            in: "query",
            name: "fresh",
            description:
              "Force la récupération de données fraîches (ignore le cache)",
            schema: {
              type: "boolean",
            },
            example: false,
          },
        ],
        responses: {
          200: {
            description: "Données météo récupérées avec succès",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "weather",
                    },
                    date: {
                      type: "string",
                      example: "03/03/2025, 10:15:30",
                    },
                    city: {
                      type: "string",
                      example: "Paris",
                    },
                    temperature: {
                      type: "number",
                      example: 15.2,
                    },
                    weather: {
                      type: "string",
                      example: "partiellement nuageux",
                    },
                    humidity: {
                      type: "number",
                      example: 75,
                    },
                    windSpeed: {
                      type: "number",
                      example: 12.5,
                    },
                    source: {
                      type: "string",
                      description: "Source des données météo",
                      example: "api",
                    },
                    note: {
                      type: "string",
                      description:
                        "Informations supplémentaires sur les données (présent uniquement pour les données de fallback)",
                      example:
                        "Ces données peuvent ne pas être à jour en raison d'une erreur de connexion à l'API météo.",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Requête invalide",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "error",
                    },
                    message: {
                      type: "string",
                      example: "Le paramètre 'city' est requis",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Erreur interne du serveur",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "error",
                    },
                    message: {
                      type: "string",
                      example:
                        "Erreur lors de la récupération des données météo",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/analyze": {
      post: {
        summary: "Analyse un texte de roadtrip",
        description:
          "Utilise Google Cloud Natural Language API pour analyser le sentiment et les entités dans un texte",
        tags: ["Analyse"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: {
                    type: "string",
                    example:
                      "Je suis très enthousiaste à l'idée de faire un roadtrip en Bretagne cet été.",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Analyse réalisée avec succès",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "roadtrip_analysis",
                    },
                    sentiment: {
                      type: "object",
                      properties: {
                        score: {
                          type: "number",
                          example: 0.8,
                        },
                        magnitude: {
                          type: "number",
                          example: 1.5,
                        },
                        interpretation: {
                          type: "string",
                          example: "très enthousiaste",
                        },
                      },
                    },
                    trip_classification: {
                      type: "object",
                      properties: {
                        tripType: {
                          type: "string",
                          example: "roadtrip côtier",
                        },
                        travelStyle: {
                          type: "string",
                          example: "famille",
                        },
                        isRoadtrip: {
                          type: "boolean",
                          example: true,
                        },
                      },
                    },
                    locations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            example: "Bretagne",
                          },
                          weather: {
                            type: "object",
                            nullable: true,
                          },
                        },
                      },
                    },
                    activities: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                      example: ["visite", "randonnée"],
                    },
                    travel_dates: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                      example: ["été"],
                    },
                    recommendations: {
                      type: "object",
                      properties: {
                        itineraire: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                        },
                        activites: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                        },
                        hebergement: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                        },
                        conseils_pratiques: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                        },
                        options_transport: {
                          type: "array",
                          items: {
                            type: "string",
                          },
                        },
                        budget: {
                          type: "object",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Texte manquant ou invalide",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "error",
                    },
                    message: {
                      type: "string",
                      example: "La description du roadtrip est vide.",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Erreur lors de l'analyse du texte",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      example: "error",
                    },
                    message: {
                      type: "string",
                      example: "Erreur lors de l'analyse du texte",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const setupSwagger = (app) => {
  try {
    const swaggerUiOptions = {
      explorer: true,
    };
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, swaggerUiOptions)
    );

    console.log("📚 Documentation API disponible sur /api-docs");
  } catch (error) {
    console.error("Erreur lors de la configuration de Swagger:", error);
    console.log("⚠️ La documentation API ne sera pas disponible");
  }
};

export default setupSwagger;
