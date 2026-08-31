import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceFiles = [
  ["src/material-core.js", "assets/material-core.js"],
  ["src/material-library.js", "assets/material-library.js"],
  ["src/material-library.css", "assets/material-library.css"],
  ["src/material-library-entry.css", "assets/material-library-entry.css"]
];

for (const [sourceRelative, targetRelative] of sourceFiles) {
  const sourcePath = path.join(repoRoot, sourceRelative);
  const targetPath = path.join(repoRoot, targetRelative);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}

const catalog = JSON.parse(await readFile(path.join(repoRoot, "materials", "catalog.json"), "utf8"));
const materialPage = await readFile(path.join(repoRoot, "materials.html"), "utf8");
if (!materialPage.includes("./assets/material-library.js")) throw new Error("materials.html does not load the material library module.");
if (catalog.entry_count !== catalog.entries.length) throw new Error("Material catalog entry_count is stale.");

console.log(`Built material library assets for ${catalog.entry_count} logical materials.`);
