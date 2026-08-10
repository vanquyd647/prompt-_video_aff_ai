export interface GeminiModelOption {
  id: string;
  label: string;
  recommended?: boolean;
  freeTierHint?: boolean;
  description?: string;
  available?: boolean;
}

export const GEMINI_MODEL_OPTIONS: GeminiModelOption[] = [
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    recommended: true,
    freeTierHint: true,
    description: "Stable multimodal model with structured output support.",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    description: "Advanced multimodal reasoning; availability depends on your project.",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    description: "Fast structured extraction for high-volume workflows.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    freeTierHint: true,
    description: "Budget-friendly multimodal option.",
  },
];

export const RATE_LIMITS_URL = "https://aistudio.google.com/app/rate-limit?timeRange=last-28-days";
