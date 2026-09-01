import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractReferencePreview } from "../src/reference-preview-core.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const options = parseArguments(process.argv.slice(2));
if (!options.confirmNetwork) {
  throw new Error("Refreshing source-page preview URLs requires --confirm-network.");
}

const audit = JSON.parse(await readFile(path.join(repoRoot, "final-link-audit.json"), "utf8"));
const allTargets = audit.links.filter((link) => link.kind === "primary");
const targets = options.limit ? allTargets.slice(0, options.limit) : allTargets;
const outputPath = path.resolve(repoRoot, options.output);
const previous = options.refresh ? null : await readExistingManifest(outputPath);
const cachedById = new Map((previous?.entries ?? []).map((entry) => [entry.effectId, entry]));
const records = new Map();
const unresolved = [];
const pending = [];

for (const target of targets) {
  const cached = cachedById.get(target.effectId);
  if (cached?.pageUrl === target.url && cached.imageUrl?.startsWith("https://")) {
    records.set(target.effectId, cached);
  } else {
    pending.push(target);
  }
}

let completed = 0;
await runConcurrent(pending, options.concurrency, async (target) => {
  const result = await inspectPage(target.url, options.timeoutMs);
  if (result.preview) {
    const imageUrl = result.preview.imageUrl;
    records.set(target.effectId, {
      effectId: target.effectId,
      name: target.name,
      pageUrl: target.url,
      imageUrl,
      imageHost: new URL(imageUrl).host,
      discovery: result.preview.discovery,
      checkedAt: new Date().toISOString()
    });
  } else {
    unresolved.push({ effectId: target.effectId, pageUrl: target.url, reason: result.reason });
  }
  completed += 1;
  if (completed % 25 === 0 || completed === pending.length) {
    console.log(`Preview metadata: ${completed}/${pending.length} refreshed, ${records.size}/${targets.length} resolved.`);
  }
  if (options.delayMs) await delay(options.delayMs);
});

const entries = targets.map((target) => records.get(target.effectId)).filter(Boolean);
const failureCounts = new Map();
for (const failure of unresolved) {
  failureCounts.set(failure.reason, (failureCounts.get(failure.reason) ?? 0) + 1);
}
const failureBreakdown = Object.fromEntries(
  [...failureCounts.entries()].sort((left, right) => right[1] - left[1])
);
const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  policy: "remote_url_only",
  metadata_sources: ["og:image:secure_url", "og:image:url", "og:image", "twitter:image:src", "twitter:image", "thumbnail", "link:image_src", "body:asset-preview"],
  total_effects: targets.length,
  entry_count: entries.length,
  fallback_count: targets.length - entries.length,
  failure_breakdown: failureBreakdown,
  entries,
  unresolved
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${entries.length} remote preview URLs to ${path.relative(repoRoot, outputPath)}; no images were downloaded.`);

async function inspectPage(pageUrl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Godot-FX-Atlas-Preview-Audit/1.0 (+https://github.com/zhuofupan/godot-fx-atlas)"
      },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) return { reason: `http_${response.status}` };
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return { reason: "not_html" };
    }
    const html = await response.text();
    const preview = extractReferencePreview(html, response.url || pageUrl);
    return preview ? { preview } : { reason: "no_supported_metadata" };
  } catch (error) {
    return { reason: error?.name === "AbortError" ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}

async function runConcurrent(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  }));
}

async function readExistingManifest(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function parseArguments(argumentsList) {
  const options = {
    confirmNetwork: false,
    concurrency: 8,
    delayMs: 0,
    limit: 0,
    output: "reference-previews.json",
    refresh: false,
    timeoutMs: 15000
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--confirm-network") options.confirmNetwork = true;
    else if (argument === "--refresh") options.refresh = true;
    else if (argument === "--concurrency") options.concurrency = parsePositiveInteger(argumentsList[++index], argument, 24);
    else if (argument === "--delay-ms") options.delayMs = parseNonNegativeInteger(argumentsList[++index], argument, 10000);
    else if (argument === "--limit") options.limit = parsePositiveInteger(argumentsList[++index], argument, Number.MAX_SAFE_INTEGER);
    else if (argument === "--output") options.output = argumentsList[++index];
    else if (argument === "--timeout-ms") options.timeoutMs = parsePositiveInteger(argumentsList[++index], argument, 60000);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.output) throw new Error("--output requires a path.");
  return options;
}

function parsePositiveInteger(value, optionName, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${optionName} requires an integer from 1 to ${maximum}.`);
  }
  return number;
}

function parseNonNegativeInteger(value, optionName, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > maximum) {
    throw new Error(`${optionName} requires an integer from 0 to ${maximum}.`);
  }
  return number;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
