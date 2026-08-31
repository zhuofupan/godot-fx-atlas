import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceNames = Object.keys(JSON.parse(await readFile(path.join(repoRoot, "audit-report.json"), "utf8")).sourceStats);
const indexHtml = await readFile(path.join(repoRoot, "index.html"), "utf8");
const materialsHtml = await readFile(path.join(repoRoot, "materials.html"), "utf8");
const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");

test("homepage acknowledgements cover every indexed reference source", () => {
  assert.match(indexHtml, /鸣谢与来源/);
  for (const sourceName of sourceNames) assert.ok(indexHtml.includes(sourceName), `missing credit: ${sourceName}`);
  assert.match(indexHtml, /Kenney/);
});

test("material library and README state both attribution and license boundaries", () => {
  for (const content of [materialsHtml, readme]) {
    assert.match(content, /Kenney/);
    assert.match(content, /Godot Shaders/);
    assert.match(content, /OpenGameArt/);
    assert.match(content, /许可/);
  }
  assert.match(materialsHtml, /CC0/);
});
