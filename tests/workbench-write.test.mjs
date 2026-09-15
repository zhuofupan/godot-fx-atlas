import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { decodePngDataUrl, safeUnderData, writeWorkbenchPayload } from "../scripts/serve.mjs";

/**
 * 预检工作台的**回写端点**测试。
 *
 * 这层很重要：「人在环」的交接靠它 —— 设置与手绘直接落到磁盘，人不用下载文件。
 * 所以它的路径安全与内容校验必须有测试罩着，不能靠"看起来对"。
 *
 * 逻辑是纯函数（`writeWorkbenchPayload`），因此不需要开端口、也不受 loopback 限制。
 */
const repoRoot = path.resolve(import.meta.dirname, "..");
const TEST_BUNDLE = "__write_test__";

test.after(async () => {
  await rm(path.join(repoRoot, "project-data", TEST_BUNDLE), { recursive: true, force: true });
});

test("safeUnderData: 正常 id 落到 project-data/ 之内", () => {
  const a = safeUnderData("my-project", "workbench-state.json");
  assert.ok(a && a.startsWith(path.join(repoRoot, "project-data")));
  const b = safeUnderData("my-project", "drawings/aE12.png");
  assert.ok(b && b.endsWith(path.join("drawings", "aE12.png")));
});

test("safeUnderData: 拒绝穿越与空值", () => {
  assert.equal(safeUnderData("..", "x.json"), null);
  assert.equal(safeUnderData("../..", "x.json"), null);
  assert.equal(safeUnderData("", "x.json"), null);
  assert.equal(safeUnderData(null, "x.json"), null);
  // 危险字符被替换成下划线，不会逃出 dataRoot
  const sanitized = safeUnderData("a/../../b", "x.json");
  assert.ok(sanitized === null || sanitized.startsWith(path.join(repoRoot, "project-data")));
});

test("decodePngDataUrl: 只认 PNG dataURL", () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const buf = decodePngDataUrl(png);
  assert.ok(Buffer.isBuffer(buf) && buf.length > 40);
  assert.equal(buf.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(decodePngDataUrl("data:image/jpeg;base64,AAAA"), null);
  assert.equal(decodePngDataUrl("不是 dataURL"), null);
  assert.equal(decodePngDataUrl(undefined), null);
});

test("writeWorkbenchPayload: 状态 JSON 落盘", async () => {
  const payload = {
    schema: "fx-preflight-decisions/1",
    bundle_id: TEST_BUNDLE,
    source: "workbench-live",
    decisions: { S1: { confirmed: true, display_px: 64 } }
  };
  const { status, body } = await writeWorkbenchPayload(payload, false);
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  const onDisk = JSON.parse(await readFile(path.join(repoRoot, "project-data", TEST_BUNDLE, "workbench-state.json"), "utf8"));
  assert.equal(onDisk.decisions.S1.confirmed, true);
  assert.equal(onDisk.source, "workbench-live");
});

test("writeWorkbenchPayload: 手绘 PNG 落盘成文件（不是塞进 JSON）", async () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const { status, body } = await writeWorkbenchPayload(
    { bundle_id: TEST_BUNDLE, file: "drawings/S1.png", png }, true);
  assert.equal(status, 200);
  assert.equal(body.file, `project-data/${TEST_BUNDLE}/drawings/S1.png`);
  const info = await stat(path.join(repoRoot, "project-data", TEST_BUNDLE, "drawings", "S1.png"));
  assert.ok(info.size > 40);
});

test("writeWorkbenchPayload: 坏路径与坏内容都被拒", async () => {
  assert.equal((await writeWorkbenchPayload({ bundle_id: "..", file: "x.json" }, false)).status, 400);
  assert.equal((await writeWorkbenchPayload({ bundle_id: TEST_BUNDLE, png: "jpeg!!" }, true)).status, 400);
  // 被拒时不应产生文件
  await assert.rejects(stat(path.join(repoRoot, "project-data", "..", "x.json")));
});
