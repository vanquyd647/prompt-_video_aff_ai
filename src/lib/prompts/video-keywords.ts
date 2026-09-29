import source from "./product-keywords.source.json";
import type { VideoPromptMode } from "@/types";

export const VIDEO_KEYWORD_SOURCE = { name: source.meta.name, version: source.meta.version, count: source.keywords.length };
export const VIDEO_KEYWORDS = source.keywords.filter((item) => item.media.includes("video") && item.industries.some((industry) => industry === "fashion" || industry === "general"));
export type VideoKeyword = (typeof VIDEO_KEYWORDS)[number];
export interface AppliedVideoKeyword { key: string; reason: string }

const concepts = new Set(["/fitcheck", "/ootd", "/grwm", "/tryon", "/lookbook", "/styling", "/streetstyle", "/onfeet", "/firstlook", "/lifestyle", "/showcase", "/daily", "/dayinlife", "/frontback", "/outfittransition"]);
const modifiers = new Set(["/staticshot", "/texture", "/slowmotion", "/threequarter", "/symmetry", "/negativespace", "/loop", "/pan", "/tracking", "/pushin", "/pullout", "/slideby", "/tilt", "/crane"]);

export function keywordRestriction(keyword: VideoKeyword, mode: VideoPromptMode): string | undefined {
  if (!(keyword.role === "concept" ? concepts : modifiers).has(keyword.key)) return "Không phù hợp luồng giữ nguyên nhân vật, trang phục, bối cảnh và chỉ chuyển cảnh bằng blur mềm.";
  if (mode === "single" && ["/frontback", "/outfittransition"].includes(keyword.key)) return "Cần ảnh đầu + cuối để xác nhận hai góc nhìn; không thay đổi outfit.";
  if (mode === "single" && keyword.categories.includes("camera_motion") && keyword.key !== "/staticshot") return "Chế độ một ảnh giữ máy quay cố định.";
  if (mode === "transition" && keyword.key === "/loop") return "Ảnh đầu + cuối phải kết thúc đúng ảnh cuối, không ép quay lại tư thế đầu.";
}

export const eligibleVideoKeywords = (mode: VideoPromptMode) => VIDEO_KEYWORDS.filter((keyword) => !keywordRestriction(keyword, mode));

export function resolveVideoKeyword(value: string): VideoKeyword | undefined {
  const token = value.trim().toLowerCase();
  return VIDEO_KEYWORDS.find((item) => [item.key, item.token, ...item.aliases].some((alias) => alias.toLowerCase() === token));
}

export function validateVideoKeywords(values: string[], mode: VideoPromptMode): VideoKeyword[] {
  const keywords: VideoKeyword[] = [];
  for (const value of values) {
    const keyword = resolveVideoKeyword(value);
    if (!keyword) throw new Error(`Không tìm thấy từ khóa video: ${value}`);
    const restriction = keywordRestriction(keyword, mode);
    if (restriction) throw new Error(`${keyword.key}: ${restriction}`);
    if (!keywords.some((item) => item.key === keyword.key)) keywords.push(keyword);
  }
  if (keywords.filter((item) => item.role === "concept").length > 1) throw new Error("Chọn tối đa một concept cho mỗi video.");
  if (keywords.filter((item) => item.role === "modifier").length > 3) throw new Error("Chọn tối đa ba từ khóa kỹ thuật cho mỗi video.");
  if (keywords.some((item) => item.key === "/staticshot") && keywords.some((item) => item.categories.includes("camera_motion") && item.key !== "/staticshot")) throw new Error("Không kết hợp máy quay cố định với chuyển động máy quay.");
  return keywords;
}

export function videoKeywordInstructions(values: string[], mode: VideoPromptMode): string {
  const requested = validateVideoKeywords(values, mode);
  return `VIDEO KEYWORD LIBRARY — ${VIDEO_KEYWORD_SOURCE.name}, v${VIDEO_KEYWORD_SOURCE.version}
${JSON.stringify(eligibleVideoKeywords(mode).map(({ key, role, meaning_vi, prompt_hint_en, concept_label }) => ({ key, role, meaning_vi, prompt_hint_en, concept_label })))}
USER-SELECTED CANONICAL KEYS: ${JSON.stringify(requested.map(({ key }) => key))}
Select exactly ONE concept and zero to three compatible modifiers from this library after analyzing the reference images. Include every user-selected key; when no concept is selected, choose the best supported concept automatically. Return selectedKeywords as [{key, reason}], with a concrete explanation of how each key is used in the final prompt. Do not invent keys or return aliases. Expand the full meaning and prompt hints into actual motion, camera and garment instructions in the final prompt; never assume the video generator understands slash tokens alone. Keep the fitcheck scenario and selected keys coherent, selecting a minimal compatible scenario if necessary.
KEYWORD ADAPTATION: All reference locks, no-speech rules and mode-specific camera/transition rules have priority over keyword hints. GRWM, try-on and styling mean a small adjustment of the EXISTING outfit, never an outfit swap or added accessory. Lookbook, daily and day-in-life mean one short continuous moment, never a montage. Street style/lifestyle cannot replace the supplied background. On-feet requires visible footwear. Frontback requires verified front and back references, no invented hidden sides. Outfittransition means the SAME outfit with the mandatory soft-blur pose bridge, never a clothing change. Texture/threequarter/symmetry/negative space preserve the input framing; do not invent a new crop, pose or prop. Slowmotion changes only the timing of plausible motion. Apply camera modifiers only if they can connect the supplied framing. If reference evidence prevents literal application, state the limitation in warnings and the key's reason and use the closest compatible interpretation. Do not combine staticshot with camera movement.`;
}

export function validateAppliedVideoKeywords(value: unknown, requested: string[], mode: VideoPromptMode): AppliedVideoKeyword[] {
  if (!Array.isArray(value) || !value.length || value.some((item) => !item || typeof item.key !== "string" || typeof item.reason !== "string" || !item.reason.trim())) throw new Error("Thiếu thông tin từ khóa đã áp dụng.");
  const keys = value.map((item) => item.key as string);
  const resolved = validateVideoKeywords(keys, mode);
  if (resolved.length !== keys.length || resolved.some((item, index) => item.key !== keys[index]) || resolved.filter((item) => item.role === "concept").length !== 1) throw new Error("Từ khóa Gemini trả về không hợp lệ.");
  if (validateVideoKeywords(requested, mode).some((item) => !keys.includes(item.key))) throw new Error("Gemini chưa áp dụng đủ từ khóa đã chọn.");
  return value.map(({ key, reason }) => ({ key, reason }));
}
