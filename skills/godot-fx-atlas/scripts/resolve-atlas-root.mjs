import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "mechanism-index.json",
  "semantic-audit.json",
  "visual-tag-index.json",
  "materials/catalog.json",
  "materials/sources.lock.json",
  "docs/vfx-authoring-workflow.md",
  "docs/vfx-production-retrospective.md",
  "skills/godot-fx-atlas/skill-manifest.json"
];

export async function resolveAtlasRoot(skillDirectory = path.resolve(import.meta.dirname, "..")) {
  const realSkillDirectory = await realpath(skillDirectory);
  const atlasRoot = path.resolve(realSkillDirectory, "..", "..");
  for (const relativePath of REQUIRED_FILES) {
    const record = await stat(path.join(atlasRoot, relativePath));
    if (!record.isFile()) throw new Error(`Atlas root is missing ${relativePath}: ${atlasRoot}`);
  }
  return atlasRoot;
}

const invokedPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => "") : "";
const currentPath = await realpath(fileURLToPath(import.meta.url));
if (invokedPath && invokedPath.toLocaleLowerCase("en") === currentPath.toLocaleLowerCase("en")) {
  process.stdout.write(`${await resolveAtlasRoot()}\n`);
}
