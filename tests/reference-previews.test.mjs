import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { extractReferencePreview, normalizeRemoteImageUrl } from "../src/reference-preview-core.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "reference-previews.json"), "utf8"));
const linkAudit = JSON.parse(await readFile(path.join(repoRoot, "final-link-audit.json"), "utf8"));
const indexHtml = await readFile(path.join(repoRoot, "index.html"), "utf8");
const previewClient = await readFile(path.join(repoRoot, "src", "reference-card-previews.js"), "utf8");
const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");

test("preview metadata extraction supports source-page conventions without downloading images", () => {
  assert.deepEqual(
    extractReferencePreview('<meta property="og:image" content="/preview.gif?x=1&amp;y=2">', "https://example.com/effect"),
    { imageUrl: "https://example.com/preview.gif?x=1&y=2", discovery: "og:image" }
  );
  assert.deepEqual(
    extractReferencePreview('<meta name="thumbnail" content="/icons/effect.png">', "https://example.com/effect"),
    { imageUrl: "https://example.com/icons/effect.png", discovery: "thumbnail" }
  );
  assert.equal(normalizeRemoteImageUrl("http://example.com/effect.png", "https://example.com/page"), "https://example.com/effect.png");
  assert.equal(normalizeRemoteImageUrl("http://images.example.net/effect.png", "https://example.com/page"), null);
  assert.equal(normalizeRemoteImageUrl("data:image/png;base64,AAAA", "https://example.com/page"), null);
});

test("preview manifest stores only remote URLs and covers most indexed effects", () => {
  const primaryById = new Map(linkAudit.links.filter((link) => link.kind === "primary").map((link) => [link.effectId, link.url]));
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.policy, "remote_url_only");
  assert.equal(manifest.total_effects, primaryById.size);
  assert.equal(manifest.entry_count, manifest.entries.length);
  assert.equal(manifest.fallback_count, manifest.total_effects - manifest.entry_count);
  assert.ok(manifest.entry_count >= 1100, `remote preview coverage regressed to ${manifest.entry_count}/${manifest.total_effects}`);
  assert.equal(new Set(manifest.entries.map((entry) => entry.effectId)).size, manifest.entry_count);
  for (const entry of manifest.entries) {
    assert.equal(entry.pageUrl, primaryById.get(entry.effectId));
    assert.equal(new URL(entry.imageUrl).protocol, "https:");
    assert.equal(entry.imageHost, new URL(entry.imageUrl).host);
    assert.doesNotMatch(entry.imageUrl, /^(?:\.\/|\/|[A-Z]:\\)/i);
  }
});

test("homepage loads remote previews lazily and keeps the abstract fallback", () => {
  assert.match(indexHtml, /reference-card-previews\.js/);
  assert.match(indexHtml, /reference-card-previews\.css/);
  assert.match(previewClient, /loading = "lazy"/);
  assert.match(previewClient, /IntersectionObserver/);
  assert.match(previewClient, /previewObserver\.observe\(visual\)/);
  assert.match(previewClient, /rootMargin: "240px 0px"/);
  assert.match(previewClient, /referrerPolicy = "no-referrer"/);
  assert.match(previewClient, /addEventListener\("error"/);
  assert.match(previewClient, /fallback/);
});

test("README puts the production workflow before the final credits section", () => {
  const workflow = readme.indexOf("## 技能视觉导演与制作流程");
  const credits = readme.indexOf("## 鸣谢");
  assert.ok(workflow >= 0 && credits > workflow);
  assert.equal(readme.trim().split("\n").filter((line) => line.startsWith("## ")).at(-1), "## 鸣谢");
  assert.match(readme, /不下载、不缓存、不重新分发原图/);
});
