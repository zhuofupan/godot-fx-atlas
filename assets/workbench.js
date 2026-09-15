/**
 * 特效预检工作台（FX Preflight Workbench）
 * ---------------------------------------------------------------------------
 * 项目无关。它不认识任何具体工程 —— 载体几何（卡面 / 棋格 / 锚点 / 归一系数）、
 * 条目、候选素材、目标色，全部由「数据包」注入：
 *
 *     project-data/<bundle-id>/bundle.json   （由使用方工程的导出器生成，已 gitignore）
 *     scripts/build-workbench.mjs            （读数据包 → 生成 assets/workbench-data.js）
 *
 * 为什么要有这个台子：原来的反馈闭环是「写实现 → 进引擎 → 截图 → 人看 → 返工」，
 * 把**最贵的媒介放在了最前面**。这里把「方案 / 选材 / 摆位」三件事挪到浏览器里先定，
 * 人认可之后才进引擎 —— 反馈闭环从最贵的媒介挪到最便宜的媒介。
 *
 * 诚实边界：本台只用于判断**构图 / 尺寸 / 位置 / 素材选择**。浏览器与引擎的混合、
 * 发光、粒子行为不一致，这里的结论**不能**替代引擎内验收。
 */

const G = { card: { width: 100, height: 60, radius: 10 }, cell: null, anchors: {}, display_k: {}, budget: null };

let BUNDLES = [];
try {
  ({ BUNDLES } = await import("./workbench-data.js"));
} catch {
  BUNDLES = [];
}

/* ───────────────────────────── 状态 ───────────────────────────── */

const state = {
  bundle: null,
  item: null,
  decisions: new Map() // itemId -> {cand, display_px, offset, alpha, frame, confirmed}
};

/* ───────────────────────────── 工具 ───────────────────────────── */

const $ = (sel) => document.querySelector(sel);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function hueOf(rgb) {
  const [r, g, b] = rgb.slice(0, 3);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return { h: 0, s: 0 };
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: mx ? d / mx : 0 };
}

function cssRgb(rgb) {
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c(rgb[0])},${c(rgb[1])},${c(rgb[2])})`;
}

function anchorRect(name) {
  const r = G.anchors[name];
  if (!r) return null;
  return { x: r[0] * G.card.width, y: r[1] * G.card.height, w: r[2] * G.card.width, h: r[3] * G.card.height };
}

function budgetPx(bundle, anchor) {
  const base = G.budget;
  if (!base) return null;
  // 预算按锚点分档：贴地/受击类按格子短边，覆盖型（罩/膜/框）按卡宽 —— 后者本来就该盖住卡，
  // 拿格深当预算会误报（实测 aE6 玉框被误判「超预算 1.5×」）。
  const b = (base.by_anchor && anchor && base.by_anchor[anchor]) || base;
  if (b.mode === "none") return null;
  if (b.mode === "cell_min_axis" && G.cell) return Math.min(G.cell.width, G.cell.depth) * (b.factor ?? 0.9);
  if (b.mode === "cell_width" && G.cell) return G.cell.width * (b.factor ?? 1);
  if (b.mode === "card_width") return G.card.width * (b.factor ?? 1);
  if (b.mode === "fixed") return b.px ?? null;
  return null;
}

function kOf(nodeId) {
  return Number(G.display_k[nodeId] ?? 0) || null;
}

/** 目标显示直径优先取实现里的实测值，否则按极性/锚点给个合理默认。 */
function defaultDisplayPx(item) {
  if (item.impl && item.impl.display_px) return item.impl.display_px;
  const a = item.anchor || "";
  if (a.includes("head")) return +(0.45 * G.card.width).toFixed(1);
  if (a.includes("body") || a.includes("outline")) return +(0.92 * G.card.width).toFixed(1);
  if (a.includes("hit") || a.includes("emit")) return +(0.55 * G.card.width).toFixed(1);
  if (G.cell) return +(G.cell.width * 0.7).toFixed(1);
  return +(0.5 * G.card.width).toFixed(1);
}

function decOf(itemId) {
  if (!state.decisions.has(itemId)) state.decisions.set(itemId, {});
  return state.decisions.get(itemId);
}

const POLARITY_LABEL = { buff: "增益", debuff: "减益", trigger: "瞬发", aura: "阵法" };

/* ───────────────────────────── 启动 ───────────────────────────── */

function boot() {
  if (!BUNDLES.length) {
    $("#wb-empty").hidden = false;
    $("#wb-body").hidden = true;
    return;
  }
  const sel = $("#wb-bundle");
  sel.replaceChildren(
    ...BUNDLES.map((b, i) => {
      const o = el("option", null, `${b.label || b.bundle_id}（${(b.items || []).length} 条）`);
      o.value = String(i);
      return o;
    })
  );
  sel.hidden = BUNDLES.length < 2;
  sel.onchange = () => selectBundle(Number(sel.value));
  selectBundle(0);
}

function selectBundle(idx) {
  state.bundle = BUNDLES[idx];
  Object.assign(G, {
    card: state.bundle.geometry?.card || G.card,
    cell: state.bundle.geometry?.cell || null,
    anchors: state.bundle.geometry?.anchors || {},
    display_k: state.bundle.geometry?.display_k || {},
    budget: state.bundle.geometry?.budget || null
  });
  state.item = (state.bundle.items || [])[0]?.id ?? null;
  lib.index = state.bundle.external_library || [];
  lib.filter = "";
  buildNav();
  render();
}

/* ───────────────────────────── 左侧导航 ───────────────────────────── */

function buildNav() {
  const nav = $("#wb-nav");
  nav.replaceChildren();
  const groups = new Map();
  for (const it of state.bundle.items || []) {
    const g = it.group || "条目";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }
  for (const [g, items] of groups) {
    nav.append(el("div", "grp", g));
    for (const it of items) {
      const b = el("button");
      const tint = it.tint || [1, 1, 1];
      const sw = el("span", "swatch");
      sw.style.background = cssRgb(tint);
      b.append(sw, document.createTextNode(`${it.id}${it.name ? " " + it.name : ""}`));
      b.dataset.item = it.id;
      b.onclick = () => { state.item = it.id; render(); };
      nav.append(b);
    }
  }
}

function markNav() {
  for (const b of document.querySelectorAll("#wb-nav button")) {
    b.setAttribute("aria-current", String(b.dataset.item === state.item));
  }
}

/* ───────────────────────────── 取当前条目 ───────────────────────────── */

function curItem() {
  return (state.bundle.items || []).find((it) => it.id === state.item) || null;
}

function coverImage(item, cand) {
  return cand.image_tinted || cand.image;
}

/* ───────────────────────────── ① 方案 ───────────────────────────── */

function renderPlan() {
  const it = curItem();
  if (!it) return;
  const c = it.contract || {};
  const impl = it.impl || {};
  const miss = ["motif_id", "motion", "hue_family"].filter((k) => !c[k]);
  const px = defaultDisplayPx(it);
  const rows = [
    ["条目", `${it.id}${it.name ? " " + it.name : ""}${it.note ? `　${it.note}` : ""}`],
    ["极性 / 锚点",
      `<span class="pill p-${it.polarity || "buff"}">${POLARITY_LABEL[it.polarity] || it.polarity || "?"}</span>
       → <code>${it.anchor || "—"}</code>`],
    ["唯一母题", c.motif_id ? `<code>${c.motif_id}</code>${c.motif ? " · " + c.motif : ""}` : `<span class="miss">未冻结</span>`],
    ["唯一运动", c.motion ? `<code>${c.motion}</code>${c.motion_label ? " · " + c.motion_label : ""}` : `<span class="miss">未冻结</span>`],
    ["色相族", c.hue_family ? c.hue_family + tintNote(it) : `<span class="miss">未冻结</span>`],
    ["尺寸预算", (() => { const b = budgetPx(state.bundle, it.anchor);
      const pct = (px / G.card.width * 100).toFixed(0);
      return b ? `本条预算 ≈ ${b.toFixed(1)}（按锚点 <code>${it.anchor}</code> 分档），当前实现 ${px.toFixed(1)}（占卡宽 ${pct}%）` : `当前实现 ${px.toFixed(1)}（占卡宽 ${pct}%）`; })()],
    ["当前实现", impl.node_count
      ? `${impl.node_count} 个组件 · 母题承载件 <code>${impl.prim_id || "—"}</code> · 实测显示直径 <b>${(impl.display_px || 0).toFixed(1)}</b> · ${impl.loop === false ? "瞬发" : "循环"}`
        + (impl.prim_is_backing
          ? `　<span class="miss">⚠ 只能定位到底层承托层（soft_glow），这个显示直径量的是背景光雾、不是母题本体</span>`
          : "")
      : "（无实现记录）"],
    ["合同状态", miss.length ? `<span class="miss">缺 ${miss.join(" / ")}</span>（未纳入风格闸）` : `<span class="ok">已冻结</span>`]
  ];
  if (c.motion_pair_note) rows.push(["运动区分说明", c.motion_pair_note]);

  const t = el("table", "wb-spec");
  for (const [k, v] of rows) {
    const tr = el("tr");
    tr.append(el("th", null, k));
    const td = el("td");
    td.innerHTML = v;
    tr.append(td);
    t.append(tr);
  }
  $("#wb-plan").replaceChildren(el("h2", "wb-h", "方案卡"), t, drawEntry());
}

/**
 * 「方案」页底部的手绘入口。
 *
 * 为什么需要：手绘板一直存在，但它躲在第 4 个 tab 里 —— 实测有人翻遍页面也没找到。
 * 而"先画一版再生成"恰恰是它最有价值的用法，所以要在人**第一眼看到的那一页**给个入口。
 */
function drawEntry() {
  const box = el("div", "wb-draw-entry");
  box.append(el("span", "wb-hint", "心里已经有形状了？不用等生成 —— 直接画一版，作为生图参考。"));
  const btn = el("button", "wb-primary", "✏️ 打开手绘板");
  btn.id = "wb-goto-draw";
  btn.onclick = () => selectTab("draw");
  box.append(btn);
  return box;
}

function tintNote(it) {
  const rgb = it.tint || [1, 1, 1];
  const { h, s } = hueOf(rgb);
  const sw = `<span class="swatch" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${cssRgb(rgb)};vertical-align:middle;margin:0 4px"></span>`;
  if (s < 0.2) return `${sw}<span class="miss">低彩度</span>（不判色相）`;
  return `${sw}实测色相 ${h.toFixed(0)}°`;
}

/* ───────────────────────────── ② 选材 ───────────────────────────── */

function renderPick() {
  const it = curItem();
  const box = $("#wb-pick");
  const cands = it.candidates || [];
  if (!cands.length) {
    box.replaceChildren(el("h2", "wb-h", "选材"), el("p", "wb-hint", "本条没有候选素材。导出器应至少带上：自有生成 / 当前实现引用 / 参考库命中的素材。"));
    return;
  }
  const sel = decOf(it.id).cand;
  const tint = it.tint || [1, 1, 1];
  const head = el("h2", "wb-h", "选材 · 只看 45px 那一列");
  const hint = el("p", "wb-hint");
  hint.innerHTML = `45px 是特效在棋盘上的真实读数尺寸。<b>256px 好看、缩到 45px 糊成一团 = 不合格</b>（多数情况是母题选错，不是调参问题）。<br>
    素材本体若是「亮度实体」（白色，靠运行时上色），<b>必须看上色版</b> —— 原图那格只用来读纹样结构。本条目标色 ${cssRgb(tint)}。`;
  const board = el("div", "wb-board");
  cands.forEach((c, i) => {
    const card = el("div", "wb-cand");
    card.setAttribute("aria-pressed", String(sel === i));
    const row = el("div", "row");
    const mk = (w, h, src, title) => {
      const b = el("div", "wb-box");
      b.style.width = `${w}px`;
      b.style.height = `${h}px`;
      b.title = title;
      const img = new Image();
      img.src = src;
      img.alt = title;
      b.append(img);
      return b;
    };
    row.append(
      mk(45, 45, c.image, "原图（未上色）"),
      mk(45, 45, coverImage(it, c), "上色 · 卡片背景"),
      mk(45, 45, coverImage(it, c), "上色 · 深色背景"),
      mk(70, 70, coverImage(it, c), "上色 2×")
    );
    row.children[1].style.background = "#e9dfc8";
    row.children[2].style.background = "#1b1720";
    row.children[3].style.background = "#e9dfc8";
    const cap = el("div", "cap", "原图 · 上色/浅底 · 上色/深底 · 2×");
    const lbl = el("div", "lbl");
    lbl.append(el("span", `badge b-${c.source || "current"}`, c.source_label || c.source || "—"),
      document.createTextNode(c.label || c.id || ""));
    const meta = el("div", "meta", c.note || "");
    card.append(row, cap, lbl, meta);
    if (c.license) card.append(el("div", "meta", c.license));
    card.onclick = () => {
      decOf(it.id).cand = i;
      renderPick();
      renderScene();
    };
    board.append(card);
  });
  box.replaceChildren(head, hint, board);
  box.append(libSection());
  paintLibList();   // 挂载之后再画（元素此刻才在 document 里）
}

/* ───────────────────────────── ③ 合成示意 ───────────────────────────── */

function renderScene() {
  const it = curItem();
  if (!it) return;
  const d = decOf(it.id);
  const cands = it.candidates || [];
  if (d.cand === undefined) {
    const ci = cands.findIndex((c) => c.source === "current");
    d.cand = ci >= 0 ? ci : 0;
  }
  const cand = cands[d.cand] || null;
  const impl = it.impl || {};

  if (d.display_px === undefined) d.display_px = defaultDisplayPx(it);
  if (d.offset === undefined) d.offset = [Number(impl.offset?.[0]) || 0, Number(impl.offset?.[1]) || 0];
  if (d.alpha === undefined) d.alpha = 1;
  if (d.frame === undefined) d.frame = cand?.best_frame || 0;

  // ── 画布布局（全部按参考像素推导，再统一乘 SCALE）──
  const cw = G.card.width, chh = G.card.height;
  const cellW = G.cell ? G.cell.width : 0, cellD = G.cell ? G.cell.depth : 0;
  const PADREF = 22;
  const refW = Math.max(cw, cellW) + PADREF * 2;
  const refH = chh + cellD + PADREF * 2 + 16;
  const SCALE = Math.max(1.2, Math.min(3.2, 620 / refW));
  const W = Math.round(refW * SCALE), H = Math.round(refH * SCALE);
  const ox = W / 2, oy = (PADREF + chh / 2) * SCALE;      // 卡心在画布上的位置
  const toX = (x) => ox + x * SCALE;
  const toY = (y) => oy + y * SCALE;

  const a = anchorRect(it.anchor) || { x: 0, y: 0, w: 0, h: 0 };
  // 锚点中心相对「卡心」的参考坐标
  const aCx = a.x + a.w / 2 - cw / 2;
  const aCy = a.y + a.h / 2 - chh / 2;
  const budget = budgetPx(state.bundle, it.anchor);
  const budgetRingY = G.cell ? chh / 2 + cellD / 2 : chh / 2;

  const bgs = state.bundle.backgrounds || [{ id: "light", label: "浅底", color: "#e9dfc8" }];
  const isSheet = (cand?.frame_cols || 1) > 1 || (cand?.frame_rows || 1) > 1;
  const nFrames = isSheet ? (cand.frame_cols || 1) * (cand.frame_rows || 1) : 1;

  $("#wb-ctrls").innerHTML = `
    <div class="wb-ctl"><label class="top">显示直径 <b id="v-px">${d.display_px.toFixed(1)}</b> px
        <span class="sub" id="v-size"></span></label>
      <input type="range" id="r-px" min="8" max="${Math.round(Math.max(200, cw * 2))}" step="0.5" value="${d.display_px}"></div>
    <div class="wb-ctl"><label class="top">锚点偏移 X <b id="v-ox">${d.offset[0]}</b></label>
      <input type="range" id="r-ox" min="-90" max="90" step="0.5" value="${d.offset[0]}"></div>
    <div class="wb-ctl"><label class="top">锚点偏移 Y <b id="v-oy">${d.offset[1]}</b></label>
      <input type="range" id="r-oy" min="-90" max="90" step="0.5" value="${d.offset[1]}"></div>
    <div class="wb-ctl"><label class="top">不透明度 <b id="v-al">${d.alpha.toFixed(2)}</b></label>
      <input type="range" id="r-al" min="0.1" max="1" step="0.05" value="${d.alpha}"></div>
    <div class="wb-ctl"><label class="top">相位（图集帧） <b id="v-fr">${d.frame}</b> / ${nFrames - 1}</label>
      <input type="range" id="r-fr" min="0" max="${nFrames - 1}" step="1" value="${d.frame}"></div>
    <div class="wb-ctl"><label class="top">背景</label>
      <div class="inline">${bgs.map((b, i) => `<label><input type="radio" name="bg" value="${i}" ${i === 0 ? "checked" : ""}> ${b.label}</label>`).join("")}</div></div>
    <div class="wb-ctl"><label class="top">叠加显示</label>
      <div class="inline">
        ${G.cell ? '<label><input type="checkbox" id="c-cell" checked> 棋格</label>' : ""}
        <label><input type="checkbox" id="c-anc" checked> 锚点框</label>
        ${budget ? '<label><input type="checkbox" id="c-bud" checked> 预算圈</label>' : ""}
        <label><input type="checkbox" id="c-tint" checked> 上色</label>
        <label><input type="checkbox" id="c-glow" checked> 近似发光</label>
        <label><input type="checkbox" id="c-box" checked> 特效框</label>
      </div>
      <div class="sub">在画布上<b>拖动</b>可直接挪特效（写入锚点偏移）。</div></div>
    <div class="wb-ctl"><label class="top">审批</label>
      <button class="wb-primary" id="wb-confirm">确认本条采用此方案</button>
      <div class="sub" id="wb-cstate"></div>
      <div class="sub">只有<b>确认过</b>的条目才会带着 <code>confirmed:true</code> 导出。</div></div>`;

  $("#wb-canvas-wrap").innerHTML = `<canvas id="wb-canvas" width="${W}" height="${H}"></canvas>`;
  $("#wb-readout").hidden = false;

  const cv = $("#wb-canvas"), g2 = cv.getContext("2d");
  const imgRaw = new Image(), imgTint = new Image();
  let nLoaded = 0;

  const useTint = () => !$("#c-tint") || $("#c-tint").checked;
  const activeSrc = () => (useTint() ? imgTint : imgRaw);
  const activeOK = () => (useTint() ? imgTint.naturalWidth : imgRaw.naturalWidth) > 0;

  function draw() {
    const bgIdx = Number(document.querySelector("input[name=bg]:checked")?.value || 0);
    const bg = bgs[bgIdx] || bgs[0];
    const px = Number($("#r-px").value);
    const offX = Number($("#r-ox").value), offY = Number($("#r-oy").value);
    const al = Number($("#r-al").value), fr = Number($("#r-fr").value);

    $("#v-px").textContent = px.toFixed(1);
    $("#v-ox").textContent = offX;
    $("#v-oy").textContent = offY;
    $("#v-al").textContent = al.toFixed(2);
    $("#v-fr").textContent = fr;
    const kNode = impl.prim_id && kOf(impl.prim_id) ? kOf(impl.prim_id) : null;
    $("#v-size").textContent = kNode ? `(= size ${(px / kNode).toFixed(4)}，K=${kNode})` : "";

    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.fillStyle = bg.color || "#e9dfc8";
    g2.fillRect(0, 0, W, H);
    g2.save();

    // 棋格（近似透视：下宽上窄）
    if (G.cell && (!$("#c-cell") || $("#c-cell").checked)) {
      const cy = chh / 2 + cellD / 2 - 4;
      const wT = cellW * 0.88;
      const q = [[-wT / 2, cy - cellD / 2], [wT / 2, cy - cellD / 2], [cellW / 2, cy + cellD / 2], [-cellW / 2, cy + cellD / 2]];
      g2.beginPath();
      g2.moveTo(toX(q[0][0]), toY(q[0][1]));
      for (let i = 1; i < 4; i++) g2.lineTo(toX(q[i][0]), toY(q[i][1]));
      g2.closePath();
      g2.fillStyle = "rgba(128,128,128,.10)";
      g2.fill();
      g2.strokeStyle = "rgba(128,128,128,.45)";
      g2.setLineDash([5, 4]);
      g2.lineWidth = 1;
      g2.stroke();
      g2.setLineDash([]);
    }

    // 预算圈
    if (budget && (!$("#c-bud") || $("#c-bud").checked)) {
      g2.beginPath();
      g2.arc(toX(0), toY(budgetRingY), (budget * SCALE) / 2, 0, Math.PI * 2);
      g2.strokeStyle = "rgba(93,228,199,.8)";
      g2.setLineDash([3, 3]);
      g2.lineWidth = 1.2;
      g2.stroke();
      g2.setLineDash([]);
    }

    // 卡面（圆角矩形 = 载体形状）
    const w2 = cw * SCALE, h2 = chh * SCALE, r2 = (G.card.radius || cw * 0.1) * SCALE;
    g2.beginPath();
    if (g2.roundRect) g2.roundRect(toX(-cw / 2), toY(-chh / 2), w2, h2, r2);
    else g2.rect(toX(-cw / 2), toY(-chh / 2), w2, h2);
    g2.fillStyle = bgIdx === 0 ? "rgba(255,255,255,.88)" : "rgba(58,50,72,.94)";
    g2.fill();
    g2.strokeStyle = bgIdx === 0 ? "rgba(0,0,0,.20)" : "rgba(255,255,255,.24)";
    g2.lineWidth = 1;
    g2.stroke();

    // 锚点框
    if (!$("#c-anc") || $("#c-anc").checked) {
      const ax = toX(-cw / 2 + a.x), ay = toY(-chh / 2 + a.y);
      g2.strokeStyle = "rgba(181,140,240,.95)";
      g2.setLineDash([4, 3]);
      g2.lineWidth = 1.2;
      g2.strokeRect(ax, ay, a.w * SCALE, a.h * SCALE);
      g2.setLineDash([]);
      g2.fillStyle = "rgba(181,140,240,1)";
      g2.font = "11px Inter, sans-serif";
      g2.fillText(it.anchor || "", ax, ay - 4);
    }

    // 特效
    if (cand) {
      const ex = toX(aCx + offX), ey = toY(aCy + offY);
      const ew = px * SCALE, eh = ew / (cand.aspect || 1);
      if (activeOK()) {
        const s = activeSrc();
        const cols = cand.frame_cols || 1, rows = cand.frame_rows || 1;
        const fw = s.naturalWidth / cols, fh = s.naturalHeight / rows;
        const fx = fr % cols, fy = Math.floor((fr % (cols * rows)) / cols);
        g2.globalAlpha = al;
        if (!$("#c-glow") || $("#c-glow").checked) {
          g2.shadowColor = "rgba(255,255,255,.9)";
          g2.shadowBlur = 9;
        }
        try { g2.drawImage(s, fx * fw, fy * fh, fw, fh, ex - ew / 2, ey - eh / 2, ew, eh); } catch { /* 单帧越界忽略 */ }
        g2.shadowBlur = 0;
        g2.globalAlpha = 1;
      }
      if (!$("#c-box") || $("#c-box").checked) {
        g2.strokeStyle = "rgba(255,0,140,.9)";
        g2.setLineDash([2, 2]);
        g2.lineWidth = 1;
        g2.strokeRect(ex - ew / 2, ey - eh / 2, ew, eh);
        g2.setLineDash([]);
      }
    }
    g2.restore();

    // 读数
    const pctCard = (px / cw) * 100;
    let cls = "flag-ok", msg = "在预算内";
    if (budget) {
      if (px > budget * 1.5) { cls = "flag-err"; msg = "超预算 1.5×以上 —— 大概率是尺寸错了"; }
      else if (px > budget) { cls = "flag-warn"; msg = "超预算；卡牌/覆盖类允许少量溢出，但不要糊到相邻格"; }
    }
    $("#wb-readout").innerHTML =
      `显示直径 <b>${px.toFixed(1)}</b> px · 占卡宽 <b>${pctCard.toFixed(0)}%</b>` +
      (budget ? ` · 预算 <b>${budget.toFixed(1)}</b> px → <span class="${cls}">${msg}</span>` : "") +
      `<br><span class="sub">锚点 <code>${it.anchor || "—"}</code> · 偏移 [${offX}, ${offY}] · 素材 ${
        cand ? (cand.label || cand.id || "—") : "—"}</span>`;

    Object.assign(decOf(it.id), {
      display_px: px, offset: [offX, offY], alpha: al, frame: fr, cand: d.cand,
      anchor: it.anchor || null, asset: cand?.path || null, asset_label: cand?.label || null,
      asset_ref: cand?.ref || null
    });
    refreshExport();
  }

  for (const id of ["r-px", "r-ox", "r-oy", "r-al", "r-fr"]) {
    const n = $(`#${id}`);
    if (n) n.oninput = draw;
  }
  for (const id of ["c-cell", "c-anc", "c-bud", "c-tint", "c-glow", "c-box"]) {
    const n = $(`#${id}`);
    if (n) n.onchange = draw;
  }
  for (const n of document.querySelectorAll("input[name=bg]")) n.onchange = draw;

  // 拖动摆位
  let drag = false, sx = 0, sy = 0, bx = 0, by = 0;
  cv.onpointerdown = (e) => {
    drag = true; sx = e.clientX; sy = e.clientY;
    bx = Number($("#r-ox").value); by = Number($("#r-oy").value);
    cv.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  cv.onpointermove = (e) => {
    if (!drag) return;
    $("#r-ox").value = Math.max(-90, Math.min(90, bx + (e.clientX - sx) / SCALE));
    $("#r-oy").value = Math.max(-90, Math.min(90, by + (e.clientY - sy) / SCALE));
    draw();
  };
  const stop = (e) => { drag = false; try { cv.releasePointerCapture?.(e.pointerId); } catch { /* noop */ } };
  cv.onpointerup = stop;
  cv.onpointercancel = () => { drag = false; };

  // 审批
  const paint = () => {
    const c = !!decOf(it.id).confirmed;
    const btn = $("#wb-confirm");
    btn.classList.toggle("done", c);
    btn.textContent = c ? "已确认（点击取消）" : "确认本条采用此方案";
    $("#wb-cstate").innerHTML = c ? '<span class="flag-ok">已确认</span>' : "未确认（只调参不算，不会带 confirmed 导出）";
  };
  $("#wb-confirm").onclick = () => {
    decOf(it.id).confirmed = !decOf(it.id).confirmed;
    paint();
    refreshExport();
  };
  paint();

  if (cand) {
    const onl = () => { if (++nLoaded >= 2) draw(); };
    imgRaw.onload = onl; imgTint.onload = onl;
    imgRaw.onerror = onl; imgTint.onerror = onl;
    imgRaw.src = cand.image;
    imgTint.src = coverImage(it, cand);
  }
  draw();
}

/* ─────────────────── 外部素材库（文件夹选择器 + 搜索） ─────────────────── */

/**
 * 为什么要有它：数据包里每个条目只带 3 张外部参考（够看调性），但真要选材时得能**按关键词找到**
 * 整个第三方素材库。浏览器不能读任意路径，所以这里让人**选一次文件夹**，之后全在本地索引里搜。
 *
 * ⚠️ 全程纯本地：`<input webkitdirectory>` 给的 File 对象不出浏览器 —— 不上传、不写进仓库。
 * 公开仓库里只放这个工具，第三方素材（无分发授权）永远留在使用方机器上。
 *
 * 命名的意义就在这儿：**搜索只认文件名**。所以第三方素材应当规范命名成
 * `<类别>_<序号>_<描述>.png`，例如 `雷电能量_007_star-burst.png` —— 类别能被中文搜到，
 * 描述能被英文搜到。见 atlas `docs/workbench.md` §7。
 */
const lib = { index: [], files: new Map(), filter: "", folder: "" };

const libTag = (e) => e.tag || (e.dir || "").replace(/^third_party_pinterest_vfx$/, "") || "未分类";

function matchLib(e, q) {
  if (!q) return true;
  const hay = `${e.name} ${e.tag} ${e.title} ${e.dir}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function libSorted() {
  return lib.index
    .filter((e) => matchLib(e, lib.filter))
    .sort((a, b) => (lib.files.has(a.name.toLowerCase()) === lib.files.has(b.name.toLowerCase())
      ? 0 : lib.files.has(a.name.toLowerCase()) ? -1 : 1));
}

/** 把一张图按目标色上色（multiply + destination-in 保 alpha），返回 dataURL。 */
function tintToDataURL(src, rgb) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.min(img.naturalWidth, 256);
      c.height = Math.max(1, Math.round(c.width * img.naturalHeight / Math.max(1, img.naturalWidth)));
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, c.width, c.height);
      x.globalCompositeOperation = "multiply";
      x.fillStyle = cssRgb(rgb);
      x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "destination-in";
      x.drawImage(img, 0, 0, c.width, c.height);
      try { resolve(c.toDataURL("image/png")); } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

function onFolderPicked(fileList) {
  lib.files.clear();
  let n = 0;
  for (const f of fileList) {
    if (!/\.(png|webp|jpg|jpeg|gif)$/i.test(f.name)) continue;
    lib.files.set(f.name.toLowerCase(), f);
    n++;
  }
  lib.folder = fileList[0]?.webkitRelativePath?.split("/")[0] || "（已选）";
  const hint = $("#wb-lib-stat");
  if (hint) hint.textContent = `已载入 ${n} 张图（纯本地，未上传）。搜索框里输类别或描述即可；点缩略图上的「加入候选」把它放进当前条目。`;
  paintLibList();
}

function paintLibList() {
  const box = $("#wb-lib-list");
  if (!box) return;
  const rows = libSorted();
  const LIMIT = 200;
  box.replaceChildren();
  if (!rows.length) {
    box.append(el("p", "wb-hint", lib.index.length
      ? "没有匹配项。换个关键词，或换一个文件夹（搜索只认文件名，所以素材规范命名很重要）。"
      : "数据包里没有外部素材库索引。"));
    return;
  }
  const frag = document.createDocumentFragment();
  for (const e of rows.slice(0, LIMIT)) {
    const card = el("div", "wb-lib-item");
    const key = e.name.toLowerCase();
    if (lib.files.has(key)) {
      const img = new Image();
      img.src = URL.createObjectURL(lib.files.get(key));
      img.alt = e.name;
      img.loading = "lazy";
      card.append(img);
    } else {
      const ph = el("div", "wb-lib-miss", "未在所选文件夹里");
      card.append(ph);
    }
    card.append(el("div", "wb-lib-name", e.name));
    card.append(el("div", "wb-lib-meta", [e.tag, e.title].filter(Boolean).join(" · ") || e.dir));
    if (lib.files.has(key)) {
      const btn = el("button", "wb-ghost", "加入候选");
      btn.onclick = () => addExternalCandidate(e, lib.files.get(key));
      card.append(btn);
    }
    frag.append(card);
  }
  box.append(frag);
  if (rows.length > LIMIT) box.append(el("p", "wb-hint", `（只显示前 ${LIMIT} 项，共 ${rows.length} 项，请再收窄关键词）`));
}

async function addExternalCandidate(meta, file) {
  const it = curItem();
  if (!it) return;
  const url = URL.createObjectURL(file);
  const tint = it.tint || [1, 1, 1];
  const cand = {
    id: `folder/${meta.name}`,
    label: file.name,
    source: "external",
    source_label: "第三方文件夹",
    note: [meta.tag, meta.title, `本地文件夹：${lib.folder}`].filter(Boolean).join(" · "),
    license: "第三方 · 无分发授权（仅本地使用）",
    path: meta.name,
    ref: { type: "external_file", name: file.name, rel_path: file.webkitRelativePath || file.name },
    image: url,
    image_tinted: await tintToDataURL(url, tint),
    frame_cols: 1, frame_rows: 1, best_frame: 0,
    aspect: 1
  };
  it.candidates.push(cand);
  decOf(it.id).cand = it.candidates.length - 1;
  renderPick();
  renderScene();
}

function libSection() {
  const wrap = el("section", "wb-lib");
  wrap.append(el("h2", "wb-h", "外部素材库 · 选文件夹 → 搜索 → 加入候选"));
  const hint = el("p", "wb-hint");
  hint.innerHTML = `数据包里只有每条的 3 张参考。要选整个第三方库，就在下面**选一次文件夹**——
    全程在浏览器本地索引，不上传、不写进公开仓库。搜索**只认文件名**，所以素材要规范命名成
    <code>&lt;类别&gt;_&lt;序号&gt;_&lt;描述&gt;.png</code>（如 <code>雷电能量_007_star-burst.png</code>），
    中文搜类别、英文搜描述。`;
  wrap.append(hint);

  const bar = el("div", "wb-bar");
  const pick = el("input");
  pick.type = "file";
  pick.webkitdirectory = true;
  pick.multiple = true;
  pick.id = "wb-folder";
  pick.onchange = () => onFolderPicked(pick.files || []);
  bar.append(pick);
  const search = el("input");
  search.type = "search";
  search.id = "wb-lib-search";
  search.placeholder = "搜索：类别（雷电 / 法阵 / 斩击…）或描述关键词";
  search.value = lib.filter;
  search.oninput = () => { lib.filter = search.value; paintLibList(); };
  bar.append(search);
  wrap.append(bar);
  const stat = el("div", "wb-lib-stat", "");
  stat.id = "wb-lib-stat";
  wrap.append(stat);
  const list = el("div", "wb-lib-list");
  list.id = "wb-lib-list";
  wrap.append(list);
  // ⚠️ 不要在这里 paint —— 此刻 wrap 还没挂进 document，`$("#wb-lib-list")` 会拿到 null。
  //    由调用方在 append 之后调 paintLibList()。
  if (lib.index.length) {
    stat.textContent = `本工程第三方素材库索引 ${lib.index.length} 项（只有名字/类别，没有图）。`
      + "选一次素材文件夹后，就能看到缩略图并「加入候选」。下方搜到的条目点按钮即加入当前条目。";
  }
  return wrap;
}

/* ───────────────────── ✏️ 手绘参考（生成素材之前先给个版本） ───────────────────── */

/**
 * 为什么要有它：在"选素材"之前，人往往**心里已经有形状**了 —— 但现在只能靠嘴描述或
 * 等生成出来再否掉。给一块画布，人可以直接画一版，作为生图参考（image1）交回工程。
 *
 * 语义要说清楚：**手绘是"参考"，不是"成品"**。它进的是生成素材的输入，不是最终素材。
 *
 * 画布约束与合成示意同源（卡面/棋格/锚点），所以画出来的位置和大小是**可对照**的，
 * 底下还会垫一层当前实现（淡显），方便"照着我想要的改"。
 */
const bw = { tool: "brush", width: 6, history: [], dirty: false };

function drawGeom() {
  const cw = G.card.width, chh = G.card.height;
  const cellW = G.cell ? G.cell.width : 0, cellD = G.cell ? G.cell.depth : 0;
  const PAD = 34;
  const refW = Math.max(cw, cellW) + PAD * 2;
  const refH = chh + cellD + PAD * 2 + 18;
  const S = Math.max(2, Math.min(4, 560 / refW));
  return { cw, chh, cellW, cellD, refW, refH, S, W: Math.round(refW * S), H: Math.round(refH * S),
           ox: (Math.max(cw, cellW) + PAD * 2) / 2 * S, oy: (PAD + chh / 2) * S };
}

function drawGuides(g, geo, bg) {
  const { cw, chh, cellW, cellD, S, ox, oy } = geo;
  const X = (x) => ox + x * S, Y = (y) => oy + y * S;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = bg;
  g.fillRect(0, 0, geo.W, geo.H);
  if (G.cell) {
    const cy = chh / 2 + cellD / 2 - 4, wT = cellW * 0.88;
    g.beginPath();
    g.moveTo(X(-wT / 2), Y(cy - cellD / 2));
    g.lineTo(X(wT / 2), Y(cy - cellD / 2));
    g.lineTo(X(cellW / 2), Y(cy + cellD / 2));
    g.lineTo(X(-cellW / 2), Y(cy + cellD / 2));
    g.closePath();
    g.fillStyle = "rgba(128,128,128,.12)"; g.fill();
    g.strokeStyle = "rgba(128,128,128,.5)"; g.setLineDash([5, 4]); g.lineWidth = 1; g.stroke(); g.setLineDash([]);
  }
  const w = cw * S, h = chh * S, r = (G.card.radius || cw * 0.1) * S;
  g.beginPath();
  if (g.roundRect) g.roundRect(X(-cw / 2), Y(-chh / 2), w, h, r); else g.rect(X(-cw / 2), Y(-chh / 2), w, h);
  g.fillStyle = "rgba(255,255,255,.85)"; g.fill();
  g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 1; g.stroke();
}

function renderDraw() {
  const it = curItem();
  if (!it) return;
  const box = $("#wb-draw");
  const geo = drawGeom();
  box.replaceChildren();

  box.append(el("h2", "wb-h", "✏️ 手绘参考 · 在生成素材之前，先把你要的形状画出来"));
  const hint = el("p", "wb-hint");
  hint.innerHTML = `画布用的是**和合成示意同一套载体几何**（卡面 / 棋格 / 锚点），所以你的笔画位置可以直接对照。
    底下会淡显当前实现，方便"照着我想要的改"。<b>手绘是给生图的参考，不是成品素材。</b>
    画完点「写回磁盘」即可 —— 会存成 <code>drawings/&lt;条目&gt;.png</code>，工程那边直接读，<b>你不用下载任何东西</b>。`;
  box.append(hint);

  const tint = it.tint || [1, 1, 1];
  const bar = el("div", "wb-bar");
  const mkSep = (label, node) => { const w = el("label", "wb-inline"); w.append(document.createTextNode(label), node); return w; };

  const toolSel = el("select");
  toolSel.id = "wb-draw-tool";
  for (const [v, t] of [["brush", "画笔"], ["line", "直线"], ["eraser", "橡皮"]]) {
    const o = el("option", null, t); o.value = v; toolSel.append(o);
  }
  toolSel.value = bw.tool;
  toolSel.onchange = () => { bw.tool = toolSel.value; };

  const colorIn = el("input"); colorIn.type = "color"; colorIn.id = "wb-draw-color";
  colorIn.value = cssRgb(tint);
  const widthIn = el("input"); widthIn.type = "range"; widthIn.min = "2"; widthIn.max = "28"; widthIn.step = "1";
  widthIn.value = String(bw.width); widthIn.id = "wb-draw-width";
  const widthVal = el("span", "wb-hint", String(bw.width));
  widthIn.oninput = () => { bw.width = Number(widthIn.value); widthVal.textContent = widthIn.value; };

  const under = el("input"); under.type = "checkbox"; under.id = "wb-draw-under"; under.checked = true;

  const undoBtn = el("button", "wb-ghost", "撤销");
  const clearBtn = el("button", "wb-ghost", "清空");
  const pushBtn = el("button", "wb-primary", "写回磁盘");

  bar.append(toolSel, mkSep("粗细", widthIn), widthVal, mkSep("颜色", colorIn), mkSep("垫底图", under),
             undoBtn, clearBtn, pushBtn);
  box.append(bar);

  const wrap = el("div", "wb-draw-wrap");
  const cv = document.createElement("canvas");
  cv.id = "wb-draw-canvas";
  cv.width = geo.W; cv.height = geo.H;
  cv.style.width = geo.W + "px"; cv.style.height = geo.H + "px";
  wrap.append(cv);
  box.append(wrap);
  const tip = el("p", "wb-hint", "");
  tip.id = "wb-draw-stat";
  box.append(tip);

  const g = cv.getContext("2d");
  const bg = "#171514";
  drawGuides(g, geo, bg);

  // 垫底：当前实现的候选图淡显
  const cands = it.candidates || [];
  const dec = decOf(it.id);
  const ci = dec.cand !== undefined ? dec.cand : 0;
  const cand = cands[ci] || null;
  if (cand) {
    const img = new Image();
    img.onload = () => {
      const underlay = document.createElement("canvas");
      underlay.width = cv.width; underlay.height = cv.height;
      const ug = underlay.getContext("2d");
      const px = dec.display_px || defaultDisplayPx(it);
      const w = px * geo.S, h = w / (cand.aspect || 1);
      const a = anchorRect(it.anchor) || { x: 0, y: 0, w: 0, h: 0 };
      const cx = geo.ox + (a.x + a.w / 2 - geo.cw / 2) * geo.S + (dec.offset?.[0] || 0) * geo.S;
      const cy = geo.oy + (a.y + a.h / 2 - geo.chh / 2) * geo.S + (dec.offset?.[1] || 0) * geo.S;
      ug.globalAlpha = 0.3;
      try { ug.drawImage(img, cx - w / 2, cy - h / 2, w, h); } catch { /* 忽略 */ }
      cv.__underlay = underlay;
      repaint(loadStrokes());
    };
    img.src = coverImage(it, cand);
  }

  /** 笔画存成矢量，重绘时"垫底 → 笔画"顺序才对（否则垫底会盖住笔画）。 */
  let strokes = [];
  let drawing = false, last = null, lineStart = null, preview = null;
  const strokesKey = `wb-draw-${it.id}`;
  try { strokes = JSON.parse(sessionStorage.getItem(strokesKey) || "[]"); } catch { strokes = []; }
  function saveStrokes() {
    try { sessionStorage.setItem(strokesKey, JSON.stringify(strokes.slice(-400))); } catch { /* 满了就算了 */ }
  }
  function loadStrokes() { return strokes; }

  function repaint(list) {
    drawGuides(g, geo, bg);
    if (cv.__underlay && under.checked) {
      g.globalAlpha = 1;
      g.drawImage(cv.__underlay, 0, 0);
    }
    g.lineCap = "round"; g.lineJoin = "round";
    for (const st of list) paintStroke(g, st);
    if (preview) paintStroke(g, preview);
  }
  function paintStroke(ctx, st) {
    const pts = st.pts;
    if (!pts || pts.length < 2) return;
    ctx.globalCompositeOperation = st.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = st.color;
    ctx.lineWidth = st.width;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
  // ⚠️ 必须按「位图 / 显示」比例换算指针坐标。
  // 画布的内部像素宽是 geo.W，但显示宽会被 CSS 缩放（本站外壳用了 html{zoom:1.2}，
  // 用户还可能自己按 Ctrl+加号）。只减 r.left 不换算的话，笔迹会整体偏移、越画越偏到画布外。
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    const sx = r.width ? cv.width / r.width : 1;
    const sy = r.height ? cv.height / r.height : 1;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  };

  cv.onpointerdown = (e) => {
    drawing = true;
    last = pos(e);
    lineStart = last;
    cv.setPointerCapture?.(e.pointerId);
    if (bw.tool === "line") {
      preview = { tool: "brush", color: colorIn.value, width: bw.width, pts: [last, last] };
      repaint(strokes);
    } else {
      strokes.push({ tool: bw.tool, color: colorIn.value, width: bw.width, pts: [last] });
      repaint(strokes);
    }
    e.preventDefault();
  };
  cv.onpointermove = (e) => {
    if (!drawing) return;
    const p = pos(e);
    if (bw.tool === "line") {
      preview.pts = [lineStart, p];
    } else {
      strokes[strokes.length - 1].pts.push(p);
    }
    repaint(strokes);
  };
  cv.onpointerup = (e) => {
    if (!drawing) return;
    drawing = false;
    const p = pos(e);
    if (bw.tool === "line") {
      strokes.push({ tool: "brush", color: colorIn.value, width: bw.width, pts: [lineStart, p] });
      preview = null;
    }
    saveStrokes();
    repaint(strokes);
    bw.dirty = true;
    scheduleStatePush(true);
    try { cv.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
  };
  cv.onpointercancel = () => { drawing = false; };

  under.onchange = () => repaint(strokes);
  undoBtn.onclick = () => { strokes.pop(); saveStrokes(); repaint(strokes); scheduleStatePush(true); };
  clearBtn.onclick = () => { strokes = []; saveStrokes(); repaint(strokes); scheduleStatePush(true); };
  pushBtn.onclick = () => pushDrawing(it, cv, true);

  tip.textContent = strokes.length
    ? `已画 ${strokes.length} 笔（本地暂存，重启浏览器会丢；点「写回磁盘」才落到工程里）`
    : "还没画。左键画，Shift 不用按 —— 选「直线」就是画直线。";
  repaint(strokes);
}

/* ─────────────────── 回写磁盘（代替"下载文件"） ─────────────────── */

let stateTimer = null;

function statePayload() {
  const base = exportPayload();
  const drawings = {};
  for (const [id, d] of state.decisions) {
    if (d.drawing_file) drawings[id] = { file: d.drawing_file, updated_at: d.drawing_updated_at || null };
  }
  return {
    ...base,
    source: "workbench-live",
    saved_at: new Date().toISOString(),
    collection: state.bundle?.bundle_id || null,
    current_item: state.item,
    drawings,
    ui_note: "由预检工作台自动写回；settings 与人手绘都在这里，工程侧直接读本文件，无需人工下载。"
  };
}

function scheduleStatePush(soon) {
  if (stateTimer) clearTimeout(stateTimer);
  stateTimer = setTimeout(pushState, soon ? 700 : 1600);
}

async function pushState() {
  const sync = $("#wb-sync");
  const payload = statePayload();
  try {
    const res = await fetch("/__wb/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await res.json();
    if (body.ok) {
      if (sync) sync.innerHTML = `<span class="flag-ok">已写回</span> ${body.file} · ${new Date().toLocaleTimeString()}`;
    } else if (sync) {
      sync.innerHTML = `<span class="flag-warn">写回被拒：${body.error}</span>`;
    }
  } catch {
    if (sync) {
      sync.innerHTML = '<span class="flag-warn">写回不可用</span> —— 需要经 <code>npm run dev</code> 打开本页'
        + '（直接双击文件时浏览器不允许写盘）。此时可用下面的「另存为文件」。';
    }
  }
}

async function pushDrawing(it, canvas, manual) {
  const dec = decOf(it.id);
  const file = `drawings/${it.id}.png`;
  const stat = $("#wb-draw-stat");
  const dataUrl = canvas.toDataURL("image/png");
  try {
    const res = await fetch("/__wb/drawing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle_id: state.bundle?.bundle_id, file, png: dataUrl })
    });
    const body = await res.json();
    if (body.ok) {
      dec.drawing_file = body.file;
      dec.drawing_updated_at = new Date().toISOString();
      if (stat) stat.innerHTML = `<span class="flag-ok">手绘已写回 ${body.file}</span>（${Math.round(body.bytes / 1024)} KB）`;
      scheduleStatePush(true);
    } else if (stat) {
      stat.innerHTML = `<span class="flag-warn">写回被拒：${body.error}</span>`;
    }
  } catch {
    if (stat) {
      stat.innerHTML = '<span class="flag-warn">写回不可用</span> —— 请用 <code>npm run dev</code> 打开本页；'
        + '直接双击文件时浏览器不允许写盘。';
    }
    if (manual) {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${it.id}-handdraw.png`;
      a.click();
    }
  }
}

/* ───────────────────────────── ④ 导出 ───────────────────────────── */

function exportPayload() {
  const decisions = {};
  let nConf = 0;
  for (const [id, d] of state.decisions) {
    const it = (state.bundle.items || []).find((x) => x.id === id);
    const cand = it?.candidates?.[d.cand];
    if (d.confirmed) nConf++;
    decisions[id] = {
      confirmed: !!d.confirmed,
      asset_path: d.asset ?? null,
      asset_label: d.asset_label ?? null,
      asset_ref: d.asset_ref ?? null,
      anchor: d.anchor ?? null,
      display_px: d.display_px ?? null,
      anchor_offset: d.offset ?? null,
      alpha: d.alpha ?? null
    };
  }
  return {
    schema: "fx-preflight-decisions/1",
    bundle_id: state.bundle?.bundle_id ?? null,
    workbench: "godot-fx-atlas/workbench.html",
    note: "方案预检决定。这不是引擎验收：浏览器与引擎的混合/发光/粒子行为不同，仍需在引擎内过目。",
    decisions
  };
}

function refreshExport() {
  const txt = JSON.stringify(exportPayload(), null, 2);
  const out = $("#wb-out");
  if (out) out.value = txt;
  const nConf = Object.values(exportPayload().decisions).filter((d) => d.confirmed).length;
  const cnt = $("#wb-count");
  if (cnt) cnt.textContent = `已确认 ${nConf} 条 / 预览过 ${state.decisions.size} 条`;
  // 任何设置变化都自动写回磁盘 —— 人不用为"告诉 AI 我设了什么"做任何动作。
  scheduleStatePush(false);
  return txt;
}

/* ───────────────────────────── 总渲染 ───────────────────────────── */

function render() {
  if (!curItem()) return;
  markNav();
  $("#wb-body").hidden = false;
  renderPlan();
  renderPick();
  renderScene();
  renderDraw();
  refreshExport();
}

/* ───────────────────────────── 事件绑定 ───────────────────────────── */

/**
 * 切到某个 tab。抽成函数是因为面板里也要能跳转 ——
 * 例如「方案」页底部放一个去「✏️ 手绘参考」的入口（实测有人根本没注意到那个 tab）。
 */
function selectTab(name) {
  for (const x of document.querySelectorAll(".wb-tabs button")) {
    x.setAttribute("aria-selected", String(x.dataset.tab === name));
  }
  for (const p of document.querySelectorAll(".wb-panel")) p.classList.toggle("on", p.id === `wb-${name}`);
}

for (const b of document.querySelectorAll(".wb-tabs button")) {
  b.onclick = () => selectTab(b.dataset.tab);
}

$("#wb-download").onclick = () => {
  const blob = new Blob([refreshExport()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `preflight-decisions-${state.bundle?.bundle_id || "bundle"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

const pushButton = $("#wb-push");
if (pushButton) pushButton.onclick = () => pushState();

// 打开页面就先写一次，让工程侧立刻能看到「人在看哪一条」；之后每次改动自动跟随。
setTimeout(pushState, 400);

boot();
