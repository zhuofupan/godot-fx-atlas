import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(await readFile(path.join(repoRoot, "materials", "catalog.json"), "utf8"));
const sourceLock = JSON.parse(await readFile(path.join(repoRoot, "materials", "sources.lock.json"), "utf8"));
const taxonomy = JSON.parse(await readFile(path.join(repoRoot, "materials", "material-taxonomy.json"), "utf8"));

test("catalog has one indexed record per logical material", () => {
  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.catalog_type, "production_material_library");
  assert.equal(catalog.entry_count, 185);
  assert.equal(catalog.sources.length, 3);
  assert.equal(catalog.entries.length, catalog.entry_count);
  assert.equal(new Set(catalog.entries.map((entry) => entry.material_id)).size, catalog.entry_count);
});

test("every material is classified and comes from an approved source", () => {
  const sources = new Map(sourceLock.sources.map((source) => [source.source_id, source]));
  for (const entry of catalog.entries) {
    const source = sources.get(entry.source_id);
    assert.ok(source, `unknown source for ${entry.material_id}`);
    assert.equal(source.distribution_policy, "direct_use");
    assert.equal(entry.distribution_policy, "direct_use");
    assert.equal(entry.license, source.license);
    assert.ok(taxonomy.families[entry.family], `unclassified family: ${entry.family}`);
    assert.ok(entry.roles.length > 0);
    assert.ok(entry.archetypes.length > 0);
    assert.ok(entry.recommended_use.length > 0);
    assert.ok(entry.caution.length > 0);
  }
});

test("all indexed raster variants exist and match the generated receipt", async () => {
  let rasterCount = 0;
  for (const entry of catalog.entries) {
    assert.ok(entry.files.transparent, `${entry.material_id} has no production transparent variant`);
    assert.equal(entry.files.transparent.has_transparency, true, `${entry.material_id} transparent variant has no transparency`);
    for (const record of Object.values(entry.files)) {
      assert.ok(record.path.startsWith("./materials/library/"));
      assert.equal(record.path.includes(".."), false);
      const absolutePath = path.join(repoRoot, record.path.slice(2));
      const bytes = await readFile(absolutePath);
      const digest = createHash("sha256").update(bytes).digest("hex");
      assert.equal(digest, record.sha256, record.path);
      assert.equal(bytes.length, record.bytes);
      assert.ok(record.width > 0 && record.height > 0);
      rasterCount += 1;
    }
  }
  assert.equal(rasterCount, 293);
});

test("license evidence and both web entry points are present", async () => {
  for (const source of sourceLock.sources) {
    const licensePath = path.join(repoRoot, "materials", "licenses", `${source.source_id}.txt`);
    assert.equal((await stat(licensePath)).isFile(), true);
  }
  const indexHtml = await readFile(path.join(repoRoot, "index.html"), "utf8");
  const materialsHtml = await readFile(path.join(repoRoot, "materials.html"), "utf8");
  assert.match(indexHtml, /href="\.\/materials\.html"/);
  assert.match(indexHtml, />资产贴图库 <span>185<\/span>/);
  assert.match(materialsHtml, /src="\.\/assets\/material-library\.js"/);
  assert.match(materialsHtml, /href="\.\/assets\/material-library\.css"/);
});
