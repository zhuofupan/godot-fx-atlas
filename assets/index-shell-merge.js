/**
 * index.html 只有一条顶栏。
 *
 * 背景：index 是 SPA 外壳（`#root` 由构建产物渲染），它自带一条 `.topbar`（品牌 + 页内导航 + 核查数据）。
 * 本站其他三页用的是 `assets/site-shell.css` 里统一的那条 `.site-header`。
 * 如果 index 两条都显示，页面上就会叠两栏 —— 所以这里：
 *   ① 把本站的 `<nav class="top-nav">` **搬进** SPA 那条 `.topbar`（占「核查数据」的位置）；
 *   ② 去掉「核查数据」；
 *   ③ 给 `body` 加 `is-spa`，让 site-shell.css 把本站那条独立顶栏隐藏掉。
 *
 * 搬过去之后不需要额外样式：SPA 自己的 `.topbar nav` / `.topbar nav a`
 * 会把任何 `nav` 渲染成一排胶囊，正好就是我们要的观感。
 *
 * SPA 是 module 脚本，渲染时机不确定 —— 用短轮询等 `.topbar` 出现（最多约 3 秒），
 * 拿不到就什么都不做（此时页面仍然能用，只是多一条栏）。
 */
(function () {
  var tries = 0;

  function merge() {
    var mine = document.querySelector("body > .site-header");
    var spa = document.querySelector("#root header.topbar") || document.querySelector("#root header");
    if (!mine || !spa) return false;

    var drop = spa.querySelector("a.header-link");   // 「核查数据 ↗」
    var nav = mine.querySelector("nav.top-nav");
    if (nav) {
      if (drop && drop.parentNode === spa) spa.insertBefore(nav, drop);
      else spa.appendChild(nav);
    }
    if (drop) drop.remove();
    document.body.classList.add("is-spa");
    return true;
  }

  if (merge()) return;
  var timer = setInterval(function () {
    if (merge() || ++tries > 30) clearInterval(timer);
  }, 100);
})();
