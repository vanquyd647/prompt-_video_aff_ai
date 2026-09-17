import type { PromptGenerationResult } from "@/types";
import { FASHION_POSE_COUNT } from "../prompts/fashion-defaults";

export function parseGeminiResponse(raw: string): PromptGenerationResult {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Gemini trả về JSON không hợp lệ. Hãy thử tạo lại.");
    try { value = JSON.parse(cleaned.slice(start, end + 1)); }
    catch { throw new Error("Gemini trả về JSON không hợp lệ. Hãy thử tạo lại."); }
  }
  if (!value || typeof value !== "object") throw new Error("Phản hồi Gemini trống hoặc không hợp lệ.");
  const result = value as PromptGenerationResult;
  if (!result.masterPrompt?.prompt?.trim()) throw new Error("Phản hồi thiếu prompt tham chiếu chính.");
  if (result.analysis?.background?.source !== "slot3") throw new Error("Gemini phải dùng đúng ảnh 03 — Bối cảnh, không được tự thay bằng cảnh khác. Hãy thử tạo lại.");
  if (!Array.isArray(result.keyframes) || result.keyframes.length !== FASHION_POSE_COUNT) throw new Error("Gemini phải trả về chính xác 4 khung hình trong một ảnh 9:16.");
  const sorted = [...result.keyframes].sort((a, b) => a.index - b.index);
  if (sorted.some((item, i) => item.index !== i + 1 || !item.prompt?.trim())) throw new Error("Khung hình không đầy đủ hoặc sai thứ tự.");
  return { ...result, keyframes: sorted, version: result.version ?? 1 };
}
