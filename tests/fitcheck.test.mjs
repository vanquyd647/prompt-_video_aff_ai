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
const keywords = load("src/lib/prompts/video-keywords.ts");
const image = { file: new File(["fixture"], "fixture.png", { type: "image/png" }) };
const common = { apiKey: "mock-only", settings: { modelId: "test", language: "Vietnamese", detailLevel: "Compact", aspectRatio: "9:16" }, notes: "" };
const reply = (value) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }));
function mockFetch(t, handler) { const original = global.fetch; global.fetch = handler; t.after(() => { global.fetch = original; }); }

test("video keyword library uses source meanings and aliases and excludes incompatible directions", () => {
  assert.equal(keywords.VIDEO_KEYWORD_SOURCE.count, 161);
  assert.equal(keywords.resolveVideoKeyword("fit check").key, "/fitcheck");
  assert.equal(keywords.resolveVideoKeyword(" SLOW MOTION ").key, "/slowmotion");
  assert.equal(keywords.resolveVideoKeyword("/flatlay"), undefined);
  assert.ok(keywords.eligibleVideoKeywords("single").some(({ key }) => key === "/ootd"));
  for (const key of ["/pushin", "/frontback", "/outfittransition", "/lightsweep", "/crossfade"]) assert.throws(() => keywords.validateVideoKeywords([key], "single"));
  assert.ok(keywords.validateVideoKeywords(["/frontback", "/pushin"], "transition"));
  assert.throws(() => keywords.validateVideoKeywords(["/loop"], "transition"));
  assert.throws(() => keywords.validateVideoKeywords(["/staticshot", "/pushin"], "transition"));
  assert.throws(() => keywords.validateVideoKeywords(["/fitcheck", "/ootd"], "single"));
  assert.throws(() => keywords.validateVideoKeywords(["/texture", "/slowmotion", "/symmetry", "/loop"], "single"));
  assert.deepEqual(keywords.validateVideoKeywords(["fit check", "/fitcheck"], "single").map(({ key }) => key), ["/fitcheck"]);
});

test("video generation expands source keys and validates AI's application for both modes", async (t) => {
  let request;
  const selectedKeywords = [{ key: "/fitcheck", reason: "Show the existing jacket fit with a small collar adjustment." }, { key: "/slowmotion", reason: "Slow the collar adjustment within the clip duration." }];
  mockFetch(t, async (_, options) => { request = JSON.parse(options.body); return reply({ ...videoFixture(), selectedKeywords }); });
  for (const mode of ["single", "transition"]) {
    const result = await client.generateVideoPrompt({ ...common, mode, referenceOne: image, referenceTwo: image, duration: "3 seconds", keywordKeys: ["fit check", "slow motion"] });
    assert.deepEqual(result.selectedKeywords, selectedKeywords);
    const instructions = request.contents[0].parts.find(({ text }) => text?.includes("VIDEO KEYWORD LIBRARY")).text;
    assert.ok(instructions.includes(keywords.resolveVideoKeyword("/slowmotion").prompt_hint_en));
    assert.ok(instructions.includes('USER-SELECTED CANONICAL KEYS: ["/fitcheck","/slowmotion"]'));
    assert.ok(request.generationConfig.responseJsonSchema.required.includes("selectedKeywords"));
    assert.ok(!request.generationConfig.responseJsonSchema.properties.selectedKeywords.items.properties.key.enum.includes("/crossfade"));
  }
});

test("video keywords support auto selection and reject missing, hallucinated or ignored selections", async (t) => {
  let value;
  mockFetch(t, async () => reply({ ...videoFixture(), selectedKeywords: value }));
  const args = { ...common, mode: "single", referenceOne: image, duration: "3 seconds", keywordKeys: [] };
  value = [{ key: "/ootd", reason: "Show the existing outfit." }];
  assert.equal((await client.generateVideoPrompt(args)).selectedKeywords[0].key, "/ootd");
  await assert.rejects(() => client.generateVideoPrompt({ ...args, keywordKeys: ["/fitcheck"] }));
  for (value of [undefined, [], [{ key: "/invented", reason: "Unknown" }], [{ key: "/texture", reason: "No concept" }], [{ key: "fit check", reason: "Alias instead of canonical" }], [{ key: "/fitcheck", reason: "" }]]) await assert.rejects(() => client.generateVideoPrompt(args));
});

test("incompatible user video keywords fail before an API request", async (t) => {
  mockFetch(t, () => assert.fail("Do not send invalid keywords to Gemini"));
  await assert.rejects(() => client.generateVideoPrompt({ ...common, mode: "single", referenceOne: image, duration: "3 seconds", keywordKeys: ["/pushin"] }));
});

const turnaroundArgs = { apiKey: "mock-only", modelId: "gemini-3.1-flash-image", references: [image], products: [], notes: "Keep the original hairstyle" };
const imageResponse = (parts, extra = {}) => new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts }, ...extra }] }));
const outputImage = { inlineData: { mimeType: "image/png", data: btoa("image bytes") } };

test("turnaround prompt uses Flash Lite text output, original references and locked five-view order", async (t) => {
  let request;
  mockFetch(t, async (url, options) => {
    assert.ok(url.endsWith("gemini-3.5-flash-lite:generateContent"));
    request = JSON.parse(options.body);
    return imageResponse([{ thought: true, text: "Internal notes" }, { text: "Same character with the visible black jacket." }]);
  });
  const prompt = await client.generateTurnaroundPrompt({ ...turnaroundArgs, references: [image, image], products: [image], background: image });
  assert.deepEqual(request.generationConfig.responseModalities, ["TEXT"]);
  assert.equal(request.generationConfig.responseFormat, undefined);
  assert.equal(request.contents[0].parts.filter((part) => part.inline_data).length, 4);
  assert.ok(request.contents[0].parts.at(-1).text.includes(turnaroundArgs.notes));
  assert.match(prompt, /FRONT, 3\/4 FRONT, STRICT SIDE, BACK, 3\/4 BACK/);
  assert.match(prompt, /Same character with the visible black jacket/);
  assert.ok(!prompt.includes("Internal notes"));
});

test("turnaround text generation rejects incomplete, empty and image-only responses", async (t) => {
  let response;
  mockFetch(t, async () => response);
  for (response of [imageResponse([outputImage]), imageResponse([{ text: "" }]), imageResponse([{ text: "Partial prompt" }], { finishReason: "MAX_TOKENS" }), new Response("invalid json")]) await assert.rejects(() => client.generateTurnaroundPrompt(turnaroundArgs));
});

test("turnaround text generation validates input and preserves cancellation", async (t) => {
  let calls = 0;
  mockFetch(t, async () => { calls++; throw new DOMException("Canceled", "AbortError"); });
  await assert.rejects(() => client.generateTurnaroundPrompt({ ...turnaroundArgs, references: [] }));
  await assert.rejects(() => client.generateTurnaroundPrompt({ ...turnaroundArgs, apiKey: "" }));
  assert.equal(calls, 0);
  await assert.rejects(() => client.generateTurnaroundPrompt(turnaroundArgs), { name: "AbortError" });
});

test("turnaround requests a real image with five locked views and all original references", async (t) => {
  let request;
  mockFetch(t, async (url, options) => {
    assert.ok(url.endsWith("gemini-3.1-flash-image:generateContent"));
    request = JSON.parse(options.body);
    return imageResponse([{ thought: true, ...outputImage }, { text: "Image complete" }, outputImage]);
  });
  const result = await client.generateTurnaroundImage({ ...turnaroundArgs, references: [image, image], products: [image], background: image });
  assert.equal(result.image.type, "image/png");
  assert.equal(await result.image.text(), "image bytes");
  assert.equal(result.text, "Image complete");
  assert.deepEqual(request.generationConfig.responseModalities, ["TEXT", "IMAGE"]);
  assert.deepEqual(request.generationConfig.responseFormat.image, { aspectRatio: "16:9", imageSize: "2K" });
  const parts = request.contents[0].parts;
  assert.equal(parts.filter((part) => part.inline_data).length, 4);
  assert.match(parts[0].text, /FRONT, 3\/4 FRONT, STRICT SIDE, BACK, 3\/4 BACK/);
  assert.match(parts[0].text, /original reference image\(s\) as the source of truth/);
  assert.ok(parts.at(-1).text.includes(turnaroundArgs.notes));
  assert.equal(request.generationConfig.responseMimeType, undefined);
});

test("turnaround accepts one original image without requiring products or background", async (t) => {
  mockFetch(t, async (_, options) => {
    assert.equal(JSON.parse(options.body).contents[0].parts.filter((part) => part.inline_data).length, 1);
    return imageResponse([outputImage]);
  });
  assert.ok((await client.generateTurnaroundImage(turnaroundArgs)).image instanceof Blob);
});

test("turnaround rejects invalid inputs before sending a paid image request", async (t) => {
  mockFetch(t, () => assert.fail("Must validate before fetching"));
  for (const changes of [{ apiKey: "" }, { modelId: "gemini-2.5-flash" }, { references: [] }, { references: Array(15).fill(image) }, { references: [{ file: { size: 15 * 1024 * 1024 } }] }]) {
    await assert.rejects(() => client.generateTurnaroundImage({ ...turnaroundArgs, ...changes }));
  }
});

test("turnaround rejects text-only, blocked, truncated, malformed and multiple-image responses", async (t) => {
  let response;
  mockFetch(t, async () => response);
  for (response of [imageResponse([{ text: "Here is your prompt" }]), imageResponse([outputImage], { finishReason: "MAX_TOKENS" }), imageResponse([outputImage, outputImage]), imageResponse([{ ...outputImage, thought: true }]), new Response("not json"), new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }))]) {
    await assert.rejects(() => client.generateTurnaroundImage(turnaroundArgs));
  }
});

test("turnaround propagates cancellation and handles rate limits", async (t) => {
  const controller = new AbortController();
  mockFetch(t, async (_, options) => { assert.equal(options.signal, controller.signal); throw new DOMException("Aborted", "AbortError"); });
  await assert.rejects(() => client.generateTurnaroundImage({ ...turnaroundArgs, signal: controller.signal }), { name: "AbortError" });
  global.fetch = async () => new Response("quota", { status: 429 });
  await assert.rejects(() => client.generateTurnaroundImage(turnaroundArgs), (error) => error.status === 429);
});

test("outfit references preserve body count, individual garment assignments and landscape layout", async (t) => {
  let request;
  mockFetch(t, async (_, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ thought: true, text: "private reasoning" }, { text: "A white mannequin wearing the reference outfit." }] } }] }));
  });
  const prompt = await client.generateOutfitPrompt({ ...common, bodies: [image, image], products: [{ ...image, category: "top" }, { ...image, category: "skirt" }], notes: "Tuck in the shirt" });
  const parts = request.contents[0].parts;
  assert.equal(parts.filter((part) => part.inline_data).length, 4);
  assert.ok(parts.some((part) => part.text?.includes("BODY REFERENCE 2")));
  assert.ok(parts.some((part) => part.text?.includes("assigned category = top")));
  assert.ok(parts.some((part) => part.text?.includes("assigned category = skirt")));
  assert.ok(parts.at(-1).text.includes("Tuck in the shirt"));
  assert.match(prompt, /ONE landscape 16:9/);
  assert.match(prompt, /FRONT.*SIDE.*BACK/);
  assert.ok(!prompt.includes("private reasoning"));
});

test("outfit rejects missing references and unassigned categories before API requests", async (t) => {
  mockFetch(t, () => { assert.fail("Invalid input must not call Gemini"); });
  const args = { ...common, bodies: [image], products: [{ ...image, category: "trousers" }] };
  await assert.rejects(() => client.generateOutfitPrompt({ ...args, bodies: [] }));
  await assert.rejects(() => client.generateOutfitPrompt({ ...args, products: [] }));
  await assert.rejects(() => client.generateOutfitPrompt({ ...args, products: [{ ...image, category: "" }] }));
});

test("outfit rejects empty and truncated Gemini output", async (t) => {
  const args = { ...common, bodies: [image], products: [{ ...image, category: "top" }] };
  mockFetch(t, async () => new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "unfinished" }] } }] })));
  await assert.rejects(() => client.generateOutfitPrompt(args));
  global.fetch = async () => new Response(JSON.stringify({ candidates: [] }));
  await assert.rejects(() => client.generateOutfitPrompt(args));
});

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
