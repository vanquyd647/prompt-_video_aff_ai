import type { AppSettings } from "@/types";

export const API_KEY_STORAGE = "fashion-prompt-builder:gemini-api-key";
export const SETTINGS_STORAGE = "fashion-prompt-builder:settings";

export const DEFAULT_SETTINGS: AppSettings = { modelId: "gemini-2.5-flash", aspectRatio: "9:16", language: "Vietnamese", detailLevel: "Standard", autosave: true };

export function loadSettings(): AppSettings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE) ?? "{}") }; }
  catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
}
