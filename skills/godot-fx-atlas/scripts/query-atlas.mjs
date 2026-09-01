import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { resolveAtlasRoot } from "./resolve-atlas-root.mjs";

const { values } = parseArgs({
  options: {
    query: { type: "string", short: "q", default: "" },
    archetype: { type: "string", default: "" },
    role: { type: "string", default: "" },
    family: { type: "string", default: "" },
    limit: { type: "string", short: "n", default: "12" }
  },
  strict: true
});

const limit = Number.parseInt(values.limit, 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("--limit must be an integer from 1 to 100.");

const atlasRoot = await resolveAtlasRoot();
const [semanticAudit, mechanismIndex, visualIndex, materialCatalog, sourceLock] = await Promise.all([
  readJson("semantic-audit.json"),
  readJson("mechanism-index.json"),
  readJson("visual-tag-index.json"),
  readJson("materials/catalog.json"),
  readJson("materials/sources.lock.json")
]);

const tokens = tokenize(values.query);
const boostedEffectIds = collectBoostedEffectIds([...mechanismIndex.requirements, ...visualIndex.requirements], tokens);
const references = semanticAudit.records
  .map((record) => ({ record, score: scoreRecord(record, tokens) + (boostedEffectIds.get(record.effectId) ?? 0) }))
  .filter(({ score }) => score > 0 || tokens.length === 0)
  .sort((left, right) => right.score - left.score || left.record.effectId.localeCompare(right.record.effectId, "en"))
  .slice(0, limit)
  .map(({ record, score }) => ({
    score,
    effect_id: record.effectId,
    name: record.name,
    url: record.url,
    category: record.category,
    implementation_evidence: record.categoryEvidence,
    design_terms: record.designTerms,
    visual_tags: record.visualTags,
    card_tags: record.cardTags
  }));

const sourceById = new Map(sourceLock.sources.map((source) => [source.source_id, source]));
const materials = materialCatalog.entries
  .filter((entry) => !values.archetype || entry.archetypes.includes(values.archetype))
  .filter((entry) => !values.role || entry.roles.includes(values.role))
  .filter((entry) => !values.family || entry.family === values.family)
  .map((entry) => ({ entry, score: scoreRecord(entry, tokens) }))
  .filter(({ score }) => score > 0 || tokens.length === 0)
  .sort((left, right) => right.score - left.score || left.entry.material_id.localeCompare(right.entry.material_id, "en"))
  .slice(0, limit)
  .map(({ entry, score }) => {
    const variant = preferredVariant(entry.files);
    const source = sourceById.get(entry.source_id);
    return {
      score,
      material_id: entry.material_id,
      title: entry.title,
      asset_kind: entry.asset_kind,
      family: entry.family,
      roles: entry.roles,
      archetypes: entry.archetypes,
      tags: entry.tags,
      recommended_use: entry.recommended_use,
      caution: entry.caution,
      selected_variant: variant,
      selected_file: entry.files[variant],
      frame_grid: entry.frame_grid,
      source: {
        source_id: entry.source_id,
        version: source.version,
        license: source.license,
        distribution_policy: source.distribution_policy,
        browse_url: source.browse_url
      }
    };
  });

process.stdout.write(`${JSON.stringify({
  schema_version: 1,
  query: values.query,
  filters: { archetype: values.archetype, role: values.role, family: values.family },
  catalog_receipt: {
    reference_effects: semanticAudit.records.length,
    logical_materials: materialCatalog.entry_count,
    material_sources: materialCatalog.sources.length
  },
  references,
  materials
}, null, 2)}\n`);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(atlasRoot, relativePath), "utf8"));
}

function tokenize(query) {
  return [...new Set(query.normalize("NFKC").toLocaleLowerCase("en").split(/\s+/u).filter(Boolean))];
}

function scoreRecord(record, queryTokens) {
  if (queryTokens.length === 0) return 1;
  const haystack = flattenText(record).normalize("NFKC").toLocaleLowerCase("en");
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 4 : 0), 0);
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function collectBoostedEffectIds(requirements, queryTokens) {
  const boosts = new Map();
  for (const requirement of requirements) {
    if (scoreRecord(requirement, queryTokens) === 0) continue;
    for (const effectId of requirement.sampleEffectIds ?? []) boosts.set(effectId, (boosts.get(effectId) ?? 0) + 8);
  }
  return boosts;
}

function preferredVariant(files) {
  return ["transparent", "sprite_sheet", "standard", "color", "grayscale", "black"].find((variant) => files[variant]) ?? Object.keys(files)[0];
}
