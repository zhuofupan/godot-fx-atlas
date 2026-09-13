import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, readlink, realpath, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { promisify } from "node:util";
import { resolveAtlasRoot } from "./resolve-atlas-root.mjs";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: {
    "codex-home": { type: "string" },
    "dry-run": { type: "boolean", default: false }
  },
  strict: true
});

const skillSource = path.resolve(import.meta.dirname, "..");
const atlasRoot = await resolveAtlasRoot(skillSource);
const manifest = JSON.parse(await readFile(path.join(skillSource, "skill-manifest.json"), "utf8"));
const codexHome = path.resolve(values["codex-home"] || process.env.CODEX_HOME || path.join(homedir(), ".codex"));
const installParent = path.join(codexHome, "skills");
const installPath = path.join(installParent, "godot-fx-atlas");

for (const relativePath of manifest.required_documents) {
  const record = await stat(path.join(atlasRoot, relativePath));
  if (!record.isFile()) throw new Error(`Required Atlas document is missing: ${relativePath}`);
}

const remote = await readOrigin(atlasRoot);
if (remote && normalizeRepository(remote) !== normalizeRepository(manifest.repository_url)) {
  throw new Error(`Atlas origin mismatch: expected ${manifest.repository_url}, got ${remote}`);
}

let action = "create";
try {
  const existing = await lstat(installPath);
  if (!existing.isSymbolicLink()) {
    throw new Error(`Refusing to replace a real directory or file: ${installPath}`);
  }
  let installedRealPath = "";
  try {
    installedRealPath = await realpath(installPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const sourceRealPath = await realpath(skillSource);
  if (installedRealPath && samePath(installedRealPath, sourceRealPath)) action = "keep";
  else {
    action = "replace-link";
    if (!values["dry-run"]) await unlink(installPath);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (!values["dry-run"] && action !== "keep") {
  await mkdir(installParent, { recursive: true });
  const { symlink } = await import("node:fs/promises");
  await symlink(skillSource, installPath, process.platform === "win32" ? "junction" : "dir");
}

const installedTarget = values["dry-run"] ? null : await realpath(installPath);
process.stdout.write(`${JSON.stringify({
  action,
  dry_run: values["dry-run"],
  skill_version: manifest.skill_version,
  atlas_root: atlasRoot,
  install_path: installPath,
  installed_target: installedTarget,
  repository_verified: Boolean(remote)
}, null, 2)}\n`);

async function readOrigin(repositoryRoot) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repositoryRoot, "remote", "get-url", "origin"]);
    return stdout.trim();
  } catch {
    return "";
  }
}

function normalizeRepository(value) {
  return value
    .trim()
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
    .replace(/\/$/, "")
    .replace(/\.git$/i, "")
    .toLowerCase();
}

function samePath(left, right) {
  const locale = process.platform === "win32" ? "en" : undefined;
  return locale ? left.toLocaleLowerCase(locale) === right.toLocaleLowerCase(locale) : left === right;
}
