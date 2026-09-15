import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/**
 * 站点外壳一致性测试。
 *
 * 起因是一个真实反馈：「上面的按钮（顶栏）在别的页面也要有，能互通」——
 * 而当时 `.site-header / .brand / .top-nav` 在三个文件里各抄了一遍，
 * 结果是 index.html 压根没有、workflow.html 还少一个「预检工作台」。
 * 抄几份必然漂移，所以顶栏收进 `assets/site-shell.css`，并由本测试钉住：
 *   ① 四个页面都加载了外壳样式，且**在最后**（否则会被页面自己的 CSS 压回去）；
 *   ② 四个页面的顶栏链接集合一致、数量一致（4 个）；
 *   ③ 每个页面恰好把自己标成 aria-current。
 */
const repoRoot = path.resolve(import.meta.dirname, "..");
const PAGES = ["index.html", "materials.html", "workflow.html", "workbench.html"];
const EXPECTED = ["参考案例库", "资产贴图库", "制作流程", "预检工作台"];

async function load(page) {
  return readFile(path.join(repoRoot, page), "utf8");
}

test("四个页面都加载外壳样式，且在最后", async () => {
  for (const page of PAGES) {
    const html = await load(page);
    const links = [...html.matchAll(/href="\.\/assets\/([^"]+\.css)"/g)].map((m) => m[1]);
    assert.ok(links.length > 0, `${page} 没有加载任何样式`);
    assert.equal(links.at(-1), "site-shell.css", `${page} 的外壳样式不在最后：${links.join(" → ")}`);
  }
});

test("四个页面的顶栏链接完全一致", async () => {
  const seen = new Map();
  for (const page of PAGES) {
    const html = await load(page);
    const nav = html.match(/<nav class="top-nav"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${page} 没有顶栏`);
    const labels = [...nav[0].matchAll(/>([^<>]+)<\/a>/g)].map((m) => m[1].trim());
    seen.set(page, labels);
  }
  for (const [page, labels] of seen) {
    assert.deepEqual(labels, EXPECTED, `${page} 的顶栏与预期不一致：${labels.join(" / ")}`);
  }
});

test("每个页面恰好一个 aria-current", async () => {
  for (const page of PAGES) {
    const html = await load(page);
    const nav = html.match(/<nav class="top-nav"[\s\S]*?<\/nav>/)[0];
    const current = (nav.match(/aria-current="page"/g) || []).length;
    assert.equal(current, 1, `${page} 的顶栏有 ${current} 个 aria-current（应为 1）`);
  }
});

test("外壳里的字号旋钮只有一个", async () => {
  const css = await readFile(path.join(repoRoot, "assets", "site-shell.css"), "utf8");
  // 只有一个地方真正声明 zoom，值走变量 —— 改字号只改一处
  // （注意 `--ui-zoom:` 里含有 `zoom:` 子串，正则要排除前面是 `-`/字母的情况）
  const zooms = [...css.matchAll(/(?<![\w-])zoom:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.deepEqual(zooms, ["var(--ui-zoom)"], `zoom 应只在 html 上声明一次且走变量，实际：${zooms.join(", ")}`);
  const knobs = [...css.matchAll(/--ui-zoom:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(knobs.length >= 1, "找不到 --ui-zoom 的值");
  for (const v of knobs) assert.ok(v > 1, `字号旋钮应当大于 1（要放大），实际 ${v}`);
});
