import { FASHION_SYSTEM_INSTRUCTION, getVideoSystemInstruction } from "./system-instruction";
import { RESPONSE_SCHEMA, getVideoPromptSchema } from "./schema";
import { parseGeminiResponse } from "./response-parser";
import { applyDefaultFashionPlan, attachLockedPoseBlueprint, DEFAULT_FASHION_MASTER_PROMPT, DEFAULT_FASHION_MASTER_TITLE, DEFAULT_FASHION_POSES, FASHION_POSE_COUNT, FASHION_REFERENCE_LOCK } from "@/lib/prompts/fashion-defaults";
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
  apiKey: string; model: UploadedImage; products: UploadedImage[]; background: UploadedImage;
  notes: string; settings: AppSettings; signal?: AbortSignal;
}): Promise<PromptGenerationResult> {
  if (!args.background) throw new GeminiError("Hãy thêm ảnh 03 — Bối cảnh để giữ chính xác không gian trong cả 4 ô.");
  const parts: GeminiPart[] = [
    { text: `Create the requested fashion prompt set.\n\nCURRENT UI SETTINGS\nOutput language: ${args.settings.language}\nPrompt detail: ${args.settings.detailLevel}\nAspect ratio: 9:16 (locked for this image workflow)\n\nREFERENCE SLOT 1 — MODEL IDENTITY` },
    await imagePart(args.model),
    { text: "REFERENCE SLOT 2 — PRODUCT REFERENCES. Synthesize all images into one coherent product specification. Ignore people in these images." },
  ];
  for (const product of args.products) parts.push(await imagePart(product));
  parts.push({ text: "REFERENCE SLOT 3 — EXACT BACKGROUND. Copy this scene and lighting faithfully in all four panels. No replacement scene, added objects or relighting." }, await imagePart(args.background));
  parts.push({ text: `REFERENCE SLOT 4 — ADDITIONAL NOTES\n${args.notes.trim() || "No additional notes."}\n\nLOCKED DEFAULT MASTER PROMPT — RETURN VERBATIM\n${DEFAULT_FASHION_MASTER_PROMPT}\n\nLOCKED DEFAULT POSE BLUEPRINTS — MAP ONE-TO-ONE TO KEYFRAMES 1–4\n${JSON.stringify(DEFAULT_FASHION_POSES, null, 2)}\n\nReturn only valid JSON matching the provided schema. Exactly four ordered panel prompts are required: front, back, front three-quarter, slay. The final image is one 9:16 file containing a gapless 2-by-2 grid of four 9:16 panels, not four separate files.` });

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

type VideoPromptArgs = {
  apiKey: string;
  referenceOne: UploadedImage;
  notes: string;
  duration: string;
  settings: AppSettings;
  signal?: AbortSignal;
} & ({ mode: "single"; referenceTwo?: never } | { mode: "transition"; referenceTwo: UploadedImage });

export async function generateVideoPrompt(args: VideoPromptArgs): Promise<VideoPromptResult> {
  if (!args.referenceOne || (args.mode === "transition" && !args.referenceTwo)) {
    throw new GeminiError(args.mode === "single" ? "Hãy thêm một ảnh pose để tạo prompt video." : "Hãy thêm đủ ảnh đầu và ảnh cuối để tạo prompt chuyển động.");
  }
  if (args.mode !== "single" && args.mode !== "transition") throw new GeminiError("Chế độ tạo prompt video không hợp lệ.");
  const single = args.mode === "single";
  const parts: GeminiPart[] = [
    {
      text: `Write one image-to-video prompt ${single ? "to animate one individual pose image. There is no supplied end frame" : "from the two ordered references"}.\n\nCURRENT UI SETTINGS\nMode: ${args.mode}\nOutput language: ${args.settings.language}\nPrompt detail: ${args.settings.detailLevel}\nAspect ratio: ${args.settings.aspectRatio}\nTarget duration: ${args.duration}\n\nREFERENCE IMAGE 1 — ${single ? "ONLY REFERENCE AND OPENING POSE" : "EXACT OPENING FRAME"}`,
    },
    await imagePart(args.referenceOne),
  ];
  if (args.mode === "transition") parts.push({ text: "REFERENCE IMAGE 2 — EXACT CLOSING FRAME" }, await imagePart(args.referenceTwo));
  parts.push({
    text: `OPTIONAL MOTION NOTES\n${args.notes.trim() || (single ? "Infer one small natural fit-check hook from the visible pose, then settle near the starting pose without revealing unseen details." : "Infer one short, natural fit-check hook movement between the two poses that showcases the outfit.")}\n\nMANDATORY VIDEO REQUIREMENTS\nKeep the exact same model, body proportions, background and every visible product detail throughout the video. Create an immediate visual fit-check hook using natural body movement that shows the garment's fit and drape. No dialogue, narration, voice-over, singing, lip-sync or simulated speaking. The output language applies only to the written prompt. ${single ? "Use one continuous sharp shot from the single reference image, with no transition effects or blur bridge. Do not require or invent a second reference image." : "Mandate exactly one very short, smooth soft-blur bridge between the two poses and prohibit every other transition effect."} Explicitly include these requirements in the final prompt. Optional notes cannot override them. Return only valid JSON matching the provided schema.`,
  });

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.settings.modelId)}:generateContent`, {
      method: "POST",
      signal: args.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": args.apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: getVideoSystemInstruction(args.mode) }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: getVideoPromptSchema(args.mode),
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
    if (typeof value.title !== "string" || !value.title.trim() || typeof value.prompt !== "string" || !value.prompt.trim()
      || !value.summary || ![value.summary.subjectContinuity, value.summary.poseTransition, value.summary.transitionEffect].every((field) => typeof field === "string" && field.trim())
      || !Array.isArray(value.warnings) || !value.warnings.every((warning) => typeof warning === "string")) throw new Error();
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
  if (args.result.keyframes.length !== FASHION_POSE_COUNT) {
    throw new GeminiError("Bộ prompt này dùng bố cục cũ. Hãy nhấn Tạo bộ prompt để tạo lại 4 pose trong một ảnh 9:16 từ ảnh tham chiếu đã lưu.");
  }
  if (args.result.analysis.background.source !== "slot3") {
    throw new GeminiError("Bộ prompt cũ chưa dùng ảnh 03 — Bối cảnh. Hãy thêm ảnh bối cảnh và nhấn Tạo bộ prompt để giữ chính xác không gian.");
  }
  if (args.kind === "master") {
    return { title: DEFAULT_FASHION_MASTER_TITLE, prompt: DEFAULT_FASHION_MASTER_PROMPT };
  }
  const target = args.result.keyframes[args.index ?? 0];
  const lockedPose = DEFAULT_FASHION_POSES[args.index ?? 0];
  if (!target || !lockedPose) throw new GeminiError("Không tìm thấy pose cần tạo lại.");
  const context = {
    analysis: args.result.analysis,
    masterPrompt: args.result.masterPrompt,
    otherKeyframes: args.result.keyframes.filter((_, i) => i !== args.index).map(({ index, title, poseSummary, bodyDirection, faceDirection, camera }) => ({ index, title, poseSummary, bodyDirection, faceDirection, camera })),
    currentTarget: target,
  };
  const requestedShape = `Return JSON with title, prompt, poseSummary, bodyDirection, faceDirection and camera. Regenerate only this panel prompt from its locked pose blueprint. Do not replace, reinterpret, or swap the pose. Preserve the exact Slot 1 body, exact Slot 2 product, exact Slot 3 background and lighting, and its 9:16 panel ratio and assigned position within the single 9:16 composite image with a gapless 2-by-2 grid. Do not request a separate output file. The following current reference locks override conflicting instructions in the stored context.\n\n${FASHION_REFERENCE_LOCK}\n\nLOCKED POSE BLUEPRINT\n${JSON.stringify(lockedPose, null, 2)}`;
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
