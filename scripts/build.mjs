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
import { getInjectedImplementationSource, fxSelfTestResult } from "../src/reference-implementation.js";
import { buildWorkbenchData } from "./build-workbench.mjs";

if (!fxSelfTestResult) throw new Error("Implementation engine self-test failed.");

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceFiles = [
  ["src/material-core.js", "assets/material-core.js"],
  ["src/material-library.js", "assets/material-library.js"],
  ["src/material-library.css", "assets/material-library.css"],
  ["src/material-library-entry.css", "assets/material-library-entry.css"],
  ["src/site-footer-sources.js", "assets/site-footer-sources.js"],
  ["src/reference-card-previews.js", "assets/reference-card-previews.js"],
  ["src/reference-card-previews.css", "assets/reference-card-previews.css"],
  ["src/workbench.js", "assets/workbench.js"],
  ["src/workbench.css", "assets/workbench.css"]
];

for (const [sourceRelative, targetRelative] of sourceFiles) {
  const sourcePath = path.join(repoRoot, sourceRelative);
  const targetPath = path.join(repoRoot, targetRelative);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}

const catalog = JSON.parse(await readFile(path.join(repoRoot, "materials", "catalog.json"), "utf8"));
const previewManifest = JSON.parse(await readFile(path.join(repoRoot, "reference-previews.json"), "utf8"));
const materialPage = await readFile(path.join(repoRoot, "materials.html"), "utf8");
if (!materialPage.includes("./assets/material-library.js")) throw new Error("materials.html does not load the material library module.");
const workbenchPage = await readFile(path.join(repoRoot, "workbench.html"), "utf8");
if (!workbenchPage.includes("./assets/workbench.js")) throw new Error("workbench.html does not load the workbench module.");

// 预检工作台的数据包：项目无关，数据来自 project-data/（已 gitignore）。
// 没有数据包时也要能构建 —— 页面会显示导入指引，而不是报错。
await buildWorkbenchData();
if (catalog.entry_count !== catalog.entries.length) throw new Error("Material catalog entry_count is stale.");
if (previewManifest.policy !== "remote_url_only" || previewManifest.entry_count !== previewManifest.entries.length) {
  throw new Error("Reference preview manifest is invalid.");
}

const indexHtmlPath = path.join(repoRoot, "index.html");
const indexHtml = (await readFile(indexHtmlPath, "utf8")).replace(
  /(<a class="material-library-entry" href="\.\/materials\.html">资产贴图库 <span>)\d+(<\/span><\/a>)/,
  `$1${catalog.entry_count}$2`
);
await writeFile(indexHtmlPath, indexHtml, "utf8");
const bundleMatch = indexHtml.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
if (!bundleMatch) throw new Error("Could not resolve the published Atlas bundle from index.html.");

const manifest = JSON.parse(await readFile(path.join(repoRoot, "reference-sources", "shaderv-godot4.json"), "utf8"));
const shaderVEntries = buildShaderVEntries(manifest);
const bundlePath = path.join(repoRoot, "assets", bundleMatch[1]);
let bundle = await readFile(bundlePath, "utf8");
bundle = injectReferenceSupplement(bundle, shaderVEntries);

// 具体实现方式引擎：替换 bundle 内旧的通用 fe/pe（类型分流 + 阶段配比 + 渲染器警告）
// 幂等：已注入过（v2 引擎存在）则整段替换到稳定的 function O(){ 边界
const implSource = getInjectedImplementationSource();
const engineStart = bundle.indexOf("// fx implementation engine");
const nextAnchor = bundle.indexOf("function O(){");
if (engineStart >= 0 && nextAnchor > engineStart) {
  bundle = bundle.slice(0, engineStart) + implSource + "\n\n" + bundle.slice(nextAnchor);
} else {
  const fePeRe = /function fe\(e\)\{return\[[\s\S]*?参考链接：\$\{e\.url\}`\}/;
  if (!fePeRe.test(bundle)) throw new Error("Could not locate the legacy fe/pe implementation generator in the bundle.");
  bundle = bundle.replace(fePeRe, `${implSource}\n\n`);
}
if (!bundle.includes("function fxClassify(")) {
  throw new Error("Implementation engine injection did not replace the legacy generator.");
}

await writeFile(bundlePath, bundle, "utf8");

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
