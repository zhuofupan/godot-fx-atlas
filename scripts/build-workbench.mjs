/**
 * 预检工作台 · 数据包编译
 * ---------------------------------------------------------------------------
 * 读 `project-data/<bundle-id>/bundle.json` → 生成 `assets/workbench-data.js`（ESM）。
 *
 * 为什么要这一步：工作台是**项目无关**的，它只认数据包；数据包由使用方工程的导出器生成，
 * 并且**不进 git**（见 .gitignore）。所以公开仓库里永远只有工具，没有别人的工程数据。
 *
 * 用法：
 *   npm run build:workbench          # 只编译数据包
 *   npm run build                    # 站点构建（会顺带编译数据包）
 *
 * 校验失败会直接抛错并指出是哪个包、哪一项 —— 不要把坏数据静默吞掉。
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(repoRoot, "project-data");
const outPath = path.join(repoRoot, "assets", "workbench-data.js");

export const BUNDLE_SCHEMA = "fx-preflight-bundle/1";
export const DECISIONS_SCHEMA = "fx-preflight-decisions/1";

const CANDIDATE_SOURCES = new Set(["generated", "current", "reference", "external", "thirdparty"]);

function fail(msg) {
  throw new Error(`[workbench] ${msg}`);
}

function checkGeometry(bundleId, geo) {
  if (!geo || typeof geo !== "object") fail(`${bundleId}: 缺 geometry`);
  const card = geo.card;
  if (!card || !(card.width > 0) || !(card.height > 0)) fail(`${bundleId}: geometry.card 需要正的 width/height`);
  if (geo.anchors && typeof geo.anchors !== "object") fail(`${bundleId}: geometry.anchors 必须是对象`);
  for (const [name, rect] of Object.entries(geo.anchors || {})) {
    if (!Array.isArray(rect) || rect.length !== 4 || rect.some((v) => typeof v !== "number")) {
      fail(`${bundleId}: geometry.anchors.${name} 必须是 [x,y,w,h] 四个数字（归一化到卡面）`);
    }
  }
  if (geo.cell && (!(geo.cell.width > 0) || !(geo.cell.depth > 0))) {
    fail(`${bundleId}: geometry.cell 需要正的 width/depth`);
  }
  return geo;
}

function checkItem(bundleId, item, idx) {
  const where = `${bundleId}: items[${idx}]`;
  if (!item || !item.id) fail(`${where} 缺 id`);
  const cands = item.candidates || [];
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (!c.image) fail(`${where}.candidates[${i}] 缺 image（data URI 或相对路径）`);
    if (c.source && !CANDIDATE_SOURCES.has(c.source)) {
      fail(`${where}.candidates[${i}].source=${c.source} 不在允许值 ${[...CANDIDATE_SOURCES].join("/")} 内`);
    }
    const cols = c.frame_cols ?? 1;
    const rows = c.frame_rows ?? 1;
    if (!(cols >= 1) || !(rows >= 1)) fail(`${where}.candidates[${i}] frame_cols/frame_rows 必须是 ≥1 的整数`);
    if ((c.best_frame ?? 0) >= cols * rows) {
      fail(`${where}.candidates[${i}].best_frame=${c.best_frame} 超出 ${cols}×${rows} 的帧数`);
    }
  }
  return item;
}

const GEO_ANCHORS = new Map();

async function listBundles() {
  try {
    const info = await stat(dataDir);
    if (!info.isDirectory()) return [];
  } catch {
    return [];
  }
  const out = [];
  for (const name of (await readdir(dataDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const file = path.join(dataDir, name, "bundle.json");
    try {
      const raw = JSON.parse(await readFile(file, "utf8"));
      if (raw.schema !== BUNDLE_SCHEMA) fail(`${name}: schema 必须是 ${BUNDLE_SCHEMA}，实际 ${raw.schema}`);
      if (!raw.bundle_id) fail(`${name}: 缺 bundle_id`);
      if (!Array.isArray(raw.items)) fail(`${name}: 缺 items 数组`);
      const geometry = checkGeometry(raw.bundle_id, raw.geometry);
      GEO_ANCHORS.set(raw.bundle_id, Object.keys(geometry.anchors || {}));
      const items = raw.items.map((it, i) => checkItem(raw.bundle_id, it, i));
      for (const it of items) {
        if (it.anchor && geometry.anchors && !geometry.anchors[it.anchor]) {
          fail(`${raw.bundle_id}: 条目 ${it.id} 的 anchor=${it.anchor} 不在 geometry.anchors 里`);
        }
      }
      out.push({ ...raw, geometry, items });
      console.log(`[workbench] ${raw.bundle_id}: ${items.length} 条 · ${items.reduce((n, it) => n + (it.candidates || []).length, 0)} 个候选`);
    } catch (err) {
      if (err.code === "ENOENT") continue; // 目录里只有别的文件，正常
      throw err;
    }
  }
  return out.sort((a, b) => String(a.bundle_id).localeCompare(String(b.bundle_id)));
}

export async function buildWorkbenchData() {
  const bundles = await listBundles();
  await mkdir(path.dirname(outPath), { recursive: true });
  const body = `// 由 scripts/build-workbench.mjs 生成 —— 不要手改，不要提交（.gitignore 已排除）。\n`
    + `export const DATA_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};\n`
    + `export const BUNDLES = ${JSON.stringify(bundles)};\n`;
  await writeFile(outPath, body, "utf8");
  const kb = Math.round(Buffer.byteLength(body) / 1024);
  console.log(
    bundles.length
      ? `[workbench] 已生成 assets/workbench-data.js（${bundles.length} 个包，${kb} KB）`
      : `[workbench] 没有 project-data/ —— 已生成空数据集（${kb} KB）。工作台会显示导入指引。`
  );
  return bundles.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  await buildWorkbenchData();
}
