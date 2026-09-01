import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildSelectionManifest, filterMaterials, uniqueValues } from "../src/material-core.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(await readFile(path.join(repoRoot, "materials", "catalog.json"), "utf8"));
const sourceLock = JSON.parse(await readFile(path.join(repoRoot, "materials", "sources.lock.json"), "utf8"));

test("filters combine query, family, archetype and role", () => {
  const filtered = filterMaterials(catalog.entries, {
    query: "拖尾",
    family: "flame",
    archetype: "projectile_trail",
    role: "shape"
  });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((entry) => entry.family === "flame"));
  assert.ok(filtered.every((entry) => entry.archetypes.includes("projectile_trail")));
});

test("uniqueValues flattens list fields without duplicates", () => {
  const values = uniqueValues(catalog.entries, "archetypes");
  assert.ok(values.includes("impact_burst"));
  assert.equal(values.length, new Set(values).size);
});

test("selection manifest includes only selected materials and their source receipt", () => {
  const selectedEntry = catalog.entries[0];
  const manifest = buildSelectionManifest(catalog.entries, new Set([selectedEntry.material_id]), sourceLock.sources);
  assert.equal(manifest.materials.length, 1);
  assert.equal(manifest.materials[0].material_id, selectedEntry.material_id);
  assert.equal(manifest.source_receipts.length, 1);
  assert.equal(manifest.source_receipts[0].source_id, selectedEntry.source_id);
  assert.equal(manifest.source_receipts[0].distribution_policy, "direct_use");
});

test("selection manifest preserves sprite-sheet slicing metadata", () => {
  const selectedEntry = catalog.entries.find((entry) => entry.source_id === "oga-para-particlefx-1");
  const manifest = buildSelectionManifest(catalog.entries, new Set([selectedEntry.material_id]), sourceLock.sources, "sprite_sheet");
  assert.equal(manifest.materials[0].asset_kind, "sprite_sheet");
  assert.deepEqual(manifest.materials[0].frame_grid, selectedEntry.frame_grid);
  assert.equal(manifest.preferred_variant, "sprite_sheet");
});
