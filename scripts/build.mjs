import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildShaderVEntries,
  injectReferenceSupplement,
  updateAuditReport,
  updateFinalLinkAudit,
  updateSemanticAudit,
  updateVisualTagIndex
} from "../src/reference-supplement.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceFiles = [
  ["src/material-core.js", "assets/material-core.js"],
  ["src/material-library.js", "assets/material-library.js"],
  ["src/material-library.css", "assets/material-library.css"],
  ["src/material-library-entry.css", "assets/material-library-entry.css"],
  ["src/site-footer-sources.js", "assets/site-footer-sources.js"]
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

const indexHtmlPath = path.join(repoRoot, "index.html");
const indexHtml = await readFile(indexHtmlPath, "utf8");
const bundleMatch = indexHtml.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
if (!bundleMatch) throw new Error("Could not resolve the published Atlas bundle from index.html.");

const manifest = JSON.parse(await readFile(path.join(repoRoot, "reference-sources", "shaderv-godot4.json"), "utf8"));
const shaderVEntries = buildShaderVEntries(manifest);
const bundlePath = path.join(repoRoot, "assets", bundleMatch[1]);
const bundle = await readFile(bundlePath, "utf8");
await writeFile(bundlePath, injectReferenceSupplement(bundle, shaderVEntries), "utf8");

const generatedAt = manifest.audited_at;
const semanticPath = path.join(repoRoot, "semantic-audit.json");
const semanticAudit = updateSemanticAudit(JSON.parse(await readFile(semanticPath, "utf8")), shaderVEntries, generatedAt);
await writeJson(semanticPath, semanticAudit);

const visualPath = path.join(repoRoot, "visual-tag-index.json");
const visualIndex = updateVisualTagIndex(JSON.parse(await readFile(visualPath, "utf8")), semanticAudit, generatedAt);
await writeJson(visualPath, visualIndex);

const linksPath = path.join(repoRoot, "final-link-audit.json");
const linkAudit = updateFinalLinkAudit(JSON.parse(await readFile(linksPath, "utf8")), shaderVEntries, semanticAudit, generatedAt);
await writeJson(linksPath, linkAudit);

const reportPath = path.join(repoRoot, "audit-report.json");
const auditReport = updateAuditReport(JSON.parse(await readFile(reportPath, "utf8")), shaderVEntries, semanticAudit, linkAudit, generatedAt);
await writeJson(reportPath, auditReport);

console.log(`Built ${catalog.entry_count} logical materials and ${shaderVEntries.length} ShaderV 4.x node references.`);

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
