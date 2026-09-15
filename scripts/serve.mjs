import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

/**
 * 静态站点服务 + 预检工作台的**回写端点**。
 *
 * 为什么要回写端点：「人在环」不该靠**下载文件**来交接。
 * 工作台把当前设置与手绘图 POST 到这里，直接落到 `project-data/`（已 gitignore），
 * 使用方的 AI 直接读磁盘就能知道人设了什么、画了什么 —— 人不用下载、也不用复述。
 *
 * 只监听 127.0.0.1；只写 project-data/ 之内；其余路径一律拒绝。
 */
const repoRoot = path.resolve(import.meta.dirname, "..");
const dataRoot = path.join(repoRoot, "project-data");
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"]
]);

const BODY_LIMIT = 12 * 1024 * 1024; // 手绘图是 base64 PNG，给足但要有上限

/**
 * 把一段路径切成安全的分段：只保留 [A-Za-z0-9._-]，`..` / `.` / 空段全部丢掉。
 * ⚠️ 不能把 `/` 一起替换掉 —— 那样 `drawings/x.png` 会被拍平成 `drawings_x.png`，
 * 子目录就没了（这个 bug 是被 tests/workbench-write.test.mjs 抓出来的）。
 */
function cleanSegments(value) {
  return String(value || "")
    .split(/[\\/]+/)
    .map((seg) => seg.replace(/[^A-Za-z0-9._-]/g, "_"))
    .filter((seg) => seg && seg !== "." && seg !== "..");
}

/** 只允许 [A-Za-z0-9._-] 的分段，且必须落在 dataRoot 之内；bundle_id 必须正好是一段。 */
export function safeUnderData(bundleId, relFile) {
  const bundle = cleanSegments(bundleId);
  const rest = cleanSegments(relFile);
  if (bundle.length !== 1) return null;          // bundle_id 不许自带子目录或穿越
  if (!rest.length || rest.length > 4) return null;
  const segs = [...bundle, ...rest];
  if (segs.join("/").length > 160) return null;
  const full = path.resolve(dataRoot, ...segs);
  if (full !== dataRoot && !full.startsWith(`${dataRoot}${path.sep}`)) return null;
  return full;
}

/** 把 base64 dataURL 解成 Buffer；不是 PNG dataURL 就返回 null。 */
export function decodePngDataUrl(value) {
  const match = /^data:image\/png;base64,(.+)$/.exec(String(value || ""));
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("body_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

/**
 * 写入的核心逻辑（**纯函数、可被测**）—— HTTP 只是它的一层薄壳。
 * 抽出来的理由：本环境里 loopback 不通，端到端 HTTP 测不了；把逻辑与 IO 分开，
 * 就能直接用单元测试覆盖路径安全与内容校验，而不是"看起来对"。
 */
export async function writeWorkbenchPayload(payload, isDrawing) {
  const target = safeUnderData(payload && payload.bundle_id, isDrawing ? payload.file : "workbench-state.json");
  if (!target) {
    return { status: 400, body: { ok: false, error: "bad_path", hint: "bundle_id / file 只允许字母数字与 ._-" } };
  }
  try {
    await mkdir(path.dirname(target), { recursive: true });
    if (isDrawing) {
      const buffer = decodePngDataUrl(payload.png);
      if (!buffer) return { status: 400, body: { ok: false, error: "expected_png_dataurl" } };
      await writeFile(target, buffer);
      return { status: 200, body: {
        ok: true,
        file: path.relative(repoRoot, target).replace(/\\/g, "/"),
        bytes: buffer.length
      } };
    }
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return { status: 200, body: { ok: true, file: path.relative(repoRoot, target).replace(/\\/g, "/") } };
  } catch (error) {
    return { status: 500, body: { ok: false, error: String((error && error.message) || error) } };
  }
}

async function handleWrite(request, response, isDrawing) {
  let payload;
  try {
    payload = JSON.parse((await readBody(request)).toString("utf8"));
  } catch (error) {
    sendJson(response, 400, { ok: false, error: String((error && error.message) || error) });
    return;
  }
  const { status, body } = await writeWorkbenchPayload(payload, isDrawing);
  sendJson(response, status, body);
}


export function createWorkbenchServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      if (url.pathname === "/__wb/ping") {
        sendJson(response, 200, { ok: true, service: "fx-preflight-workbench" });
        return;
      }
      if (request.method === "POST" && (url.pathname === "/__wb/state" || url.pathname === "/__wb/drawing")) {
        await handleWrite(request, response, url.pathname === "/__wb/drawing");
        return;
      }

      const requestPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.resolve(repoRoot, `.${requestPath}`);
      if (filePath !== repoRoot && !filePath.startsWith(`${repoRoot}${path.sep}`)) throw new Error("unsafe_path");
      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) throw new Error("not_file");
      response.writeHead(200, { "Content-Type": contentTypes.get(path.extname(filePath)) || "application/octet-stream" });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

// 只有直接运行才监听 —— 被测试 import 时不要开端口。
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  createWorkbenchServer().listen(port, "127.0.0.1", () => {
    console.log(`Godot FX Atlas:   http://127.0.0.1:${port}`);
    console.log(`特效预检工作台:   http://127.0.0.1:${port}/workbench.html`);
    console.log("回写端点已启用：设置与手绘会直接落到 project-data/（不需要下载文件）");
  });
}
