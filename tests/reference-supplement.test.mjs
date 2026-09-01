import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildShaderVEntries, SHADERV_BLOCK_END, SHADERV_BLOCK_START } from "../src/reference-supplement.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "reference-sources", "shaderv-godot4.json"), "utf8"));
const entries = buildShaderVEntries(manifest);
const indexHtml = await readFile(path.join(repoRoot, "index.html"), "utf8");
const bundleName = indexHtml.match(/src="\.\/assets\/(index-[^"]+\.js)"/)[1];
const bundle = await readFile(path.join(repoRoot, "assets", bundleName), "utf8");
const semanticAudit = JSON.parse(await readFile(path.join(repoRoot, "semantic-audit.json"), "utf8"));
const linkAudit = JSON.parse(await readFile(path.join(repoRoot, "final-link-audit.json"), "utf8"));
const auditReport = JSON.parse(await readFile(path.join(repoRoot, "audit-report.json"), "utf8"));

test("ShaderV manifest locks all Godot 4.x nodes and its MIT reuse policy", () => {
  assert.equal(manifest.version, "Godot 4.x");
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.distribution_policy, "mit_source_reuse");
  assert.equal(manifest.node_count, 93);
  assert.equal(manifest.effect_node_count, 77);
  assert.equal(manifest.tool_node_count, 16);
  assert.equal(new Set(manifest.nodes.map((node) => node.node_id)).size, 93);
  assert.ok(manifest.nodes.every((node) => node.gd_path.startsWith("addons/shaderV/") && node.gd_path.endsWith(".gd")));
});

test("every ShaderV node becomes an individual searchable Atlas record", () => {
  assert.equal(entries.length, 93);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 93);
  assert.ok(entries.every((entry) => entry.source === "ShaderV"));
  assert.ok(entries.every((entry) => entry.version.startsWith("4.x")));
  assert.ok(entries.every((entry) => entry.url.includes(manifest.commit)));
  assert.ok(entries.every((entry) => entry.visualTags.length > 0));
  assert.equal((bundle.match(/"id":"shaderv4-/g) ?? []).length, 93);
  assert.equal(bundle.split(SHADERV_BLOCK_START).length - 1, 1);
  assert.equal(bundle.split(SHADERV_BLOCK_END).length - 1, 1);
});

test("public audits include the 93 locked ShaderV node pages", () => {
  const semanticRecords = semanticAudit.records.filter((record) => record.effectId.startsWith("shaderv4-"));
  const linkRecords = linkAudit.links.filter((record) => record.effectId.startsWith("shaderv4-"));
  assert.equal(semanticAudit.totalEffects, 1243);
  assert.equal(semanticRecords.length, 93);
  assert.equal(linkRecords.length, 93);
  assert.ok(linkRecords.every((record) => record.status === 200 && record.titleMatches));
  assert.equal(auditReport.finalUniqueEffects, 1243);
  assert.equal(auditReport.sourceStats.ShaderV, 93);
});

test("public ShaderV metadata contains no consuming-project details", () => {
  const publicData = JSON.stringify({ manifest, entries });
  assert.doesNotMatch(publicData, /山海|Myths-of-Shan-Hai|res:\/\/|[A-Z]:\\/i);
});

test("the public material library is consistently named 资产贴图库", async () => {
  const files = ["index.html", "materials.html", "README.md", "docs/material-library.md", "docs/vfx-authoring-workflow.md"];
  for (const relativePath of files) {
    const text = await readFile(path.join(repoRoot, relativePath), "utf8");
    assert.doesNotMatch(text, /生产贴图库/, relativePath);
  }
  assert.match(indexHtml, /资产贴图库/);
});
