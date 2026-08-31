import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || !value) {
    throw new Error("Usage: node scripts/import-material-source.mjs --source-id <id> --input <sanitized-dir>");
  }
  args.set(key.slice(2), value);
}

const sourceId = args.get("source-id");
const inputRoot = args.get("input");
if (!sourceId || !inputRoot) {
  throw new Error("Both --source-id and --input are required.");
}

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceLockPath = path.join(repoRoot, "materials", "sources.lock.json");
const taxonomyPath = path.join(repoRoot, "materials", "material-taxonomy.json");
const sourceLock = JSON.parse(await readFile(sourceLockPath, "utf8"));
const taxonomy = JSON.parse(await readFile(taxonomyPath, "utf8"));
const source = sourceLock.sources.find((candidate) => candidate.source_id === sourceId);
if (!source) throw new Error(`Unknown source_id: ${sourceId}`);
if (source.distribution_policy !== "direct_use") {
  throw new Error(`Source ${sourceId} is not approved for direct material distribution.`);
}

const normalizedInputRoot = path.resolve(inputRoot);
const inputInfo = await stat(normalizedInputRoot);
if (!inputInfo.isDirectory()) throw new Error(`Input is not a directory: ${normalizedInputRoot}`);

const allowedExtensions = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const variantFiles = new Map();

async function walkFiles(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (entry.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${path.join(relative, entry.name)}`);
    const childRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, childRelative));
    else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(childRelative);
  }
  return files;
}

for (const [variant, relativeDirectory] of Object.entries(source.import.variants)) {
  const variantRoot = path.resolve(normalizedInputRoot, relativeDirectory);
  if (!variantRoot.startsWith(`${normalizedInputRoot}${path.sep}`)) throw new Error(`Unsafe variant path: ${relativeDirectory}`);
  const files = await walkFiles(variantRoot);
  variantFiles.set(variant, { root: variantRoot, files });
}

const allRelativePaths = [...new Set([...variantFiles.values()].flatMap(({ files }) => files.map(toPosix)))].sort();
if (allRelativePaths.length === 0) throw new Error(`No supported raster files found for ${sourceId}.`);

const outputRoot = path.join(repoRoot, "materials", "library", sourceId);
const catalogEntries = [];

for (const relativePath of allRelativePaths) {
  const fileRecords = {};
  for (const [variant, { root, files }] of variantFiles) {
    const nativeRelative = files.find((candidate) => toPosix(candidate) === relativePath);
    if (!nativeRelative) continue;
    const sourcePath = path.join(root, nativeRelative);
    const bytes = await readFile(sourcePath);
    const dimensions = readRasterDimensions(bytes, path.extname(sourcePath).toLowerCase());
    const targetRelative = path.posix.join("materials", "library", sourceId, variant, relativePath.toLowerCase());
    const targetPath = path.join(repoRoot, ...targetRelative.split("/"));
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
    fileRecords[variant] = {
      path: `./${targetRelative}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      width: dimensions.width,
      height: dimensions.height,
      has_alpha_channel: dimensions.hasAlphaChannel,
      has_transparency: dimensions.hasTransparency
    };
  }

  const baseName = path.posix.basename(relativePath, path.posix.extname(relativePath));
  const family = baseName.split("_")[0].toLowerCase();
  const profile = taxonomy.families[family] ?? taxonomy.fallback;
  const isRotated = relativePath.toLowerCase().startsWith("rotated/");
  catalogEntries.push({
    material_id: `${sourceId}/${isRotated ? "rotated/" : ""}${baseName}`,
    source_id: sourceId,
    title: `${isRotated ? "Rotated " : ""}${baseName.replaceAll("_", " ")}`,
    family,
    family_label: profile.label,
    variant_group: isRotated ? "rotated" : "standard",
    roles: profile.roles,
    archetypes: profile.archetypes,
    tags: profile.tags,
    recommended_use: profile.recommended_use,
    caution: profile.caution,
    license: source.license,
    distribution_policy: source.distribution_policy,
    files: fileRecords
  });
}

const licenseSourcePath = path.join(normalizedInputRoot, source.import.license_file);
const licenseTargetRelative = path.posix.join("materials", "licenses", `${sourceId}.txt`);
const licenseTargetPath = path.join(repoRoot, ...licenseTargetRelative.split("/"));
await mkdir(path.dirname(licenseTargetPath), { recursive: true });
const licenseText = await readFile(licenseSourcePath, "utf8");
const normalizedLicenseText = `${licenseText.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim()}\n`;
await writeFile(licenseTargetPath, normalizedLicenseText, "utf8");

const catalog = {
  schema_version: 1,
  catalog_type: "production_material_library",
  entry_count: catalogEntries.length,
  sources: [sourceId],
  entries: catalogEntries
};
await writeFile(path.join(repoRoot, "materials", "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  source_id: sourceId,
  logical_materials: catalogEntries.length,
  raster_files: catalogEntries.reduce((count, entry) => count + Object.keys(entry.files).length, 0),
  output: path.relative(process.cwd(), path.join(repoRoot, "materials", "catalog.json"))
}, null, 2));

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function readRasterDimensions(bytes, extension) {
  if (extension !== ".png") return { width: null, height: null, hasAlphaChannel: null, hasTransparency: null };
  const pngSignature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== pngSignature) throw new Error("Invalid PNG signature.");
  const colorType = bytes.readUInt8(25);
  const hasAlphaChannel = colorType === 4 || colorType === 6;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    hasAlphaChannel,
    hasTransparency: hasAlphaChannel || hasPngChunk(bytes, "tRNS")
  };
}

function hasPngChunk(bytes, expectedType) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === expectedType) return true;
    if (type === "IEND") return false;
    offset += 12 + length;
  }
  return false;
}
