export function fashionFixture(ids = [1, 19, 14, 38]) {
  return {
    analysis: {
      model: { identitySummary: "Reference model", faceSummary: "Same face", hairSummary: "Same hair", bodySummary: "Observed body only", bodyReferenceConfidence: "high" },
      product: { category: "Jacket", description: "Structured jacket with visible seams", colors: ["Black"], materials: ["Cotton"], constructionDetails: ["Buttons"], distinctiveFeatures: ["Collar"], confidenceNotes: [] },
      background: { source: "slot3", description: "Reference studio", lighting: "Reference light", spatialNotes: [] },
      userNotes: { normalizedInstructions: [] },
    },
    masterPrompt: { title: "Composite", prompt: "One composite image" },
    keyframes: ids.map((poseId, i) => ({ index: i + 1, poseId, title: `Pose ${poseId}`, selectionReason: `Shows garment detail with pose ${poseId}`, poseSummary: `Catalog pose ${poseId}`, bodyDirection: `Body ${poseId}`, faceDirection: `Gaze ${poseId}`, camera: `Fixed panel ${i + 1}`, prompt: `Panel ${i + 1}: same model, outfit and background, pose ${poseId}.` })),
    consistencyRules: ["Keep references"], warnings: [],
  };
}

export function videoFixture(id = 24) {
  return {
    title: "Jacket fit check", prompt: "Gently adjust the visible jacket collar with a small weight shift. Same model, body, jacket, background. No speech.",
    analysis: { model: "Same visible face, hair and body proportions", outfit: "Black jacket with a structured collar and buttons", pose: "Front view with hands near the jacket", background: "Reference studio with fixed lighting", motionConstraints: ["Keep hands clear of buttons"] },
    scenario: { id, reason: "The visible collar suits a jacket fit check", adaptation: "Small collar adjustment, fixed camera, no speech" },
    summary: { subjectContinuity: "Same model and garment", poseTransition: "Gentle collar adjustment", transitionEffect: "No transition" }, warnings: [],
  };
}
