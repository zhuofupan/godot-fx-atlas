import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

/**
 * 静态站点服务（本地开发用）。
 *
 * 历史：这里曾经同时是预检工作台的**回写端点**（把设置与手绘 POST 到 `project-data/`）。
 * 预检工作台已经迁进 Godot 工程（`fx_kit/preflight`），写盘由引擎直接做 ——
 * 那条 HTTP 路径连同它的路径穿越面一起删掉了，本文件只剩静态服务。
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

export function createDevServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      const requestPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const filePath = path.resolve(repoRoot, `.${requestPath}`);
      if (filePath !== repoRoot && !filePath.startsWith(`${repoRoot}${path.sep}`)) throw new Error("unsafe_path");
      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) throw new Error("not_file");
      const ext = path.extname(filePath);
      const headers = { "Content-Type": contentTypes.get(ext) || "application/octet-stream" };
      // 这是**开发服务器**：HTML/CSS/JS 一律不缓存。
      // 否则改完样式刷新还是旧的，人会以为"没生效"（实测为这个浪费过一轮排查）。
      // 图片/JSON 数据可以缓存，省重传。
      if ([".html", ".css", ".js"].includes(ext)) headers["Cache-Control"] = "no-store, must-revalidate";
      response.writeHead(200, headers);
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

// 只有直接运行才监听 —— 被测试 import 时不要开端口。
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  createDevServer().listen(port, "127.0.0.1", () => {
    console.log(`Godot FX Atlas:   http://127.0.0.1:${port}`);
  });
}
