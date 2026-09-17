import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fashionFixture, videoFixture } from "./fixtures.mjs";

// Exercise the actual TS modules without requiring a second runtime dependency.
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const resolve = (id) => {
    const resolved = id.startsWith("@/") ? path.resolve("src", id.slice(2)) : path.resolve(path.dirname(file), id);
    return load(path.extname(resolved) ? resolved : resolved + ".ts");
  };
  new Function("require", "module", "exports", js)(resolve, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const catalog = load("src/lib/prompts/fitcheck-catalog.ts");
const defaults = load("src/lib/prompts/fashion-defaults.ts");
const { parseGeminiResponse } = load("src/lib/gemini/response-parser.ts");
const client = load("src/lib/gemini/client.ts");
const image = { file: new File(["fixture"], "fixture.png", { type: "image/png" }) };
const common = { apiKey: "mock-only", settings: { modelId: "test", language: "Vietnamese", detailLevel: "Compact", aspectRatio: "9:16" }, notes: "" };
const reply = (value) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }));
function mockFetch(t, handler) { const original = global.fetch; global.fetch = handler; t.after(() => { global.fetch = original; }); }

test("catalog imports the numbered source entries and filters incompatible effects", () => {
  assert.equal(catalog.FITCHECK_POSES.length, 60);
  assert.equal(catalog.FITCHECK_SCENARIOS.length, 30);
  for (const mode of ["single", "transition"]) {
    assert.ok(!catalog.getEligibleScenarios(mode).some(({ id }) => [16, 17, 19].includes(id)));
    assert.ok(catalog.getEligibleScenarios(mode).some(({ id }) => id === 24));
  }
  assert.ok(!catalog.getEligibleScenarios("single").some(({ id }) => id === 12));
});

test("pose selection enforces four catalog IDs, fixed front/back, uniqueness and manual choices", () => {
  const valid = fashionFixture();
  assert.deepEqual(parseGeminiResponse(JSON.stringify({ ...valid, keyframes: [...valid.keyframes].reverse() }), [14, 38]).keyframes.map(p => p.poseId), [1, 19, 14, 38]);
  for (const ids of [[19, 1, 14, 38], [1, 19, 14, 14], [1, 19, 999, 38], [1, 19, 14], [1, 19, 14, 38, 9]]) assert.throws(() => parseGeminiResponse(JSON.stringify(fashionFixture(ids))));
  assert.throws(() => parseGeminiResponse(JSON.stringify(valid), [9, null]));
  for (const selection of [[14, 14], [1, null], [null, 19], [999, null]]) assert.throws(() => catalog.validatePoseSelection(selection));
  const legacy = fashionFixture(); delete legacy.keyframes[2].poseId;
  assert.equal(catalog.hasCatalogPosePlan(legacy), false);
});

test("generation and Master Prompt restoration retain selected catalog poses", async (t) => {
  let request, calls = 0;
  mockFetch(t, async (_, options) => { calls++; request = JSON.parse(options.body); return reply(fashionFixture()); });
  const args = { ...common, model: image, products: [image], background: image, poseSelection: [14, null] };
  await assert.rejects(() => client.generatePromptSet({ ...args, poseSelection: [14, 14] }));
  assert.equal(calls, 0);
  const result = await client.generatePromptSet(args);
  assert.deepEqual(result.keyframes.map(p => p.poseId), [1, 19, 14, 38]);
  assert.ok(result.masterPrompt.prompt.includes("side profile pose"));
  assert.ok(result.masterPrompt.prompt.includes("one arm relaxed, one hand on waist"));
  assert.ok(!result.masterPrompt.prompt.includes("chọn một pose khác"));
  for (const pose of result.keyframes) assert.equal(defaults.attachLockedPoseBlueprint(pose, pose.prompt), pose.prompt);
  assert.ok(request.contents[0].parts.at(-1).text.includes("Panel 3: 14"));
  assert.ok(request.contents[0].parts.at(-1).text.includes("Panel 4: AUTO"));
  assert.ok(request.contents[0].parts.at(-1).text.includes("fitcheck_pose_list.txt"));
  const master = await client.regeneratePromptPart({ apiKey: "mock", modelId: "test", result, kind: "master" });
  assert.equal(master.prompt, result.masterPrompt.prompt);
  assert.equal(calls, 1);
});

test("individual regeneration cannot silently pick another pose", async (t) => {
  const result = defaults.applyDefaultFashionPlan(fashionFixture());
  let poseId = 14;
  mockFetch(t, async (_, options) => {
    assert.ok(JSON.parse(options.body).system_instruction.parts[0].text.includes("SINGLE-PANEL REGENERATION TASK"));
    return reply({ poseId, title: "Regenerated", prompt: "Updated panel" });
  });
  const regenerated = await client.regeneratePromptPart({ apiKey: "mock", modelId: "test", result, kind: "keyframe", index: 2 });
  assert.equal(regenerated.poseId, 14);
  assert.equal(regenerated.title, "side profile pose");
  poseId = 9;
  await assert.rejects(() => client.regeneratePromptPart({ apiKey: "mock", modelId: "test", result, kind: "keyframe", index: 2 }));
});

test("both video modes send a catalog and return canonical scenario metadata plus analysis", async (t) => {
  let request;
  mockFetch(t, async (_, options) => { request = JSON.parse(options.body); return reply({ ...videoFixture(), scenario: { ...videoFixture().scenario, title: "Invented", sourcePrompt: "Invented" } }); });
  for (const mode of ["single", "transition"]) {
    const result = await client.generateVideoPrompt({ ...common, mode, referenceOne: image, referenceTwo: image, duration: "3 seconds" });
    assert.equal(result.scenario.title, "Jacket Fit Check");
    assert.equal(result.scenario.sourcePrompt, catalog.FITCHECK_SCENARIOS.find(p => p.id === 24).prompt);
    assert.ok(result.analysis.outfit.includes("collar"));
    assert.equal(request.contents[0].parts.filter(p => p.inline_data).length, mode === "single" ? 1 : 2);
    assert.ok(request.contents[0].parts.some(p => p.text?.includes("fitcheck_prompts.txt")));
    assert.ok(request.system_instruction.parts[0].text.includes("ANALYZE THEN SELECT A CATALOG SCENARIO"));
  }
});

test("invalid scenario IDs, banned effects and missing analysis are rejected", async (t) => {
  let value;
  mockFetch(t, async () => reply(value));
  const args = { ...common, mode: "single", referenceOne: image, duration: "3 seconds" };
  for (const id of [999, 19, 16, 17, 12]) { value = videoFixture(id); await assert.rejects(() => client.generateVideoPrompt(args)); }
  value = videoFixture(); delete value.analysis;
  await assert.rejects(() => client.generateVideoPrompt(args));
  value = videoFixture(); value.scenario.reason = "";
  await assert.rejects(() => client.generateVideoPrompt(args));
});
