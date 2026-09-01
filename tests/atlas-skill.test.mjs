import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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
  assert.doesNotMatch(skillText, /\[TODO/);
});

test("all repository-relative resources referenced by the skill exist", async () => {
  const paths = [...skillText.matchAll(/`(\.\.\/\.\.\/[^`]+)`/g)].map((match) => match[1]);
  assert.ok(paths.length >= 5);
  for (const relativePath of paths) {
    const absolutePath = path.resolve(skillRoot, relativePath);
    assert.equal((await stat(absolutePath)).isFile(), true, relativePath);
  }
  assert.equal((await stat(path.join(skillRoot, "references", "catalog-contract.md"))).isFile(), true);
  assert.equal((await stat(path.join(skillRoot, "agents", "openai.yaml"))).isFile(), true);
});
