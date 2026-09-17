import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const poses = [...read("fitcheck_pose_list.txt").matchAll(/^(\d+)\.\s+(.+)$/gm)]
  .map((match) => ({ id: Number(match[1]), name: match[2].trim() }));
const scenarios = [...read("fitcheck_prompts.txt").matchAll(/^(\d+)\.\s+([^\r\n]+)\r?\n([^\r\n]+)/gm)]
  .map((match) => ({ id: Number(match[1]), title: match[2].trim(), prompt: match[3].trim() }));
for (const [name, entries] of [["poses", poses], ["scenarios", scenarios]]) {
  if (!entries.length || entries.some((entry, index) => entry.id !== index + 1)) {
    throw new Error(`${name}: expected a non-empty, sequential numbered list starting at 1.`);
  }
}
if (poses[0]?.name !== "neutral front pose" || poses[18]?.name !== "back pose") {
  throw new Error("Keep pose IDs 1 (neutral front pose) and 19 (back pose) stable.");
}
const output = new URL("src/lib/prompts/fitcheck-catalog.generated.json", root);
const content = JSON.stringify({ poses, scenarios }, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== content) throw new Error("Fit-check catalog is stale. Run npm run catalog.");
} else {
  writeFileSync(output, content);
}
console.log(`${poses.length} poses, ${scenarios.length} scenarios: ${fileURLToPath(output)}`);
