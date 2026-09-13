import fs from "node:fs";
import { getInjectedImplementationSource } from "../src/reference-implementation.js";

const bundle = fs.readFileSync("D:/AI/WorkBuddy_Proj/godot-fx-atlas/assets/index-D_8Jpc5N.js", "utf8");
const api = new Function(`${getInjectedImplementationSource()}; return { fe, fxClassify };`)();

// 从 bundle 抽真实案例对象（按 id 定位，回溯对象起点）
function extractCase(id) {
  const idAt = bundle.indexOf("id:`" + id + "`");
  if (idAt < 0) return null;
  const start = bundle.lastIndexOf("{name:`", idAt);
  const slice = bundle.slice(start, idAt + id.length + 2);
  const grab = (field) => {
    const m = slice.match(new RegExp(field + ":`([^`]*)`"));
    return m ? m[1] : "";
  };
  const grabArr = (field) => {
    const m = slice.match(new RegExp(field + ":\\[([^\\]]*)\\]"));
    return m ? [...m[1].matchAll(/`([^`]*)`/g)].map((x) => x[1]) : [];
  };
  return {
    id, name: grab("name"), type: grab("type"), category: grab("category"),
    scene: grab("scene"), use: grab("use"), tags: grabArr("tags"),
    visualTags: grabArr("visualTags"), cardTags: grabArr("cardTags"), designTerms: grabArr("designTerms"),
  };
}

const samples = ["fx-0001", "fx-0002"];
// 再找两个 Shader 类与 UI/工具类
const shaderId = (bundle.match(/name:`([^`]*[Dd]istortion[^`]*)`,source/) || [])[1];
for (const m of bundle.matchAll(/name:`([^`]{5,80})`/g)) {
  const t = m[1];
  if (/Shader|shader/.test(t) === false) continue;
}
for (const m of bundle.matchAll(/\{name:`([^`]+)`,source:`([^`]+)`,type:`([^`]+)`/g)) {
  if (/CanvasItem Shader/.test(m[3]) && samples.length < 3) {
    const idm = bundle.slice(m.index, m.index + 4000).match(/id:`(fx-\d+)`/);
    if (idm) samples.push(idm[1]);
  }
  if (/卡牌动画工具|弹字|翻面/.test(m[1]) && samples.length < 4) {
    const idm = bundle.slice(m.index, m.index + 4000).match(/id:`(fx-\d+)`/);
    if (idm) samples.push(idm[1]);
  }
}

for (const id of samples) {
  const c = extractCase(id);
  if (!c) { console.log("未找到", id); continue; }
  const steps = api.fe(c);
  console.log("\n========================================");
  console.log(`[${api.fxClassify(c)}] ${c.id} ${c.name}  (type: ${c.type})`);
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
}
