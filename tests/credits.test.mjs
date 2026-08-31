import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceNames = Object.keys(JSON.parse(await readFile(path.join(repoRoot, "audit-report.json"), "utf8")).sourceStats);
const indexHtml = await readFile(path.join(repoRoot, "index.html"), "utf8");
const materialsHtml = await readFile(path.join(repoRoot, "materials.html"), "utf8");
const originalBundle = await readFile(path.join(repoRoot, "assets", "index-D_8Jpc5N.js"), "utf8");
const additionalSources = await readFile(path.join(repoRoot, "assets", "site-footer-sources.js"), "utf8");
const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
const footerLabels = { "Godot Asset Library": "Asset Library" };

test("existing homepage footer covers every indexed reference source", () => {
  const footerStart = originalBundle.lastIndexOf("`footer`");
  assert.ok(footerStart > 0);
  const footer = originalBundle.slice(footerStart, footerStart + 5000);
  for (const sourceName of sourceNames) {
    const label = footerLabels[sourceName] ?? sourceName;
    assert.ok(footer.includes(label) || additionalSources.includes(label), `missing footer credit: ${sourceName}`);
  }
  assert.match(additionalSources, /Kenney/);
  assert.match(footer, /#overview/);
  assert.match(indexHtml, /site-footer-sources\.js/);
  assert.doesNotMatch(indexHtml, /site-credits/);
  assert.doesNotMatch(materialsHtml, /site-credits|site-footer-sources/);
});

test("README states attribution and license boundaries", () => {
  assert.match(readme, /Kenney/);
  assert.match(readme, /Godot Shaders/);
  assert.match(readme, /OpenGameArt/);
  assert.match(readme, /许可/);
});
