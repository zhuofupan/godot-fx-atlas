(() => {
  const manifestUrl = "./reference-previews.json";
  const previewClass = "effect-preview-image";
  let previews = new Map();
  let decorationQueued = false;
  let previewObserver;

  const safeRemoteUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  };

  const loadPreview = (visual) => {
    const effectId = visual.dataset.previewEffectId;
    const record = previews.get(effectId);
    const imageUrl = safeRemoteUrl(record?.imageUrl);
    if (!effectId || !record || !imageUrl || visual.querySelector(`.${previewClass}`)) return;

    const card = visual.closest(".effect-card");
    const title = card?.querySelector("h3")?.textContent?.trim() || effectId.toUpperCase();
    const image = document.createElement("img");
    image.className = previewClass;
    image.alt = `${title} 的来源页预览图`;
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";

    const sourceLabel = document.createElement("span");
    sourceLabel.className = "effect-preview-source";
    sourceLabel.textContent = "来源页预览";
    sourceLabel.title = `图片由来源页远程提供：${record.pageUrl}`;

    image.addEventListener("load", () => {
      visual.dataset.previewState = "loaded";
      visual.classList.add("has-reference-preview");
      visual.setAttribute("role", "group");
      visual.setAttribute("aria-label", `${title} 的来源页预览图`);
    }, { once: true });
    image.addEventListener("error", () => {
      visual.dataset.previewState = "fallback";
      image.remove();
      sourceLabel.remove();
      visual.classList.remove("has-reference-preview");
    }, { once: true });

    visual.dataset.previewState = "loading";
    visual.prepend(image);
    visual.append(sourceLabel);
    image.src = imageUrl;
  };

  previewObserver = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        previewObserver.unobserve(entry.target);
        loadPreview(entry.target);
      }
    }, { rootMargin: "240px 0px", threshold: 0.01 })
    : null;

  const decorateCards = () => {
    decorationQueued = false;
    for (const card of document.querySelectorAll(".effect-card")) {
      const effectId = card.querySelector(".card-topline span")?.textContent?.trim().toLowerCase();
      const record = previews.get(effectId);
      const visual = card.querySelector(".effect-visual");
      if (!record || !visual) continue;
      const sameEffect = visual.dataset.previewEffectId === effectId;
      const state = visual.dataset.previewState;
      if (sameEffect && (state === "observing" || state === "loading" || state === "fallback")) continue;
      if (sameEffect && state === "loaded" && visual.querySelector(`.${previewClass}`)) continue;

      visual.dataset.previewEffectId = effectId;
      visual.dataset.previewState = "observing";
      if (previewObserver) previewObserver.observe(visual);
      else loadPreview(visual);
    }
  };

  const queueDecoration = () => {
    if (decorationQueued) return;
    decorationQueued = true;
    requestAnimationFrame(decorateCards);
  };

  fetch(manifestUrl, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`preview_manifest_${response.status}`);
      return response.json();
    })
    .then((manifest) => {
      if (manifest?.policy !== "remote_url_only" || !Array.isArray(manifest.entries)) return;
      previews = new Map(manifest.entries.map((entry) => [String(entry.effectId).toLowerCase(), entry]));
      document.documentElement.dataset.referencePreviews = "lazy";
      queueDecoration();
      const observer = new MutationObserver(queueDecoration);
      observer.observe(document.getElementById("root"), { childList: true, subtree: true });
    })
    .catch(() => {
      document.documentElement.dataset.referencePreviews = "fallback";
    });
})();
