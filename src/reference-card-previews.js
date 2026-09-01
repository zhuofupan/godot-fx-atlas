(() => {
  const manifestUrl = "./reference-previews.json";
  const previewClass = "effect-preview-image";
  const maxConcurrentLoads = 3;
  const launchIntervalMs = 180;
  const fallbackPreviews = [
    {
      hosts: ["github.com"],
      sourcePattern: /shaderv/i,
      imageUrl: "https://opengraph.githubassets.com/1/arkology/ShaderV",
      label: "ShaderV · GitHub",
      fit: "cover"
    },
    {
      hosts: ["godotshaders.com", "www.godotshaders.com"],
      imageUrl: "https://godotshaders.com/wp-content/uploads/2021/01/favicon.png",
      label: "Godot Shaders · 站点图标",
      fit: "contain"
    },
    {
      hosts: ["godotengine.org", "www.godotengine.org"],
      imageUrl: "https://godotengine.org/assets/press/icon_color.svg",
      label: "Godot Asset Library · 站点图标",
      fit: "contain"
    },
    {
      hosts: ["itch.io"],
      includeSubdomains: true,
      imageUrl: "https://static.itch.io/images/itchio-textless-white.svg",
      label: "Itch.io · 站点图标",
      fit: "contain",
      theme: "dark"
    },
    {
      hosts: ["opengameart.org", "www.opengameart.org"],
      imageUrl: "https://opengameart.org/sites/all/themes/oga/opengameart2_favicon.ico",
      label: "OpenGameArt · 站点图标",
      fit: "contain"
    },
    {
      hosts: ["github.com"],
      imageUrl: "https://github.githubassets.com/favicons/favicon.svg",
      label: "GitHub · 站点图标",
      fit: "contain"
    }
  ];

  let previews = new Map();
  let decorationQueued = false;
  let activeLoads = 0;
  let launchTimer = 0;
  const pendingVisuals = [];
  const queuedVisuals = new WeakSet();

  const safeRemoteUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  };

  const getCardContext = (visual) => {
    const card = visual.closest(".effect-card");
    const source = card?.querySelector(".source-badge")?.textContent?.trim() || "来源站点";
    const pageUrl = card?.querySelector(".card-actions a[href]")?.href || "";
    let host = "";
    try {
      host = new URL(pageUrl).hostname.toLowerCase();
    } catch {
      // A missing host only disables matching that source's remote brand image.
    }
    return {
      host,
      pageUrl,
      source,
      title: card?.querySelector("h3")?.textContent?.trim() || visual.dataset.previewEffectId?.toUpperCase()
    };
  };

  const hostMatches = (fallback, host) => fallback.hosts.some((candidate) => (
    host === candidate || (fallback.includeSubdomains && host.endsWith(`.${candidate}`))
  ));

  const buildCandidates = (record, context) => {
    const candidates = [];
    const primaryUrl = safeRemoteUrl(record?.imageUrl);
    if (primaryUrl) {
      candidates.push({
        imageUrl: primaryUrl,
        label: "来源页预览",
        fit: "cover",
        pageUrl: record.pageUrl
      });
    }

    for (const fallback of fallbackPreviews) {
      if (!hostMatches(fallback, context.host)) continue;
      if (fallback.sourcePattern && !fallback.sourcePattern.test(context.source)) continue;
      const imageUrl = safeRemoteUrl(fallback.imageUrl);
      if (imageUrl) candidates.push({ ...fallback, imageUrl, pageUrl: context.pageUrl });
    }

    const seen = new Set();
    return candidates.filter((candidate) => {
      if (seen.has(candidate.imageUrl)) return false;
      seen.add(candidate.imageUrl);
      return true;
    });
  };

  const showTextFallback = (visual, context) => {
    const textFallback = document.createElement("span");
    textFallback.className = "effect-preview-text-fallback";
    textFallback.textContent = context.source;
    visual.append(textFallback);
    visual.dataset.previewState = "unavailable";
    visual.classList.add("has-preview-text-fallback");
  };

  const loadPreview = (visual) => new Promise((resolve) => {
    const effectId = visual.dataset.previewEffectId;
    if (!effectId || !visual.isConnected || visual.querySelector(`.${previewClass}`)) {
      resolve();
      return;
    }

    const record = previews.get(effectId);
    const context = getCardContext(visual);
    const candidates = buildCandidates(record, context);
    if (candidates.length === 0) {
      showTextFallback(visual, context);
      resolve();
      return;
    }

    const image = document.createElement("img");
    image.className = previewClass;
    image.alt = `${context.title} 的来源预览图`;
    image.loading = "eager";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.fetchPriority = "low";

    const sourceLabel = document.createElement("span");
    sourceLabel.className = "effect-preview-source";
    visual.prepend(image);
    visual.append(sourceLabel);
    visual.dataset.previewState = "loading";

    let candidateIndex = 0;
    const tryNextCandidate = () => {
      if (!visual.isConnected) {
        resolve();
        return;
      }
      const candidate = candidates[candidateIndex++];
      if (!candidate) {
        image.remove();
        sourceLabel.remove();
        showTextFallback(visual, context);
        resolve();
        return;
      }

      image.classList.toggle("is-brand-fallback", candidate.label !== "来源页预览");
      image.dataset.fit = candidate.fit;
      image.dataset.theme = candidate.theme || "light";
      image.alt = candidate.label === "来源页预览"
        ? `${context.title} 的来源页预览图`
        : `${context.source} 的来源站点图标`;
      sourceLabel.textContent = candidate.label;
      sourceLabel.title = `图片由来源站点远程提供：${candidate.pageUrl || context.pageUrl}`;
      image.onload = () => {
        visual.dataset.previewState = candidate.label === "来源页预览" ? "loaded" : "brand";
        visual.classList.add("has-reference-preview");
        visual.setAttribute("role", "group");
        visual.setAttribute("aria-label", image.alt);
        resolve();
      };
      image.onerror = tryNextCandidate;
      image.src = candidate.imageUrl;
    };

    tryNextCandidate();
  });

  const pumpQueue = () => {
    if (launchTimer || activeLoads >= maxConcurrentLoads) return;
    while (pendingVisuals.length > 0 && !pendingVisuals[0].isConnected) pendingVisuals.shift();
    const visual = pendingVisuals.shift();
    if (!visual) return;

    launchTimer = window.setTimeout(() => {
      launchTimer = 0;
      activeLoads += 1;
      loadPreview(visual).finally(() => {
        activeLoads -= 1;
        pumpQueue();
      });
      pumpQueue();
    }, activeLoads === 0 ? 0 : launchIntervalMs);
  };

  const enqueuePreview = (visual) => {
    if (queuedVisuals.has(visual)) return;
    queuedVisuals.add(visual);
    pendingVisuals.push(visual);
    pumpQueue();
  };

  const decorateCards = () => {
    decorationQueued = false;
    for (const card of document.querySelectorAll(".effect-card")) {
      const effectId = card.querySelector(".card-topline span")?.textContent?.trim().toLowerCase();
      const visual = card.querySelector(".effect-visual");
      if (!effectId || !visual) continue;
      const sameEffect = visual.dataset.previewEffectId === effectId;
      const state = visual.dataset.previewState;
      if (sameEffect && ["queued", "loading", "loaded", "brand", "unavailable"].includes(state)) continue;

      visual.dataset.previewEffectId = effectId;
      visual.dataset.previewState = "queued";
      visual.classList.add("uses-reference-preview");
      enqueuePreview(visual);
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
      document.documentElement.dataset.referencePreviews = "progressive";
      queueDecoration();
      const observer = new MutationObserver(queueDecoration);
      observer.observe(document.getElementById("root"), { childList: true, subtree: true });
    })
    .catch(() => {
      document.documentElement.dataset.referencePreviews = "unavailable";
    });
})();
