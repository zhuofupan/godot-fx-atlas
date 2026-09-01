# Atlas catalog contract

Use this reference only when exporting a selection or copying materials into another project.

## Authority

- Run `node scripts/resolve-atlas-root.mjs` from the Skill directory and use its output as `<atlas-root>`.
- `<atlas-root>/materials/sources.lock.json` is authoritative for source identity, license, version, archive hash, sanitization receipt, and distribution policy.
- `<atlas-root>/materials/catalog.json` is authoritative for logical material IDs, semantic classification, relative files, file dimensions, transparency metadata, and file hashes.
- `<atlas-root>/mechanism-index.json`, `<atlas-root>/visual-tag-index.json`, and `<atlas-root>/semantic-audit.json` are discovery and evidence indexes for the existing website's reference entries.

Do not infer the Atlas root from the installed Skill path: user-level installations may be junctions or symlinks.

## Selection manifest

Write JSON with this minimum structure:

```json
{
  "schema_version": 1,
  "manifest_type": "godot_fx_atlas_material_selection",
  "generated_at": "ISO-8601 timestamp",
  "preferred_variant": "transparent",
  "reference_effect_ids": ["fx-0001"],
  "implementation_notes": "Project-specific layer and timing decisions",
  "source_receipts": [],
  "materials": []
}
```

Each source receipt must retain `source_id`, `version`, `license`, `browse_url`, `archive_sha256`, `sanitization_manifest_sha256`, and `distribution_policy`. Each material must retain its `material_id`, intended layer role, source ID, selected relative path, and SHA-256.

## Policy handling

- `direct_use`: the audited local raster may be copied, subject to the recorded license.
- `reference_only`: cite and link the original page; do not copy or redistribute files.
- `blocked`: do not recommend for production use until the source is reviewed again.

Never infer redistribution permission from a resource being free of charge. Never use a screenshot or preview image as a substitute for an approved distributable file.

## Integrity check

Before copying, resolve the file beneath the Atlas repository root and reject any path containing traversal segments. After copying, calculate SHA-256 and compare it with the catalog record. A mismatch means the file or catalog is stale; stop and report it instead of silently updating the receipt.
