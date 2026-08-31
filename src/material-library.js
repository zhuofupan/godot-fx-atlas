import { buildSelectionManifest, filterMaterials, uniqueValues } from "./material-core.js";

main().catch((error) => {
  console.error(error);
  const resultCount = document.getElementById("result-count");
  if (resultCount) resultCount.textContent = "数据加载失败，请刷新重试";
});

async function main() {
const [catalogResponse, sourcesResponse] = await Promise.all([
  fetch("./materials/catalog.json"),
  fetch("./materials/sources.lock.json")
]);
if (!catalogResponse.ok || !sourcesResponse.ok) throw new Error("贴图库数据加载失败");

const catalog = await catalogResponse.json();
const sourceLock = await sourcesResponse.json();
const entries = catalog.entries;
const sources = sourceLock.sources;
const initialQuery = new URLSearchParams(location.search);
const state = {
  query: initialQuery.get("q") ?? "",
  family: initialQuery.get("family") ?? "",
  archetype: initialQuery.get("archetype") ?? "",
  role: initialQuery.get("role") ?? "",
  source: initialQuery.get("source") ?? "",
  variant: "transparent",
  background: "checker",
  selected: new Set()
};

const ui = Object.fromEntries([
  "material-search", "family-filter", "archetype-filter", "role-filter", "source-filter",
  "variant-filter", "background-filter", "result-count", "material-grid", "empty-state",
  "selected-count", "selection-tray", "export-selection", "clear-selection", "material-dialog",
  "dialog-content", "close-dialog", "source-count", "material-count", "raster-count"
].map((id) => [id.replaceAll("-", "_"), document.getElementById(id)]));

ui.material_search.value = state.query;
fillSelect(ui.family_filter, uniqueValues(entries, "family"), "全部贴图族", (value) => {
  const entry = entries.find((candidate) => candidate.family === value);
  return entry ? `${entry.family_label} · ${value}` : value;
});
fillSelect(ui.archetype_filter, uniqueValues(entries, "archetypes"), "全部效果原型", humanize);
fillSelect(ui.role_filter, uniqueValues(entries, "roles"), "全部层级角色", roleLabel);
fillSelect(ui.source_filter, uniqueValues(entries, "source_id"), "全部素材源", (value) => sourceById(value).title);

ui.family_filter.value = state.family;
ui.archetype_filter.value = state.archetype;
ui.role_filter.value = state.role;
ui.source_filter.value = state.source;
ui.source_count.textContent = String(sources.length);
ui.material_count.textContent = String(catalog.entry_count);
ui.raster_count.textContent = String(entries.reduce((sum, entry) => sum + Object.keys(entry.files).length, 0));

bindInput(ui.material_search, "query", "input");
bindInput(ui.family_filter, "family");
bindInput(ui.archetype_filter, "archetype");
bindInput(ui.role_filter, "role");
bindInput(ui.source_filter, "source");
bindInput(ui.variant_filter, "variant");
bindInput(ui.background_filter, "background");
ui.export_selection.addEventListener("click", exportSelection);
ui.clear_selection.addEventListener("click", () => {
  state.selected.clear();
  render();
});
ui.close_dialog.addEventListener("click", () => ui.material_dialog.close());
ui.material_dialog.addEventListener("click", (event) => {
  if (event.target === ui.material_dialog) ui.material_dialog.close();
});

render();

function bindInput(control, key, eventName = "change") {
  control.addEventListener(eventName, () => {
    state[key] = control.value;
    render();
  });
}

function render() {
  const results = filterMaterials(entries, state);
  syncQueryString();
  ui.result_count.textContent = `${results.length} / ${entries.length} 项`;
  ui.empty_state.hidden = results.length !== 0;
  ui.material_grid.replaceChildren(...results.map(materialCard));
  renderSelection();
}

function materialCard(entry) {
  const preview = entry.files[state.variant] ?? entry.files.transparent ?? Object.values(entry.files)[0];
  const selected = state.selected.has(entry.material_id);
  const checkbox = element("input", { type: "checkbox", checked: selected, ariaLabel: `选择 ${entry.title}` });
  checkbox.addEventListener("change", () => {
    checkbox.checked ? state.selected.add(entry.material_id) : state.selected.delete(entry.material_id);
    renderSelection();
    card.classList.toggle("is-selected", checkbox.checked);
  });

  const image = element("img", { src: preview.path, alt: entry.title, loading: "lazy", width: preview.width, height: preview.height });
  const previewButton = element("button", { className: `material-preview bg-${state.background}`, type: "button", ariaLabel: `查看 ${entry.title} 详情` }, image);
  previewButton.addEventListener("click", () => openDetails(entry));

  const card = element("article", { className: `material-card${selected ? " is-selected" : ""}` },
    element("div", { className: "select-corner" }, checkbox),
    previewButton,
    element("div", { className: "material-card-body" },
      element("div", { className: "eyebrow" }, entry.family_label),
      element("h3", {}, entry.title),
      element("p", {}, entry.recommended_use),
      element("div", { className: "tag-row" }, ...entry.archetypes.slice(0, 3).map((tag) => element("span", {}, humanize(tag)))),
      element("div", { className: "card-meta" },
        element("span", {}, entry.license),
        element("span", {}, `${preview.width}×${preview.height}`)
      )
    )
  );
  return card;
}

function renderSelection() {
  const selectedEntries = entries.filter((entry) => state.selected.has(entry.material_id));
  ui.selected_count.textContent = String(selectedEntries.length);
  ui.selection_tray.classList.toggle("is-visible", selectedEntries.length > 0);
  ui.export_selection.disabled = selectedEntries.length === 0;
}

function openDetails(entry) {
  const source = sourceById(entry.source_id);
  const preview = entry.files[state.variant] ?? entry.files.transparent ?? Object.values(entry.files)[0];
  const download = element("a", { className: "button primary", href: preview.path, download: "" }, `下载 ${state.variant === "transparent" ? "透明底" : "黑底"} PNG`);
  const sourceLink = element("a", { className: "button", href: source.browse_url, target: "_blank", rel: "noreferrer" }, "查看原始来源");
  ui.dialog_content.replaceChildren(
    element("div", { className: `dialog-preview bg-${state.background}` }, element("img", { src: preview.path, alt: entry.title })),
    element("div", { className: "dialog-copy" },
      element("div", { className: "eyebrow" }, `${entry.family_label} · ${entry.variant_group}`),
      element("h2", {}, entry.title),
      element("p", { className: "lead" }, entry.recommended_use),
      detailBlock("适合的效果原型", entry.archetypes.map(humanize).join("、")),
      detailBlock("合成层级", entry.roles.map(roleLabel).join("、")),
      detailBlock("使用提醒", entry.caution, "warning"),
      element("div", { className: "tag-row" }, ...entry.tags.map((tag) => element("span", {}, tag))),
      element("dl", { className: "receipt" },
        receiptRow("素材源", `${source.title} ${source.version}`),
        receiptRow("许可", `${source.license} · ${source.distribution_policy}`),
        receiptRow("文件", `${preview.width}×${preview.height} · ${formatBytes(preview.bytes)}`),
        receiptRow("SHA-256", preview.sha256)
      ),
      element("div", { className: "dialog-actions" }, download, sourceLink)
    )
  );
  ui.material_dialog.showModal();
}

function detailBlock(label, value, className = "") {
  return element("section", { className: `detail-block ${className}`.trim() }, element("h3", {}, label), element("p", {}, value));
}

function receiptRow(label, value) {
  return element("div", {}, element("dt", {}, label), element("dd", {}, value));
}

function exportSelection() {
  const manifest = buildSelectionManifest(entries, state.selected, sources, state.variant);
  const blob = new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = element("a", { href: url, download: "godot-fx-atlas-selection.json" });
  anchor.click();
  URL.revokeObjectURL(url);
}

function fillSelect(select, values, emptyLabel, labelFor) {
  select.replaceChildren(element("option", { value: "" }, emptyLabel), ...values.map((value) => element("option", { value }, labelFor(value))));
}

function sourceById(sourceId) {
  return sources.find((source) => source.source_id === sourceId);
}

function syncQueryString() {
  const query = new URLSearchParams();
  for (const key of ["query", "family", "archetype", "role", "source"]) {
    if (state[key]) query.set(key === "query" ? "q" : key, state[key]);
  }
  history.replaceState(null, "", `${location.pathname}${query.size ? `?${query}` : ""}`);
}

function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") node.className = value;
    else if (key === "checked") node.checked = value;
    else if (key === "ariaLabel") node.setAttribute("aria-label", value);
    else if (typeof value === "boolean") node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function roleLabel(value) {
  return ({ shape: "主体形状", finish: "修饰收尾" })[value] ?? humanize(value);
}

function humanize(value) {
  const labels = {
    ambient_loop: "环境循环", material_loop: "材质循环", resource_transfer: "资源飞行",
    telegraph: "预警", projectile_trail: "投射 / 拖尾", impact_burst: "命中爆发",
    beam_chain: "光束 / 链接", status_aura: "状态光环", shield: "护盾",
    spawn_death: "生成 / 死亡", screen_feedback: "屏幕反馈"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
}
