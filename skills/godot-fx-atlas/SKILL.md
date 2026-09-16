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

## Choose the operating mode

Load only the guidance required by the request:

| Mode | Read and do |
| --- | --- |
| Reference research | Query the Atlas and inspect selected public records; do not load the full production manuals merely to return references. |
| Material selection/export | Read [catalog-contract.md](references/catalog-contract.md), then verify license, receipt, distribution policy, and SHA-256. |
| Animation, direction, or production planning | Read `<atlas-root>/docs/vfx-authoring-workflow.md` completely before proposing the plan. |
| Pre-flight composition, selection, or sizing before engine work | **Out of scope for Atlas.** The pre-flight workbench now lives inside the consuming Godot project (`fx_kit/preflight`, opened from the VFX Lab top bar). Atlas is a reference library only; do not look for a workbench page here. |
| Rejected, repeatedly revised, or production-grade effect | Read both workflow documents completely, including `<atlas-root>/docs/vfx-production-retrospective.md`, and apply its failure gates, evidence states, and review protocol. |
| Full consuming-project implementation | Let `godot-vfx-factory` orchestrate project inspection, authoring, GPU QA, and integration. Supply it with the bounded Atlas evidence packet instead of running a competing production process. |

## Context and output budget

Atlas research often touches large indexes and many images. These are conservative workflow budgets, not documented service limits or proof that payload size caused a transport error.

- Keep each shell or MCP result below 256 KiB and 200 lines. Parse large JSON locally, save the complete result as a temporary/project artifact when it is genuinely needed, and return only the selected IDs, evidence fields, licenses, cautions, and errors.
- Never print an entire catalog, index, lock file, or unfiltered query result. Use focused queries and field selection; read only the records needed for the current decision.
- Inspect images through the image channel; never stringify image tool results or print base64/data URLs as text. For a batch, prefer a labeled contact sheet no larger than 1200 px on its longest side when deterministic preview processing is permitted. Inspect original images or crops individually when detail is insufficient; a contact sheet does not replace identity, Alpha, edge, pivot, or direction checks.
- GPU captures and test runs must write verbose logs to files; surface only the exit status, error lines, bounded tail, and paths to the retained evidence.
- Record a compact project-local checkpoint after contract, direction approval, asset selection, implementation, GPU QA, and integration. Later phases consume that checkpoint instead of replaying raw Atlas output.
- After repeated transport failures, stop blind retries, preserve the disk checkpoint, and report the error without assuming a cause. When a fresh task is authorized, carry only the goal, paths, current quality state, verified evidence, unresolved issues, and next safe action.
- Read required instruction files completely in bounded chunks. Checkpoints prevent redundant reads within a task, but cannot replace instructions a fresh task must read. These budgets do not authorize changing models, migrating history, restarting applications, or creating tasks.

## Research the effect

1. Select the operating mode above and read only its required documents.
2. Translate the request into mechanism terms and visual-language terms. For production planning, freeze an effect contract, visual-direction card, real-scene primitive animatic, and explicit rejection list before expensive asset generation or multilayer implementation. Apply the workflow's director/beat-sheet and temporal-coherence/exposure-sheet guidance to animated effects. Do not compensate for an unapproved silhouette or motion path with more particles, glow, flowers, rings, or noise.
3. Run `node scripts/query-atlas.mjs --query "<mechanism and visual terms>" --archetype <optional> --role <optional> --limit 12` to rank both reference effects and local materials. Treat the result as candidate discovery, not final artistic judgment.
4. Cross-check candidates in `<atlas-root>/mechanism-index.json`, `<atlas-root>/visual-tag-index.json`, and `<atlas-root>/semantic-audit.json`, then inspect them in the Atlas website to read the complete record, source evidence, and implementation approach.
   For ShaderV results, `<atlas-root>/reference-sources/shaderv-godot4.json` is the locked Godot 4.x node manifest and source-license authority; each node record links to its exact file at the audited commit.
5. Extract reusable behavior: silhouette, motion, phases, layer roles, finishing, and Godot technique. Public open-source code may be inspected, tested, and reused when its recorded license permits it; preserve the required license and attribution. Do not copy protected, private, or license-unknown artwork or code merely because it appears in the reference search.
6. Adapt naming, color, symbols, event hooks, paths, and gameplay timing to the consuming project. Never write consuming-project details back into Atlas.

For directional assets, require a forward-axis contract: canonical forward direction, pivot, tail and leading-edge landmarks, per-frame ambiguity notes, and the runtime rotation formula. Automated long-axis estimates may assist inspection but never decide head versus tail. Verify the asset in the target renderer with a one-layer probe before composing the full effect.

## Pre-flight before implementation

The usual feedback loop — implement, open the engine, probe/screenshot, look, rework — pays the most
expensive medium first, before the plan itself is settled.

That judgment now happens **inside the consuming Godot project**, not here. Atlas used to host a
browser-based workbench page (`workbench.html`); it was migrated to an in-engine pre-flight mode
(`fx_kit/preflight`, reached from the VFX Lab top bar) and the page has been removed. Engine-side
inspection beats a browser approximation, and it needs no dev server, no HTTP write-back path, and no
public-repository data-pack exclusion.

Consequences for this skill:

- **Reference research still belongs here.** Use the Atlas website and index files to gather candidate
  motifs, motion references, and licensed materials; hand them to the consuming project as an evidence
  packet.
- **Do not tell anyone to open a workbench page or run `npm run build:workbench`.** Neither exists.
- The data-pack and decision-file schemas (`fx-preflight-bundle/1`, `fx-preflight-decisions/1`) still
  describe the hand-off contract, but their authority is the consuming project's
  `fx_kit/preflight/` module and its `README.md`. Atlas carries no copy of them.

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

Report quality with evidence states, never with a single ambiguous word such as “complete”:

1. `generated_candidate`: files exist and static validation passes;
2. `gpu_validated`: the target renderer produced bounded visual evidence;
3. `visual_approved`: a human explicitly approved the real-scene result;
4. `project_integrated`: the formal event/lifecycle path and regression matrix pass.

Do not claim independent-game production readiness before all four states are satisfied. Headless loading, nonzero Alpha, compiled shaders, existing nodes, screenshots, or a zero process exit code cannot substitute for human visual approval or formal integration.

Never write a consuming project's name, characters, skills, card IDs, design text, file paths, private screenshots, or integration state back into the public Atlas repository.

Do not download or refresh external sources during normal selection. Source refresh is a separate maintenance task that requires explicit network authorization, license review, sanitization, and source-lock updates.
