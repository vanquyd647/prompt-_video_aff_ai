import { FASHION_SYSTEM_INSTRUCTION, VIDEO_SYSTEM_INSTRUCTION } from "./system-instruction";
import { RESPONSE_SCHEMA, VIDEO_PROMPT_SCHEMA } from "./schema";
import { parseGeminiResponse } from "./response-parser";
import { applyDefaultFashionPlan, attachLockedPoseBlueprint, DEFAULT_FASHION_MASTER_PROMPT, DEFAULT_FASHION_POSES } from "@/lib/prompts/fashion-defaults";
import type { AppSettings, PromptGenerationResult, UploadedImage, VideoPromptResult } from "@/types";

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

export class GeminiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly technical?: string) { super(message); }
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function imagePart(image: UploadedImage): Promise<GeminiPart> {
  return { inline_data: { mime_type: image.file.type, data: await fileToBase64(image.file) } };
}

function errorMessage(status: number, body: string): string {
  if (status === 429) return "Model này đã chạm hạn mức hoặc giới hạn tốc độ của Gemini. Hãy thử model khác hoặc kiểm tra giới hạn trong AI Studio.";
  if (status === 401 || status === 403) return "API key không hợp lệ hoặc project chưa có quyền truy cập model này.";
  if (status === 404) return "Không tìm thấy model đã chọn. Hãy làm mới danh sách model và chọn model khác.";
  if (status >= 500) return "Gemini tạm thời không khả dụng. Hãy thử lại sau.";
  return body ? "Gemini không thể xử lý yêu cầu này. Hãy kiểm tra ảnh và thử lại." : "Không nhận được phản hồi từ Gemini.";
}

export async function generatePromptSet(args: {
  apiKey: string; model: UploadedImage; products: UploadedImage[]; background?: UploadedImage;
  notes: string; settings: AppSettings; signal?: AbortSignal;
}): Promise<PromptGenerationResult> {
  const parts: GeminiPart[] = [
    { text: `Create the requested fashion prompt set.\n\nCURRENT UI SETTINGS\nOutput language: ${args.settings.language}\nPrompt detail: ${args.settings.detailLevel}\nAspect ratio: 9:16 (locked for this image workflow)\n\nREFERENCE SLOT 1 — MODEL IDENTITY` },
    await imagePart(args.model),
    { text: "REFERENCE SLOT 2 — PRODUCT REFERENCES. Synthesize all images into one coherent product specification. Ignore people in these images." },
  ];
  for (const product of args.products) parts.push(await imagePart(product));
  if (args.background) parts.push({ text: "REFERENCE SLOT 3 — BACKGROUND" }, await imagePart(args.background));
  else parts.push({ text: "REFERENCE SLOT 3 — BACKGROUND: No image supplied. Use Slot 2 environment only if suitable; otherwise propose a premium fashion-review environment." });
  parts.push({ text: `REFERENCE SLOT 4 — ADDITIONAL NOTES\n${args.notes.trim() || "No additional notes."}\n\nLOCKED DEFAULT MASTER PROMPT — RETURN VERBATIM\n${DEFAULT_FASHION_MASTER_PROMPT}\n\nLOCKED DEFAULT POSE BLUEPRINTS — MAP ONE-TO-ONE TO KEYFRAMES 1–5\n${JSON.stringify(DEFAULT_FASHION_POSES, null, 2)}\n\nReturn only valid JSON matching the provided schema. Exactly five ordered keyframes are required.` });

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.settings.modelId)}:generateContent`, {
      method: "POST", signal: args.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": args.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: FASHION_SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA, maxOutputTokens: args.settings.detailLevel === "Detailed" ? 24000 : 16000 },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GeminiError("Không thể kết nối Gemini. Hãy kiểm tra mạng và thử lại.");
  }
  const raw = await response.text();
  if (!response.ok) throw new GeminiError(errorMessage(response.status, raw), response.status, raw.slice(0, 1000));
  let payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try { payload = JSON.parse(raw); } catch { throw new GeminiError("Gemini trả về phản hồi không đọc được."); }
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new GeminiError("Gemini trả về phản hồi trống. Hãy thử lại.");
  return applyDefaultFashionPlan(parseGeminiResponse(text));
}

export async function generateVideoPrompt(args: {
  apiKey: string;
  referenceOne: UploadedImage;
  referenceTwo: UploadedImage;
  notes: string;
  duration: string;
  settings: AppSettings;
  signal?: AbortSignal;
}): Promise<VideoPromptResult> {
  const parts: GeminiPart[] = [
    {
      text: `Write one image-to-video prompt from the two ordered references.\n\nCURRENT UI SETTINGS\nOutput language: ${args.settings.language}\nPrompt detail: ${args.settings.detailLevel}\nAspect ratio: ${args.settings.aspectRatio}\nTarget duration: ${args.duration}\n\nREFERENCE IMAGE 1 — EXACT OPENING FRAME`,
    },
    await imagePart(args.referenceOne),
    { text: "REFERENCE IMAGE 2 — EXACT CLOSING FRAME" },
    await imagePart(args.referenceTwo),
    {
      text: `OPTIONAL MOTION NOTES\n${args.notes.trim() || "No additional notes. Infer the shortest natural motion path between the two poses."}\n\nThe final prompt must mandate exactly one very short, smooth soft-blur bridge between the two poses and prohibit every other transition effect. Return only valid JSON matching the provided schema.`,
    },
  ];

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.settings.modelId)}:generateContent`, {
      method: "POST",
      signal: args.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": args.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: VIDEO_SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: VIDEO_PROMPT_SCHEMA,
          maxOutputTokens: args.settings.detailLevel === "Detailed" ? 8000 : 5000,
        },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GeminiError("Không thể kết nối Gemini. Hãy kiểm tra mạng và thử lại.");
  }

  const raw = await response.text();
  if (!response.ok) throw new GeminiError(errorMessage(response.status, raw), response.status, raw.slice(0, 1000));

  let payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try { payload = JSON.parse(raw); } catch { throw new GeminiError("Gemini trả về phản hồi không đọc được."); }
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new GeminiError("Gemini trả về phản hồi trống. Hãy thử lại.");

  try {
    const value = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as VideoPromptResult;
    if (!value.title || !value.prompt || !value.summary || !Array.isArray(value.warnings)) throw new Error();
    return value;
  } catch {
    throw new GeminiError("Gemini trả về prompt video không đúng định dạng. Hãy thử lại.");
  }
}

export async function listAvailableModels(apiKey: string, signal?: AbortSignal) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { headers: { "x-goog-api-key": apiKey }, signal });
  if (!response.ok) throw new GeminiError(errorMessage(response.status, ""), response.status);
  const payload = await response.json() as { models?: Array<{ name: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }> };
  return (payload.models ?? []).filter((model) => model.supportedGenerationMethods?.includes("generateContent")).map((model) => ({ id: model.name.replace(/^models\//, ""), label: model.displayName ?? model.name, description: model.description, available: true }));
}

export async function testApiKey(apiKey: string) {
  const models = await listAvailableModels(apiKey);
  if (!models.length) throw new GeminiError("API key hoạt động nhưng không tìm thấy model generateContent khả dụng.");
  return models.length;
}

export async function regeneratePromptPart(args: {
  apiKey: string; modelId: string; result: PromptGenerationResult; kind: "master" | "keyframe"; index?: number; signal?: AbortSignal;
}): Promise<{ title: string; prompt: string; poseSummary?: string; bodyDirection?: string; faceDirection?: string; camera?: string }> {
  if (args.kind === "master") {
    return { title: "Master Prompt mặc định · 5 ảnh dọc 9:16", prompt: DEFAULT_FASHION_MASTER_PROMPT };
  }
  const target = args.result.keyframes[args.index ?? 0];
  const lockedPose = DEFAULT_FASHION_POSES[args.index ?? 0];
  const context = {
    analysis: args.result.analysis,
    masterPrompt: args.result.masterPrompt,
    otherKeyframes: args.result.keyframes.filter((_, i) => i !== args.index).map(({ index, title, poseSummary, bodyDirection, faceDirection, camera }) => ({ index, title, poseSummary, bodyDirection, faceDirection, camera })),
    currentTarget: target,
  };
  const requestedShape = `Return JSON with title, prompt, poseSummary, bodyDirection, faceDirection and camera. Regenerate only this keyframe from its locked pose blueprint. Do not replace, reinterpret, or swap the pose. Preserve identity, outfit, location, lighting, 9:16 ratio and the standalone single-image requirement.\n\nLOCKED POSE BLUEPRINT\n${JSON.stringify(lockedPose, null, 2)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.modelId)}:generateContent`, {
    method: "POST", signal: args.signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": args.apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: FASHION_SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: `${requestedShape}\n\nReuse this structured context without reanalyzing images:\n${JSON.stringify(context)}` }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 6000 },
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new GeminiError(errorMessage(response.status, raw), response.status, raw.slice(0, 1000));
  const payload = JSON.parse(raw) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const value = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (!value.prompt || !value.title) throw new Error();
    return lockedPose ? {
      ...value,
      title: lockedPose.title,
      prompt: attachLockedPoseBlueprint(args.index ?? 0, value.prompt),
      poseSummary: lockedPose.poseSummary,
      bodyDirection: lockedPose.bodyDirection,
      faceDirection: lockedPose.faceDirection,
      camera: lockedPose.camera,
    } : value;
  } catch { throw new GeminiError("Gemini trả về prompt thay thế không hợp lệ. Hãy thử lại."); }
}
