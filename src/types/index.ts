export type OutputLanguage = "Vietnamese" | "English" | "Bilingual";
export type DetailLevel = "Compact" | "Standard" | "Detailed";
export type BodyReferenceConfidence = "low" | "medium" | "high";

export interface AppSettings {
  modelId: string;
  aspectRatio: string;
  language: OutputLanguage;
  detailLevel: DetailLevel;
  autosave: boolean;
}

export interface UploadedImage {
  id: string;
  file: File;
  width?: number;
  height?: number;
  previewUrl: string;
}

export interface StoredImage {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  width?: number;
  height?: number;
  blob: Blob;
}

export interface PromptGenerationResult {
  analysis: {
    model: {
      identitySummary: string;
      faceSummary: string;
      hairSummary: string;
      bodySummary: string;
      bodyReferenceConfidence: BodyReferenceConfidence;
    };
    product: {
      category: string;
      description: string;
      colors: string[];
      materials: string[];
      constructionDetails: string[];
      distinctiveFeatures: string[];
      confidenceNotes: string[];
    };
    background: {
      source: "slot3" | "slot2-fallback" | "generated";
      description: string;
      lighting: string;
      spatialNotes: string[];
    };
    userNotes: { normalizedInstructions: string[] };
  };
  masterPrompt: { title: string; prompt: string };
  keyframes: Array<{
    index: number;
    title: string;
    poseSummary: string;
    bodyDirection: string;
    faceDirection: string;
    camera: string;
    prompt: string;
  }>;
  consistencyRules: string[];
  warnings: string[];
  version?: number;
}

export type VideoPromptMode = "single" | "transition";

export interface VideoPromptResult {
  title: string;
  prompt: string;
  summary: {
    subjectContinuity: string;
    poseTransition: string;
    transitionEffect: string;
  };
  warnings: string[];
}

export interface PromptHistoryItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  modelId: string;
  settings: AppSettings;
  references: {
    model?: StoredImage;
    products: StoredImage[];
    background?: StoredImage;
  };
  notes: string;
  result: PromptGenerationResult;
}

export interface PoseDiversityScore {
  score: number;
  issues: string[];
}
