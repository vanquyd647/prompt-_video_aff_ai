export const RESPONSE_SCHEMA = {
  type: "object",
  required: ["analysis", "masterPrompt", "keyframes", "consistencyRules", "warnings"],
  properties: {
    analysis: {
      type: "object",
      required: ["model", "product", "background", "userNotes"],
      properties: {
        model: {
          type: "object",
          required: ["identitySummary", "faceSummary", "hairSummary", "bodySummary", "bodyReferenceConfidence"],
          properties: {
            identitySummary: { type: "string" }, faceSummary: { type: "string" }, hairSummary: { type: "string" }, bodySummary: { type: "string" },
            bodyReferenceConfidence: { type: "string", enum: ["low", "medium", "high"] },
          },
        },
        product: {
          type: "object",
          required: ["category", "description", "colors", "materials", "constructionDetails", "distinctiveFeatures", "confidenceNotes"],
          properties: {
            category: { type: "string" }, description: { type: "string" },
            colors: { type: "array", items: { type: "string" } }, materials: { type: "array", items: { type: "string" } },
            constructionDetails: { type: "array", items: { type: "string" } }, distinctiveFeatures: { type: "array", items: { type: "string" } }, confidenceNotes: { type: "array", items: { type: "string" } },
          },
        },
        background: {
          type: "object",
          required: ["source", "description", "lighting", "spatialNotes"],
          properties: {
            source: { type: "string", enum: ["slot3", "slot2-fallback", "generated"] }, description: { type: "string" }, lighting: { type: "string" }, spatialNotes: { type: "array", items: { type: "string" } },
          },
        },
        userNotes: { type: "object", required: ["normalizedInstructions"], properties: { normalizedInstructions: { type: "array", items: { type: "string" } } } },
      },
    },
    masterPrompt: { type: "object", required: ["title", "prompt"], properties: { title: { type: "string" }, prompt: { type: "string" } } },
    keyframes: {
      type: "array", minItems: 5, maxItems: 5,
      items: { type: "object", required: ["index", "title", "poseSummary", "bodyDirection", "faceDirection", "camera", "prompt"], properties: {
        index: { type: "integer", minimum: 1, maximum: 5 }, title: { type: "string" }, poseSummary: { type: "string" }, bodyDirection: { type: "string" }, faceDirection: { type: "string" }, camera: { type: "string" }, prompt: { type: "string" },
      } },
    },
    consistencyRules: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } },
  },
};
