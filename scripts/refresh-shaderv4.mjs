const SOURCE = {
  repository: "https://github.com/arkology/ShaderV",
  commit: "b99ad61d4ab8b6b7e4ed90243990afb150015f97",
  commit_date: "2026-07-18T10:18:30Z",
  audited_at: "2026-09-01T00:00:00+08:00",
  version: "Godot 4.x",
  license: "MIT",
  archived: true
};

const apiHeaders = {
  Accept: "application/vnd.github+json",
  "User-Agent": "godot-fx-atlas-source-audit"
};

const treeResponse = await fetch(
  `https://api.github.com/repos/arkology/ShaderV/git/trees/${SOURCE.commit}?recursive=1`,
  { headers: apiHeaders }
);
if (!treeResponse.ok) throw new Error(`ShaderV tree request failed: ${treeResponse.status}`);

const tree = await treeResponse.json();
const blobPaths = new Set(tree.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path));
const gdPaths = [...blobPaths]
  .filter((filePath) => filePath.startsWith("addons/shaderV/") && filePath.endsWith(".gd"))
  .sort((left, right) => left.localeCompare(right));

const nodes = [];
for (let offset = 0; offset < gdPaths.length; offset += 8) {
  const batch = gdPaths.slice(offset, offset + 8);
  nodes.push(...await Promise.all(batch.map(readNode)));
}

const manifest = {
  schema_version: 1,
  source_id: "shaderv-godot4",
  source_title: "ShaderV",
  ...SOURCE,
  license_url: `${SOURCE.repository}/blob/${SOURCE.commit}/LICENSE`,
  distribution_policy: "mit_source_reuse",
  acquisition: "GitHub tree and GDScript metadata audited at a locked commit; source reuse is permitted under the recorded MIT license.",
  node_count: nodes.length,
  effect_node_count: nodes.filter((node) => node.category !== "Tools").length,
  tool_node_count: nodes.filter((node) => node.category === "Tools").length,
  nodes
};

if (manifest.node_count !== 93) throw new Error(`Expected 93 ShaderV 4.x nodes, received ${manifest.node_count}.`);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);

async function readNode(gdPath) {
  const rawUrl = `https://raw.githubusercontent.com/arkology/ShaderV/${SOURCE.commit}/${gdPath}`;
  const response = await fetch(rawUrl, { headers: { "User-Agent": apiHeaders["User-Agent"] } });
  if (!response.ok) throw new Error(`ShaderV node request failed (${response.status}): ${gdPath}`);
  const source = await response.text();
  if (!source.includes("extends VisualShaderNodeCustom")) throw new Error(`Not a custom VisualShader node: ${gdPath}`);

  const shaderInclude = gdPath.replace(/\.gd$/, ".gdshaderinc");
  return {
    node_id: gdPath
      .replace(/^addons\/shaderV\//, "")
      .replace(/\.gd$/, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replaceAll("/", "-")
      .toLowerCase(),
    name: returnedString(source, "_get_name", true),
    category: returnedString(source, "_get_category", true),
    subcategory: returnedString(source, "_get_subcategory", false),
    description: returnedString(source, "_get_description", false),
    gd_path: gdPath,
    shader_include_path: blobPaths.has(shaderInclude) ? shaderInclude : null
  };
}

function returnedString(source, functionName, required) {
  const start = source.search(new RegExp(`^func\\s+${escapeRegExp(functionName)}\\s*\\(`, "m"));
  if (start < 0) {
    if (required) throw new Error(`Missing ${functionName}.`);
    return null;
  }
  const next = source.indexOf("\nfunc ", start + 1);
  const body = source.slice(start, next < 0 ? source.length : next);
  const triple = body.match(/return\s+"""([\s\S]*?)"""/);
  if (triple) return triple[1].trim();
  const single = body.match(/return\s+"((?:\\.|[^"\\])*)"/);
  if (single) return single[1].replaceAll("\\\"", "\"").replaceAll("\\n", "\n").trim();
  if (required) throw new Error(`Missing string return in ${functionName}.`);
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
