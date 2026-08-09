import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";

const sha256 = source => createHash("sha256").update(source).digest("hex");

const fail = (code, message, details = {}) => {
  const error = new Error(message);
  error.name = "ReleaseGateError";
  error.code = code;
  error.details = details;
  throw error;
};

export const collectReleaseTree = async directory => {
  const files = new Map();
  const visit = async current => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) files.set(relative(directory, absolute), await readFile(absolute));
    }
  };
  await visit(directory);
  return files;
};

export const compareReleaseTrees = (left, right) => {
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  const differences = [];
  const artifacts = [];
  for (const path of paths) {
    const first = left.get(path);
    const second = right.get(path);
    const leftSha256 = first ? sha256(first) : null;
    const rightSha256 = second ? sha256(second) : null;
    if (leftSha256 !== rightSha256) {
      differences.push({ path, leftSha256, rightSha256 });
      continue;
    }
    artifacts.push({ path, bytes: first.length, sha256: leftSha256 });
  }
  return Object.freeze({ artifacts, differences });
};

export const classifyReleasePath = path => {
  const name = basename(path);
  const categories = [];
  if (path.endsWith(".php")) categories.push("php");
  if (path.endsWith(".c") || path.endsWith(".h")) categories.push("c");
  if (path.endsWith(".wasm")) categories.push("wasm");
  if (path.endsWith(".so") && !path.endsWith(".so.wasm")) categories.push("extension");
  if (path.endsWith(".json") || name.endsWith("manifest.mjs")) categories.push("manifest");
  if (path.includes("/stubs/") || path.startsWith("stubs/")) categories.push("stub");
  if (path.endsWith(".md")) categories.push("documentation");
  if (path.includes("/metadata/") || path.startsWith("metadata/") || path.includes("/lean-bridge/")) {
    categories.push("metadata");
  }
  return categories;
};

const parseHashInventory = source => source.trim().split("\n").filter(Boolean).map(line => {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  if (!match) fail("invalid-hash-inventory", `invalid SHA-256 inventory line: ${line}`);
  return { sha256: match[1], path: match[2] };
});

export const verifyReleaseInventory = async ({ directory, releaseManifestPath, hashInventoryPath, requiredCategories }) => {
  const files = await collectReleaseTree(directory);
  const release = JSON.parse(files.get(releaseManifestPath)?.toString("utf8") ?? "null");
  if (!release || !Array.isArray(release.artifacts)) {
    fail("missing-release-manifest", `release manifest is absent or invalid: ${releaseManifestPath}`);
  }
  const listedPaths = new Set();
  for (const artifact of release.artifacts) {
    const bytes = files.get(artifact.path);
    if (!bytes) fail("missing-release-artifact", `release manifest artifact is absent: ${artifact.path}`);
    const actual = sha256(bytes);
    if (actual !== artifact.sha256 || bytes.length !== artifact.bytes) {
      fail("release-artifact-hash-mismatch", `release manifest identity changed for ${artifact.path}`, {
        expected: { bytes: artifact.bytes, sha256: artifact.sha256 },
        actual: { bytes: bytes.length, sha256: actual },
      });
    }
    listedPaths.add(artifact.path);
  }
  const excluded = new Set([releaseManifestPath, hashInventoryPath]);
  const unlisted = [...files.keys()].filter(path => !excluded.has(path) && !listedPaths.has(path));
  if (unlisted.length > 0) fail("unlisted-release-artifact", "release files are absent from the release manifest", { paths: unlisted });

  const inventorySource = files.get(hashInventoryPath)?.toString("utf8");
  if (inventorySource === undefined) fail("missing-hash-inventory", `SHA-256 inventory is absent: ${hashInventoryPath}`);
  const inventory = parseHashInventory(inventorySource);
  const inventoryPaths = new Set();
  for (const artifact of inventory) {
    const bytes = files.get(artifact.path);
    if (!bytes) fail("missing-hash-artifact", `SHA-256 inventory artifact is absent: ${artifact.path}`);
    const actual = sha256(bytes);
    if (actual !== artifact.sha256) {
      fail("hash-inventory-mismatch", `SHA-256 inventory changed for ${artifact.path}`, {
        expected: artifact.sha256,
        actual,
      });
    }
    inventoryPaths.add(artifact.path);
  }
  const unhashed = [...files.keys()].filter(path => path !== hashInventoryPath && !inventoryPaths.has(path));
  if (unhashed.length > 0) fail("unhashed-release-artifact", "release files are absent from the SHA-256 inventory", { paths: unhashed });

  const coverage = Object.fromEntries(requiredCategories.map(category => [category, []]));
  for (const path of files.keys()) {
    for (const category of classifyReleasePath(path)) {
      if (coverage[category]) coverage[category].push(path);
    }
  }
  const missingCategories = Object.entries(coverage)
    .filter(([, paths]) => paths.length === 0)
    .map(([category]) => category);
  if (missingCategories.length > 0) {
    fail("release-category-gap", "release does not retain every required artifact category", { missingCategories });
  }

  return Object.freeze({
    packageId: release.packageId,
    bindingIrSha256: release.bindingIr.semanticSha256,
    artifactCount: files.size,
    totalBytes: [...files.values()].reduce((total, bytes) => total + bytes.length, 0),
    releaseManifestSha256: sha256(files.get(releaseManifestPath)),
    coverage,
  });
};
