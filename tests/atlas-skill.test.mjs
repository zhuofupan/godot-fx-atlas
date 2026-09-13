import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = path.resolve(import.meta.dirname, "..");
const skillRoot = path.join(repoRoot, "skills", "godot-fx-atlas");
const skillText = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
const retrospectivePath = path.join(repoRoot, "docs", "vfx-production-retrospective.md");
const retrospectiveText = await readFile(retrospectivePath, "utf8");
const manifest = JSON.parse(await readFile(path.join(skillRoot, "skill-manifest.json"), "utf8"));

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
  assert.equal((await stat(path.join(skillRoot, "scripts", "install-skill.mjs"))).isFile(), true);
  assert.equal(manifest.repository_url, "https://github.com/zhuofupan/godot-fx-atlas.git");
  assert.equal((await stat(retrospectivePath)).isFile(), true);
});

test("Atlas skill preserves production gates and evidence states", () => {
  assert.match(skillText, /vfx-production-retrospective\.md/);
  assert.match(skillText, /forward-axis contract/);
  for (const state of ["generated_candidate", "gpu_validated", "visual_approved", "project_integrated"]) {
    assert.match(skillText, new RegExp(state));
    assert.match(retrospectiveText, new RegExp(state));
  }
  assert.match(retrospectiveText, /严格生产流程：G0–G9/);
  assert.match(retrospectiveText, /反馈处理协议/);
  assert.match(retrospectiveText, /独立游戏生产级 Definition of Done/);
});

test("installed-skill resolver finds the Atlas repository root", async () => {
  const { stdout } = await execFileAsync(process.execPath, [path.join(skillRoot, "scripts", "resolve-atlas-root.mjs")]);
  assert.equal(path.resolve(stdout.trim()), repoRoot);
});

test("installer creates a resolvable Skill link without copying the repository", async () => {
  const temporaryCodexHome = await mkdtemp(path.join(tmpdir(), "godot-fx-atlas-skill-"));
  try {
    const installerPath = path.join(skillRoot, "scripts", "install-skill.mjs");
    const { stdout } = await execFileAsync(process.execPath, [installerPath, "--codex-home", temporaryCodexHome]);
    const result = JSON.parse(stdout);
    const installedSkill = path.join(temporaryCodexHome, "skills", "godot-fx-atlas");
    assert.equal(result.skill_version, manifest.skill_version);
    assert.equal(path.resolve(await realpath(installedSkill)), path.resolve(await realpath(skillRoot)));
    const { stdout: repeatedStdout } = await execFileAsync(process.execPath, [installerPath, "--codex-home", temporaryCodexHome]);
    assert.equal(JSON.parse(repeatedStdout).action, "keep");
    const { stdout: resolvedRoot } = await execFileAsync(process.execPath, [path.join(installedSkill, "scripts", "resolve-atlas-root.mjs")]);
    assert.equal(path.resolve(resolvedRoot.trim()), repoRoot);
  } finally {
    await rm(temporaryCodexHome, { recursive: true, force: true });
  }
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
