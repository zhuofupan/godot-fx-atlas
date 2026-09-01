const SEARCH_FIELDS = ["title", "family", "family_label", "recommended_use", "caution"];

export function filterMaterials(entries, filters = {}) {
  const query = normalize(filters.query);
  return entries.filter((entry) => {
    if (filters.family && entry.family !== filters.family) return false;
    if (filters.archetype && !entry.archetypes.includes(filters.archetype)) return false;
    if (filters.role && !entry.roles.includes(filters.role)) return false;
    if (filters.source && entry.source_id !== filters.source) return false;
    if (!query) return true;

    const searchable = [
      ...SEARCH_FIELDS.map((field) => entry[field] ?? ""),
      ...entry.tags,
      ...entry.roles,
      ...entry.archetypes
    ].join(" ");
    return normalize(searchable).includes(query);
  });
}

export function uniqueValues(entries, field) {
  return [...new Set(entries.flatMap((entry) => {
    const value = entry[field];
    return Array.isArray(value) ? value : [value];
  }).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function buildSelectionManifest(entries, selectedIds, sources, preferredVariant = "transparent") {
  const selected = entries.filter((entry) => selectedIds.has(entry.material_id));
  const sourceIds = new Set(selected.map((entry) => entry.source_id));

  return {
    schema_version: 1,
    manifest_type: "godot_fx_atlas_material_selection",
    generated_at: new Date().toISOString(),
    preferred_variant: preferredVariant,
    source_receipts: sources
      .filter((source) => sourceIds.has(source.source_id))
      .map((source) => ({
        source_id: source.source_id,
        title: source.title,
        version: source.version,
        license: source.license,
        browse_url: source.browse_url,
        archive_sha256: source.archive_sha256,
        sanitization_manifest_sha256: source.sanitization.manifest_sha256,
        distribution_policy: source.distribution_policy,
        attribution: source.attribution
      })),
    materials: selected.map((entry) => ({
      material_id: entry.material_id,
      title: entry.title,
      family: entry.family,
      asset_kind: entry.asset_kind,
      frame_grid: entry.frame_grid,
      roles: entry.roles,
      archetypes: entry.archetypes,
      recommended_use: entry.recommended_use,
      caution: entry.caution,
      license: entry.license,
      source_id: entry.source_id,
      files: entry.files
    }))
  };
}

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN");
}
