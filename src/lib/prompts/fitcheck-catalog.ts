import catalog from "./fitcheck-catalog.generated.json";
import type { PoseSelection, PromptGenerationResult, VideoPromptMode } from "@/types";

export const FITCHECK_POSES = catalog.poses;
export const FITCHECK_SCENARIOS = catalog.scenarios;
export const FRONT_POSE_ID = 1;
export const BACK_POSE_ID = 19;
export const OPTIONAL_FITCHECK_POSES = FITCHECK_POSES.filter(({ id }) => id !== FRONT_POSE_ID && id !== BACK_POSE_ID);

export function validatePoseSelection(selection: PoseSelection) {
  if (selection.length !== 2 || selection.some((id) => id !== null && !OPTIONAL_FITCHECK_POSES.some((pose) => pose.id === id))) {
    throw new Error("Pose 3 và 4 phải thuộc danh sách fitcheck_pose_list hoặc để AI tự chọn.");
  }
  if (selection[0] !== null && selection[0] === selection[1]) throw new Error("Pose 3 và 4 phải khác nhau.");
}

export function validateSelectedPoses(keyframes: PromptGenerationResult["keyframes"], selection: PoseSelection = [null, null]) {
  validatePoseSelection(selection);
  if (keyframes.length !== 4 || keyframes[0]?.poseId !== FRONT_POSE_ID || keyframes[1]?.poseId !== BACK_POSE_ID
    || new Set(keyframes.map((pose) => pose.poseId)).size !== 4
    || keyframes.some((pose, index) => pose.index !== index + 1 || !FITCHECK_POSES.some(({ id }) => id === pose.poseId) || typeof pose.selectionReason !== "string" || !pose.selectionReason.trim())
    || selection.some((id, index) => id !== null && keyframes[index + 2]?.poseId !== id)) {
    throw new Error("AI phải giữ front/back, chọn hai pose khác nhau trong danh sách và tôn trọng lựa chọn pose 3–4 của bạn.");
  }
}

export function hasCatalogPosePlan(result: PromptGenerationResult) {
  try { validateSelectedPoses(result.keyframes); return true; } catch { return false; }
}

export function getEligibleScenarios(mode: VideoPromptMode) {
  // These effects conflict with the existing continuity / transition requirements.
  const excluded = mode === "single" ? [12, 13, 14, 15, 16, 17, 19, 26, 27, 29, 30] : [16, 17, 19];
  return FITCHECK_SCENARIOS.filter(({ id }) => !excluded.includes(id));
}
