(() => {
  const additionalSources = [
    ["CodeFronts", "https://codefronts.com/"],
    ["Game-icons.net", "https://game-icons.net/"],
    ["IconsDB", "https://www.iconsdb.com/"],
    ["Kenney", "https://kenney.nl/"]
  ];

  const attachSources = () => {
    const footerLinks = document.querySelector("#root footer > div:last-child");
    if (!footerLinks) return false;

    footerLinks.setAttribute("aria-label", "鸣谢与来源站点");
    const returnToTop = [...footerLinks.querySelectorAll("a")].find((link) => link.getAttribute("href") === "#overview");
    for (const [name, url] of additionalSources) {
      if ([...footerLinks.querySelectorAll("a")].some((link) => link.textContent.includes(name))) continue;
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = `${name} ↗`;
      link.title = `感谢 ${name} 及其作者与维护者提供公开参考资料`;
      footerLinks.insertBefore(link, returnToTop ?? null);
    }
    return true;
  };

  if (attachSources()) return;
  const observer = new MutationObserver(() => {
    if (attachSources()) observer.disconnect();
  });
  observer.observe(document.getElementById("root"), { childList: true, subtree: true });
})();
