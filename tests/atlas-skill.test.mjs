import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(import.meta.dirname, "..");
const skillRoot = path.join(repoRoot, "skills", "godot-fx-atlas");
const skillText = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");

test("Atlas skill connects the existing search engine to the material library", () => {
  assert.match(skillText, /mechanism-index\.json/);
  assert.match(skillText, /visual-tag-index\.json/);
  assert.match(skillText, /semantic-audit\.json/);
  assert.match(skillText, /materials\/catalog\.json/);
  assert.match(skillText, /direct_use/);
  assert.match(skillText, /公开源码|public open-source/i);
  assert.match(skillText, /Never write a consuming project's name/);
  assert.match(skillText, /query-atlas\.mjs/);
  assert.match(skillText, /resolve-atlas-root\.mjs/);
  assert.doesNotMatch(skillText, /\[TODO/);
});

test("all repository-relative resources referenced by the skill exist", async () => {
  assert.equal((await stat(path.join(skillRoot, "references", "catalog-contract.md"))).isFile(), true);
  assert.equal((await stat(path.join(skillRoot, "agents", "openai.yaml"))).isFile(), true);
  assert.equal((await stat(path.join(skillRoot, "scripts", "resolve-atlas-root.mjs"))).isFile(), true);
  assert.equal((await stat(path.join(skillRoot, "scripts", "query-atlas.mjs"))).isFile(), true);
});

test("installed-skill resolver finds the Atlas repository root", async () => {
  const { stdout } = await execFileAsync(process.execPath, [path.join(skillRoot, "scripts", "resolve-atlas-root.mjs")]);
  assert.equal(path.resolve(stdout.trim()), repoRoot);
});

test("Atlas query returns ranked references and audited material receipts", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    path.join(skillRoot, "scripts", "query-atlas.mjs"),
    "--query", "治疗 光环",
    "--archetype", "status_aura",
    "--limit", "5"
  ]);
  const result = JSON.parse(stdout);
  assert.equal(result.catalog_receipt.logical_materials, 715);
  assert.ok(result.references.length > 0);
  assert.ok(result.materials.length > 0);
  assert.ok(result.materials.every((material) => material.archetypes.includes("status_aura")));
  assert.ok(result.materials.every((material) => material.source.distribution_policy === "direct_use"));
});
