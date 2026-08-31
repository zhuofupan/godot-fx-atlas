import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
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

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
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
}).listen(port, "127.0.0.1", () => {
  console.log(`Godot FX Atlas: http://127.0.0.1:${port}`);
});
