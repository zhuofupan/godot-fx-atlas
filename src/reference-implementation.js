/**
 * reference-implementation.js — 每条案例的「具体实现方式」生成引擎
 *
 * 设计原则（专业把控点）：
 *   1. 按案例类型分流到实现原型（序列帧 / Shader / UI 工具 / VisualShader 节点），
 *      不再对所有案例套同一条 Shader 路线。
 *   2. 每条步骤给出具体节点、材质、参数与安全范围（可执行，不是口号）。
 *   3. 内置阶段配比（ANTICIPATE 25–40% / IMPACT 对齐判定帧 / cancel-to-recover /
 *      对象池）与性能·渲染器警告（screen_texture 成本、Compatibility 粒子 shader 挂起、
 *      ADD 层数预算、光敏合规）。
 *   4. 纯函数、无 DOM 依赖；build.mjs 通过 Function.toString 注入预构建 bundle，
 *      并在构建期跑 mock 用例断言质量。
 */

const FX_IMPL_VERSION = "v2 (2026-09-13)";

// ---------- 原型分类 ----------

function fxClassify(e) {
  const hay = `${e.type || ""} ${e.name || ""} ${(e.tags || []).join(" ")} ${(e.visualTags || []).join(" ")} ${(e.category || "")}`;
  const isShaderV = String(e.id || "").startsWith("shaderv4-") || /VisualShader/.test(hay);
  if (isShaderV) return "visualshader";
  // 类型字段是第一证据：明确序列帧/素材包 → sprite_seq（即使名字带扭曲/模糊等 shader 词）
  const typeIsTool = /工具|tool|code|demo|演示|stylesheet|script|module/i.test(e.type || "");
  const typeIsSeq = !typeIsTool && /序列帧|素材|sheet|sprites|像素|动画/i.test(e.type || "");
  if (!typeIsTool && /Shader|着色/.test(e.type || "")) return "shader";
  if (typeIsSeq) return "sprite_seq";
  if (/序列帧|sprite sheet|sprites|GIF|帧/i.test(hay)) return "sprite_seq";
  // 名字/标签级 shader 证据（类型未明确时）
  if (/Shader|着色|扭曲|模糊|像素化|描边|色差|扫描线|调色|溶解|噪声/.test(hay)) return "shader";
  if (/卡牌动画工具|卡堆|抽牌|洗牌|弹字|伤害|暴击|文字|图标|先攻|行动顺序|SVG|翻面/.test(hay)) return "ui";
  return "sprite_seq"; // 素材包默认走序列帧/贴图路线（本库主体即 2D VFX 素材）
}

function fxIsLoop(e) {
  return /循环|持续|光环|状态附着|aura|loop|环境/i.test(`${(e.visualTags || []).join(" ")} ${e.use || ""} ${e.name || ""}`);
}

function fxIsPixel(e) {
  return /像素|pixel|8bit|16bit/i.test(`${e.name || ""} ${(e.tags || []).join(" ")} ${e.type || ""}`);
}

function fxIsUI(e) {
  return (e.scene || "").includes("卡牌") || (e.category || "").includes("UI") || /图标|弹字|卡面/.test(`${(e.cardTags || []).join(" ")} ${e.name || ""}`);
}

function fxHasParticleTexture(e) {
  return /粒子|烟雾|火花|火焰|烟|ember|smoke|spark|fire|burst/i.test(`${e.name || ""} ${(e.tags || []).join(" ")} ${e.use || ""}`);
}

function fxUsesScreenTexture(e) {
  return /扭曲|模糊|色差|折射|热浪|distort|blur|refract|heat/i.test(`${e.name || ""} ${e.type || ""} ${(e.tags || []).join(" ")}`);
}

function fxTargetDuration(e) {
  const hay = `${e.use || ""} ${e.name || ""} ${(e.visualTags || []).join(" ")}`;
  if (/预警|telegraph|提示范围/i.test(hay)) return "0.5–1.2s（telegraph 档，预备段反转为 50–60%）";
  if (/升级|庆祝|进化|level/i.test(hay)) return "0.6–1.0s（庆祝档）";
  if (fxIsLoop(e)) return "0.8–2s/循环（无缝；环境层可长循环）";
  if (fxIsUI(e)) return "0.3–0.7s（UI 反馈档）";
  return "0.20–0.45s（打击档）";
}

// ---------- 分原型步骤 ----------

function fxStepsFor(e) {
  const kind = fxClassify(e);
  const dur = fxTargetDuration(e);
  const steps = [];

  if (kind === "sprite_seq") {
    const static_ = /单帧|静态|icon|图标/i.test(`${e.name || ""} ${(e.tags || []).join(" ")}`) && !/动画|帧|sheet|GIF/i.test(`${e.type || ""} ${(e.tags || []).join(" ")}`);
    if (static_) {
      steps.push("节点：Sprite2D 挂透明底贴图；主缩放以剪影读得清为准（一般 ≤ 画布 1/4），filter 按风格选 Linear" + (fxIsPixel(e) ? "（像素图用 Nearest 保锐边）" : ""));
      steps.push("单帧不播动画：用 Tween 做 0.5–1.0s 的呼吸/旋转/淡出包络；出现用 TRANS_BACK 弹入，消失用 QUAD 淡出");
    } else {
      steps.push("切帧：AnimatedSprite2D + SpriteFrames，用 AtlasTexture 按 sheet 网格切帧（region = 宽/列 × 高/行，逐帧核对不越界）；透明底 PNG 直接导入");
      steps.push(`节奏定档：目标时长 ${dur}；fps = 帧数 ÷ 时长，先 24fps 起调，形变剧烈区间补中间帧而不是拉长停留`);
    }
    steps.push("双层发光：主体（shape 层）+ 同图 ADD 发光层（Sprite2D 材质 CanvasItemMaterial.blend_add，scale 1.06–1.1，alpha ≤ 0.5）——发光跟形走，不另起色相；ADD 层数移动端 ≤ 3");
    if (fxHasParticleTexture(e)) {
      steps.push("余韵层：GPUParticles2D + ParticleProcessMaterial 做少量方向性碎屑/烟尘（one_shot、explosiveness 0.6–1），同屏 ≤ 300（移动端）；贴图入共享图集");
    }
    if (fxIsLoop(e)) {
      steps.push("循环附着：状态/光环类用 looping SpriteFrames 无缝循环，附着点对齐目标锚点（Bone2D 或 Marker2D 跟随），结束由状态机停发而非淡出丢帧");
    }
  } else if (kind === "shader") {
    steps.push("材质接入：新建 ShaderMaterial 挂到独立 Sprite2D/ColorRect 验证通过后再上主体；shader_type canvas_item，保持原图 UV 采样语义与透明度");
    steps.push("uniform 契约：progress / intensity / color / duration 全部用 hint_range、source_color 暴露，不留魔法数字；颜色从主体/图标派生，不另起色相");
    steps.push(`演出曲线：Tween 驱动 0→1→0，总时长 ${dur}；总包络管整体明暗，材质变化交给遮罩流动/溶解边界，不要只有整体 alpha`);
    steps.push("性能与兼容：片元采样 ≤ 6 次；加法渐变叠 hash 抖动去色带；交付时 shader 头部注释渲染器矩阵" + (fxUsesScreenTexture(e) ? "；本例涉及 screen_texture——强制后台拷贝，移动端控制实例数，filter 用 linear 勿配 mipmap" : ""));
    if (fxIsLoop(e)) {
      steps.push("循环无缝：用 fract(TIME×speed) 驱动相位，首尾帧相位连续；接缝看最后一帧→第一帧的亮度与轮廓");
    }
  } else if (kind === "ui") {
    steps.push("节点：Control/TextureRect/Label + CanvasLayer 隔离相机；锚点按分辨率自适应，界面缩放下不漂移");
    steps.push("弹字/飘字：上浮 24–40px + 先挤出 scale 1.15 再回落，0.4–0.7s；暴击加 5–8° 随机倾角与 1.2× 字号");
    steps.push("卡面交互：翻面用 scale.x 过零翻转（配 back 当帧换贴图）或 Shader UV 翻转；高亮用呼吸描边（外描边 shader 或 9-slice 边框 alpha 脉冲）");
    steps.push("工程化：弹字/提示对象池化（0 运行时 instantiate/free）；出现 TRANS_BACK、消失 QUAD，全部 Tween 登记可 kill");
    steps.push("质检：不同分辨率与界面缩放下锚点不漂；与卡面材质层不互相遮挡");
  } else { // visualshader
    steps.push("接入：把该 VisualShader 节点加入项目（MIT 须保留许可证声明），在 VisualShader 图中按其 UV / RGBA 端口接入既有采样链");
    steps.push("参数暴露：节点的可调端口映射为 shader uniform 并加 hint；在独立 Sprite2D 上先验证再上主体");
    steps.push("组合：与 Tween（包络）、GPUParticles2D（余韵）分层配合——Shader 管材质变化，不管位移编排");
    steps.push("兼容验证：Forward+ 通过后在 Compatibility 渲染器复测一次（本站实测 C 下自定义粒子 shader 编译异常，VisualShader 节点本身可用但需复核）");
  }

  // 共同收尾：编排 + 打断 + 质检（专业把控的核心三步）
  steps.push("阶段编排：ANTICIPATE 25–40%（预备收势）→ IMPACT 对齐伤害判定帧（±2 帧）→ RECOVER 25–38% 淡出；总时长参考 " + dur + "；全部 Tween 登记在册，任意阶段可 cancel-to-recover（直接跳淡出，无残留）");
  steps.push("工程化：one_shot + finished 信号归还对象池（0 运行时 instantiate/free，池化复位后与首次画面一致）");
  steps.push("质检门禁：0.25× 慢放查层次出入；关 Glow 后剪影仍可读；循环类核对首尾接缝；全屏亮闪 ≤ 3 次/秒且单次 < 0.3s（光敏合规）");
  return steps;
}

function fxPerfLine(e) {
  const kind = fxClassify(e);
  if (fxUsesScreenTexture(e)) return "⚠ 涉及 screen_texture（后台拷贝）：Forward+ / Mobile 可用，移动端控制实例数；Compatibility 复测";
  if (kind === "visualshader") return "VisualShader 节点：MIT 复用保留声明；Compatibility 下复核一次";
  if (kind === "shader") return "片元采样 ≤ 6；加法渐变加抖动去色带；移动端 ADD 层 ≤ 3";
  if (kind === "ui") return "UI 轻量：池化 + CanvasLayer 隔离；全渲染器可用";
  return "序列帧路线：1 次纹理采样级开销，移动端友好；同屏按最坏叠加计 ADD 层数";
}

function fxRoute(e) {
  const kind = fxClassify(e);
  if (kind === "shader") return "CanvasItem Shader + Tween 包络";
  if (kind === "ui") return "Control + Tween（CanvasLayer 隔离）";
  if (kind === "visualshader") return "VisualShader 节点 + ShaderMaterial";
  return "AnimatedSprite2D 序列帧 + ADD 发光层" + (fxHasParticleTexture(e) ? " + GPUParticles2D 余韵" : "");
}

function fxWarn(e) {
  if (fxUsesScreenTexture(e)) return "screen_texture 有后台拷贝成本：移动端控实例数，Compatibility 复测";
  if (fxIsLoop(e)) return "循环类：核对首尾帧接缝与亮度连续";
  if (fxIsPixel(e)) return "像素风：filter 设 Nearest，避免缩放糊边";
  return "";
}

// ---------- 对外：fe / pe（注入 bundle 的入口，签名与旧版一致） ----------

function fe(e) {
  const warn = fxWarn(e);
  const steps = fxStepsFor(e);
  if (warn) steps.push("⚠ " + warn);
  return steps;
}

function pe(e) {
  const kind = fxClassify(e);
  const route = fxRoute(e);
  const dur = fxTargetDuration(e);
  const terms = [...(e.cardTags || []), ...(e.visualTags || []), ...(e.designTerms || [])].slice(0, 4);
  const subject = terms.length ? `「${terms.join(" / ")}」表现` : `通用${e.scene || "2D"}表现`;
  return [
    `请参考 ${e.name}（${String(e.id || "").toUpperCase()}，${e.category}）实现一个可复用的 Godot 4.x 2D ${subject}特效。`,
    ``,
    `应用场景：${e.use}`,
    ``,
    `推荐技术路线：${route}。`,
    `阶段配比（合计 1.0）：ANTICIPATE 25–40% → CAST 8–15% → IMPACT ≤10%（对齐伤害判定帧 ±2 帧）→ RECOVER 25–38% → CLEANUP 10–20%（视觉回收与对象池归位解耦）。目标时长 ${dur}。`,
    ``,
    `实现要求：`,
    `1) 按上述路线选择节点与材质，拆分准备/释放/命中/余韵/回收阶段；`,
    `2) 暴露 progress、intensity、color、duration 等带 hint 的 uniform 或 export 参数，不留魔法数字；`,
    `3) 任意阶段可取消（Tween 登记可 kill，cancel-to-recover 直接跳淡出，无残留）；`,
    `4) 对象池复用：0 运行时 instantiate/free，池化复位后与首次画面一致；`,
    `5) ${fxPerfLine(e)}。`,
    ``,
    `验收清单：0.25× 慢放查层次；关 Glow 后剪影可读；循环类查首尾接缝；全屏亮闪 ≤3 次/秒且单次 <0.3s（光敏合规）；最坏叠加情形帧率达标。`,
    ``,
    `交付内容：可直接导入的 .tscn、.gdshader、.gd、节点结构、可调参数说明、触发/取消/回收流程与移动端性能注意事项。`,
    ``,
    `版权边界：若参考资源为付费或受版权保护内容，只复现视觉逻辑、动画节奏和实现方式，不复制或重新分发原始美术资源。`,
    ``,
    `参考链接：${e.url}`,
  ].join("\n");
}

// ---------- 构建期自检（mock 用例，保证分类覆盖与步骤质量下限） ----------

function fxSelfTest() {
  const cases = [
    { id: "fx-0001", name: "2D Pixel Art Status Effect Sprites", type: "2D 像素状态动画 / Sprite Sheet", scene: "技能 + 卡牌", category: "卡牌高亮与 UI", use: "状态动画参考", tags: ["Sprite Sheet", "32x32"], visualTags: ["状态附着", "循环"], cardTags: ["图标动效"], designTerms: [] },
    { id: "fx-0100", name: "Heat Distortion Shader", type: "CanvasItem Shader", scene: "技能 + 卡牌", category: "技能特效", use: "热浪扭曲", tags: ["shader", "distort"], visualTags: ["扭曲"], cardTags: [], designTerms: [] },
    { id: "fx-0500", name: "Card Flip Tool", type: "Godot 2D 卡牌动画工具", scene: "卡牌", category: "卡牌高亮与 UI", use: "抽牌翻面", tags: ["tool"], visualTags: [], cardTags: ["卡面交互"], designTerms: [] },
    { id: "shaderv4-x", name: "ShaderV 4 · Simplex3D", type: "MIT 2D VisualShader 节点", scene: "技能 + 卡牌", category: "通用合成", use: "程序噪声", tags: ["VisualShader"], visualTags: [], cardTags: [], designTerms: [] },
  ];
  const kinds = new Set();
  for (const c of cases) {
    const steps = fxStepsFor(c);
    kinds.add(fxClassify(c));
    if (steps.length < 5) throw new Error("步骤过少: " + c.id);
    if (fe(c).length < 5) throw new Error("fe 输出异常: " + c.id);
    if (!pe(c).includes("阶段配比")) throw new Error("pe 缺阶段配比: " + c.id);
  }
  if (!kinds.has("sprite_seq") || !kinds.has("shader") || !kinds.has("ui") || !kinds.has("visualshader")) {
    throw new Error("原型覆盖不全: " + [...kinds].join(","));
  }
  return true;
}

// ---------- 注入源（Function.toString 组装，保持与旧 fe/pe 签名一致） ----------

export function getInjectedImplementationSource() {
  return [
    `// fx implementation engine v2 (2026-09-13) — by FX Atlas review (类型分流 + 阶段配比 + 渲染器警告)`,
    fxClassify.toString(),
    fxIsLoop.toString(),
    fxIsPixel.toString(),
    fxIsUI.toString(),
    fxHasParticleTexture.toString(),
    fxUsesScreenTexture.toString(),
    fxTargetDuration.toString(),
    fxStepsFor.toString(),
    fxPerfLine.toString(),
    fxRoute.toString(),
    fxWarn.toString(),
    fe.toString(),
    pe.toString(),
  ].join("\n\n");
}

export const fxSelfTestResult = fxSelfTest();
