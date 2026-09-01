---
name: godot-fx-atlas
description: Search Godot FX Atlas for real Godot 2D VFX references, implementation approaches, and licensed raster assets. Use for reference research, source-traceable material selection, or when godot-vfx-factory needs Atlas evidence; let godot-vfx-factory orchestrate full project implementation.
---

# Godot FX Atlas

## Locate the Atlas

Run `node scripts/resolve-atlas-root.mjs` from this Skill directory and treat its output as `<atlas-root>`. The resolver follows an installed junction or symlink back to the real Atlas checkout, so do not derive the repository root with `../..` yourself.

Use the Atlas as two connected but distinct layers:

1. The existing public site is the search engine and implementation-approach index. It helps discover real plugins, shaders, packs, visual references, and the site's per-entry implementation notes.
2. `<atlas-root>/materials/catalog.json` is the locally distributable raster library, with semantic uses and file hashes.

Do not treat a reference-index result as permission to copy its files. Only material records whose source is `direct_use` may be packaged from the local library.

## Context and output budget

Atlas research often touches large indexes and many images. Keep those payloads out of the model stream so a useful research result does not become an unrecoverable oversized task.

- Keep each shell or MCP result below 256 KiB and 200 lines. Parse large JSON locally, save the complete result as a temporary/project artifact when it is genuinely needed, and return only the selected IDs, evidence fields, licenses, cautions, and errors.
- Never print an entire catalog, index, lock file, or unfiltered query result. Use focused queries and field selection; read only the records needed for the current decision.
- Do not attach many original images to one model turn. For a batch, first make one deterministic contact sheet no larger than 1200 px on its longest side. Inspect at most one original-resolution image in a later turn when the contact sheet cannot answer a material question.
- GPU captures and test runs must write verbose logs to files; surface only the exit status, error lines, bounded tail, and paths to the retained evidence.
- Record a compact project-local checkpoint after research, selection, implementation, and GPU QA. Later phases consume that checkpoint instead of replaying raw Atlas output.
- If a task has already failed with `stream disconnected before completion` after a large payload, do not resume or fork that history. Preserve the disk checkpoint and require a fresh task with only the goal, paths, and checkpoint summary.

## Research the effect

1. Read `<atlas-root>/docs/vfx-authoring-workflow.md` for the production and validation workflow.
2. Translate the request into mechanism terms and visual-language terms.
3. Run `node scripts/query-atlas.mjs --query "<mechanism and visual terms>" --archetype <optional> --role <optional> --limit 12` to rank both reference effects and local materials. Treat the result as candidate discovery, not final artistic judgment.
4. Cross-check candidates in `<atlas-root>/mechanism-index.json`, `<atlas-root>/visual-tag-index.json`, and `<atlas-root>/semantic-audit.json`, then inspect them in the Atlas website to read the complete record, source evidence, and implementation approach.
   For ShaderV results, `<atlas-root>/reference-sources/shaderv-godot4.json` is the locked Godot 4.x node manifest and source-license authority; each node record links to its exact file at the audited commit.
5. Extract reusable behavior: silhouette, motion, phases, layer roles, finishing, and Godot technique. Public open-source code may be inspected, tested, and reused when its recorded license permits it; preserve the required license and attribution. Do not copy protected, private, or license-unknown artwork or code merely because it appears in the reference search.
6. Adapt naming, color, symbols, event hooks, paths, and gameplay timing to the consuming project. Never write consuming-project details back into Atlas.

## Select materials

1. Read `<atlas-root>/materials/catalog.json` and `<atlas-root>/materials/sources.lock.json`.
2. Filter first by `archetypes`, then by `roles`, `family`, and semantic `tags`.
3. Prefer the `transparent` file variant for particles, grayscale masks, and Shader input. Use a black-background variant only when the target blend pipeline explicitly needs it.
4. Read `recommended_use` and `caution` before recommending an asset. A texture is a shape or finishing layer, not a complete effect identity.
5. Keep the set small. Recommend a primary `shape` asset and at most a few `finish` assets unless the request justifies more.

Read [catalog-contract.md](references/catalog-contract.md) before exporting a selection or copying files. When `godot-vfx-factory` is active, return the reference IDs, material IDs, receipts, and cautions to that workflow instead of independently directing the entire skill performance.

## Deliver the result

For an advisory request, return:

- selected Atlas effect IDs and why their implementation approaches match;
- selected material IDs grouped by `shape` and `finish`;
- a proposed layer/timeline/Godot-node plan plus acceptance checks;
- source, license, and distribution policy.

For a project modification request, additionally:

1. Copy only explicitly selected raster files into the destination project's resource structure.
2. Preserve file names or maintain a deterministic mapping.
3. Create a selection manifest beside the copied assets or in the project's audit/docs area.
4. Verify every copied file against its catalog SHA-256.
5. Reuse public code or plugins only when the recorded license permits it and preserve the required license and attribution. Never copy private, protected, license-unknown, binary, or unrelated project content.

Never write a consuming project's name, characters, skills, card IDs, design text, file paths, private screenshots, or integration state back into the public Atlas repository.

Do not download or refresh external sources during normal selection. Source refresh is a separate maintenance task that requires explicit network authorization, license review, sanitization, and source-lock updates.
