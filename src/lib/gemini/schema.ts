import { FASHION_POSE_COUNT } from "../prompts/fashion-defaults";
import type { VideoPromptMode } from "@/types";

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
            identitySummary: { type: "string" }, faceSummary: { type: "string" }, hairSummary: { type: "string" }, bodySummary: { type: "string", description: "Observed Slot 1 body shape and relative dimensions, unchanged. Include numerical measurements only if explicitly supplied by the user; state what is not visible, without inventing or idealizing body proportions." },
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
            source: { type: "string", enum: ["slot3"] }, description: { type: "string", description: "Exact supplied Slot 3 setting, preserving architecture, objects, materials, colors and relative placement; no generated or substituted scene." }, lighting: { type: "string" }, spatialNotes: { type: "array", items: { type: "string" } },
          },
        },
        userNotes: { type: "object", required: ["normalizedInstructions"], properties: { normalizedInstructions: { type: "array", items: { type: "string" } } } },
      },
    },
    masterPrompt: { type: "object", required: ["title", "prompt"], properties: { title: { type: "string" }, prompt: { type: "string" } } },
    keyframes: {
      type: "array", minItems: FASHION_POSE_COUNT, maxItems: FASHION_POSE_COUNT,
      description: "Exactly four panel prompts in order: front (top-left), back (top-right), front three-quarter (bottom-left), slay (bottom-right), within one 9:16 composite image.",
      items: { type: "object", required: ["index", "title", "poseSummary", "bodyDirection", "faceDirection", "camera", "prompt"], properties: {
        index: { type: "integer", minimum: 1, maximum: FASHION_POSE_COUNT }, title: { type: "string" }, poseSummary: { type: "string" }, bodyDirection: { type: "string" }, faceDirection: { type: "string" }, camera: { type: "string" }, prompt: { type: "string" },
      } },
    },
    consistencyRules: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } },
  },
};

export function getVideoPromptSchema(mode: VideoPromptMode) {
  const single = mode === "single";
  return {
    type: "object",
    required: ["title", "prompt", "summary", "warnings"],
    properties: {
      title: { type: "string" },
      prompt: { type: "string", description: `Standalone fit-check hook video prompt explicitly preserving model identity, body proportions, background and all visible product details, requiring no speech, voice-over or lip-sync. ${single ? "Animate only the supplied single image in one continuous sharp shot, no transition or blur bridge, no invented second reference." : "Move between the two supplied poses with exactly one short soft-blur bridge and no other transition effects."}` },
      summary: {
        type: "object",
        required: ["subjectContinuity", "poseTransition", "transitionEffect"],
        properties: {
          subjectContinuity: { type: "string", description: "How the same model identity and exact visible product details remain unchanged throughout the video." },
          poseTransition: { type: "string", description: single ? "A small natural non-speaking fit-check movement from the single reference pose, with a natural settling pose; no supplied end frame." : "The natural, non-speaking fit-check hook movement from the opening pose to the closing pose." },
          transitionEffect: { type: "string", description: single ? "One continuous sharp shot with no transition effect or blur bridge." : "Exactly one very short smooth soft-blur bridge between the two poses." },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
    },
  };
}
