---
name: godot-fx-atlas
description: Research, plan, and assemble Godot 2D VFX with Godot FX Atlas. Use when a user asks to search real effect references, extract an implementation approach, choose licensed texture masks, create a source-traceable material selection, or implement an effect in a Godot project.
---

# Godot FX Atlas

Use the Atlas as two connected but distinct layers:

1. The existing public site is the search engine and implementation-approach index. It helps discover real plugins, shaders, packs, visual references, and the site's per-entry implementation notes.
2. `../../materials/catalog.json` is the new locally distributable raster library, with semantic uses and file hashes.

Do not treat a reference-index result as permission to copy its files. Only material records whose source is `direct_use` may be packaged from the local library.

## Research the effect

1. Read `../../docs/vfx-authoring-workflow.md` for the production and validation workflow.
2. Translate the request into mechanism terms and visual-language terms.
3. Use `../../mechanism-index.json` to find candidate effect IDs by gameplay behavior, and `../../visual-tag-index.json` to find candidates by shape, material, motion, rhythm, and presentation use.
4. Cross-check candidates in `../../semantic-audit.json`, then inspect them in the Atlas website to read the complete record, source evidence, and implementation approach.
   For ShaderV results, `../../reference-sources/shaderv-godot4.json` is the locked Godot 4.x node manifest and source-license authority; each node record links to its exact file at the audited commit.
5. Extract reusable behavior: silhouette, motion, phases, layer roles, finishing, and Godot technique. Public open-source code may be inspected, tested, and reused when its recorded license permits it; preserve the required license and attribution. Do not copy protected, private, or license-unknown artwork or code merely because it appears in the reference search.
6. Adapt naming, color, symbols, event hooks, paths, and gameplay timing to the consuming project. Never write consuming-project details back into Atlas.

## Select materials

1. Read `../../materials/catalog.json` and `../../materials/sources.lock.json`.
2. Filter first by `archetypes`, then by `roles`, `family`, and semantic `tags`.
3. Prefer the `transparent` file variant for particles, grayscale masks, and Shader input. Use a black-background variant only when the target blend pipeline explicitly needs it.
4. Read `recommended_use` and `caution` before recommending an asset. A texture is a shape or finishing layer, not a complete effect identity.
5. Keep the set small. Recommend a primary `shape` asset and at most a few `finish` assets unless the request justifies more.

Read [catalog-contract.md](references/catalog-contract.md) before exporting a selection or copying files.

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
