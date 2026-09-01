const META_KEYS = [
  "og:image:secure_url",
  "og:image:url",
  "og:image",
  "twitter:image:src",
  "twitter:image",
  "thumbnail"
];

export function extractReferencePreview(html, pageUrl) {
  if (typeof html !== "string" || !html) return null;

  const metadata = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name ?? attributes.itemprop ?? "").toLowerCase();
    const content = attributes.content;
    if (key && content && !metadata.has(key)) metadata.set(key, content);
  }

  for (const key of META_KEYS) {
    const imageUrl = normalizeRemoteImageUrl(metadata.get(key), pageUrl);
    if (imageUrl) return { imageUrl, discovery: key };
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const relations = (attributes.rel ?? "").toLowerCase().split(/\s+/);
    if (!relations.includes("image_src")) continue;
    const imageUrl = normalizeRemoteImageUrl(attributes.href, pageUrl);
    if (imageUrl) return { imageUrl, discovery: "link:image_src" };
  }

  const pageHost = new URL(pageUrl).host;
  if (pageHost === "godotengine.org") {
    for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
      const attributes = parseAttributes(tag);
      const className = (attributes.class ?? "").toLowerCase();
      const isWidePreview = attributes.width === "100%" || /(?:screenshot|preview)/.test(className);
      if (!isWidePreview) continue;
      const imageUrl = normalizeRemoteImageUrl(attributes.src, pageUrl);
      if (imageUrl) return { imageUrl, discovery: "body:asset-preview" };
    }
  }

  return null;
}

export function normalizeRemoteImageUrl(value, pageUrl) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(decodeHtmlEntities(value.trim()), pageUrl);
    const page = new URL(pageUrl);
    if (url.protocol === "http:" && page.protocol === "https:" && url.host === page.host) {
      url.protocol = "https:";
    }
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s=<>`]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}
