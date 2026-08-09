import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";

export const CORE_ARTIFACT_PATHS = Object.freeze([
  "lazy/main.mjs",
  "lazy/main.wasm",
  "lazy/alpha.so.wasm",
  "lazy/beta.so.wasm",
  "lazy/gamma.so.wasm",
]);

const sha256 = value => createHash("sha256").update(value).digest("hex");

const payloadFor = manifest => ({
  schemaVersion: manifest.schemaVersion,
  graphId: manifest.graphId,
  profile: manifest.profile,
  files: manifest.files,
});

export const createCoreArtifactSetManifest = async coreRoot => {
  const audit = JSON.parse(await readFile(join(coreRoot, "audit/artifact-manifest.json"), "utf8"));
  const files = [];
  for (const path of CORE_ARTIFACT_PATHS) {
    const absolute = join(coreRoot, path);
    const [bytes, facts] = await Promise.all([readFile(absolute), stat(absolute)]);
    files.push({
      path,
      bytes: facts.size,
      sha256: sha256(bytes),
      executable: (facts.mode & 0o111) !== 0,
    });
  }
  const payload = {
    schemaVersion: 1,
    graphId: audit.graphId,
    profile: "side-lazy",
    files,
  };
  return Object.freeze({
    ...payload,
    identitySha256: sha256(canonicalJson(payload)),
  });
};

export const validateCoreArtifactSetManifest = manifest => {
  const keys = Object.keys(manifest).sort();
  const expected = ["files", "graphId", "identitySha256", "profile", "schemaVersion"].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error("core artifact manifest fields must be closed");
  if (manifest.schemaVersion !== 1 || manifest.profile !== "side-lazy") throw new Error("unsupported core artifact manifest");
  if (!Array.isArray(manifest.files) || manifest.files.length !== CORE_ARTIFACT_PATHS.length) {
    throw new Error("core artifact manifest does not contain the required file set");
  }
  for (const [index, path] of CORE_ARTIFACT_PATHS.entries()) {
    const file = manifest.files[index];
    if (file.path !== path || !Number.isInteger(file.bytes) || file.bytes < 1) throw new Error(`invalid core artifact ${path}`);
    if (!/^[0-9a-f]{64}$/.test(file.sha256) || typeof file.executable !== "boolean") throw new Error(`invalid core identity ${path}`);
  }
  const actual = sha256(canonicalJson(payloadFor(manifest)));
  if (actual !== manifest.identitySha256) throw new Error("core artifact set identity does not match its files");
  return true;
};

export const assertCoreArtifactSetUnchanged = (before, after) => {
  validateCoreArtifactSetManifest(before);
  validateCoreArtifactSetManifest(after);
  if (before.identitySha256 !== after.identitySha256 || canonicalJson(before.files) !== canonicalJson(after.files)) {
    throw new Error("packaging changed the compiled core artifact set");
  }
  return true;
};
