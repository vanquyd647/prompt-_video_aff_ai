import type { PoseDiversityScore, PromptGenerationResult } from "@/types";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9À-ỹ]+/gi, " ").trim();

export function scorePoseDiversity(result: PromptGenerationResult): PoseDiversityScore {
  const fields = ["bodyDirection", "faceDirection", "camera", "poseSummary"] as const;
  const issues: string[] = [];
  let score = 100;
  for (const field of fields) {
    const values = result.keyframes.map((item) => normalize(item[field]));
    const unique = new Set(values).size;
    if (unique <= 2) {
      score -= field === "poseSummary" ? 25 : 18;
      const labels = { bodyDirection: "hướng cơ thể", faceDirection: "hướng khuôn mặt", camera: "góc máy", poseSummary: "dáng chụp" };
      issues.push(`${labels[field]} có thể đang bị lặp lại quá nhiều.`);
    } else if (unique === 3) score -= 8;
  }
  for (let i = 1; i < result.keyframes.length; i++) {
    if (normalize(result.keyframes[i].poseSummary) === normalize(result.keyframes[i - 1].poseSummary)) {
      score -= 15;
      issues.push(`Khung hình ${i} và ${i + 1} có mô tả dáng giống nhau.`);
    }
  }
  return { score: Math.max(0, score), issues: [...new Set(issues)] };
}

export function consistencyWarnings(result: PromptGenerationResult): string[] {
  const warnings: string[] = [];
  const concepts = ["identity", "outfit", "background"] as const;
  const synonyms: Record<(typeof concepts)[number], string[]> = {
    identity: ["identity", "same model", "same person", "nhận diện", "người mẫu"],
    outfit: ["outfit", "garment", "product", "trang phục", "sản phẩm"],
    background: ["background", "location", "environment", "bối cảnh", "địa điểm"],
  };
  result.keyframes.forEach((keyframe) => {
    const text = normalize(keyframe.prompt);
    concepts.forEach((concept) => {
      if (!synonyms[concept].some((word) => text.includes(normalize(word)))) {
        const labels = { identity: "nhận diện người mẫu", outfit: "trang phục", background: "bối cảnh" };
        warnings.push(`Khung hình ${keyframe.index} có thể chưa nêu rõ yêu cầu giữ nguyên ${labels[concept]}.`);
      }
    });
  });
  return warnings;
}

export function formatAllPrompts(result: PromptGenerationResult) {
  return ["PROMPT THAM CHIẾU CHÍNH", result.masterPrompt.prompt, ...result.keyframes.flatMap((item) => [`KHUNG HÌNH ${String(item.index).padStart(2, "0")} — ${item.title}`, item.prompt])].join("\n\n");
}
