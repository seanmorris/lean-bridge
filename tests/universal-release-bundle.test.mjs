import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { validatePackagingBackendPlan } from "../src/release/backend-policy.mjs";
import {
  assertCoreArtifactSetUnchanged,
  createCoreArtifactSetManifest,
} from "../src/release/core-artifact-set.mjs";
import {
  buildUniversalReleaseBundle,
  listBundleFiles,
} from "../src/release/universal-release-bundle.mjs";
import {
  hashCanonicalPackageManifest,
  parseCanonicalPackageManifest,
} from "../src/release/canonical-package-manifest.mjs";

const revision = "ee22db2b1a8ab6360c79d22f574b2bcc17bb909d";
const sha256 = value => createHash("sha256").update(value).digest("hex");

const withBundles = async operation => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-universal-bundle-"));
  try {
    const first = join(scratch, "first");
    const second = join(scratch, "second");
    const options = {
      projectRoot: process.cwd(),
      coreRoot: "build/lean-link-spike",
      revision,
      sourceDateEpoch: 1786261809,
    };
    const firstResult = await buildUniversalReleaseBundle({ ...options, outputRoot: first });
    const secondResult = await buildUniversalReleaseBundle({ ...options, outputRoot: second });
    return await operation({ first, second, firstResult, secondResult });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

test("core source boundary includes compiler inputs and excludes packaging backends", async () => {
  const boundary = JSON.parse(await readFile("nix/core-source-boundary.json", "utf8"));
  const included = path => boundary.includedFiles.includes(path) ||
    boundary.includedDirectoryPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  for (const required of [
    "scripts/build-lean-link-spike.sh",
    "poc/lean-link-spike/Alpha.lean",
    "src/abi/value-frame.mjs",
    "src/binding-ir/canonical.mjs",
    "patches/lean4-4.32.2-emscripten-runtime-signatures.patch",
  ]) assert.equal(included(required), true, required);
  for (const excluded of [
    "src/release/backend-policy.mjs",
    "src/release/universal-release-bundle.mjs",
    "src/backends/javascript/generate.mjs",
    "src/binding-ir/package-gate.mjs",
    "scripts/build-universal-release-bundle.mjs",
    "poc/lean-link-spike/bindings/php-native.package.json",
    "poc/lean-link-spike/bindings/php-wasm.package.json",
    "tests/universal-release-bundle.test.mjs",
  ]) assert.equal(included(excluded), false, excluded);
});

test("universal bundle is byte-identical across clean assembly roots", async () => withBundles(async ({ first, second, firstResult, secondResult }) => {
  assert.equal(firstResult.manifestSha256, secondResult.manifestSha256);
  assert.equal(firstResult.coreArtifactSetSha256, secondResult.coreArtifactSetSha256);
  assert.deepEqual(await listBundleFiles(first), await listBundleFiles(second));
  for (const path of await listBundleFiles(first)) {
    assert.deepEqual(await readFile(join(first, path)), await readFile(join(second, path)), path);
  }
}));

test("canonical manifest inventories every release artifact with its actual bytes", async () => withBundles(async ({ first, firstResult }) => {
  const source = await readFile(join(first, "canonical-package.json"), "utf8");
  const manifest = parseCanonicalPackageManifest(source);
  assert.equal(hashCanonicalPackageManifest(manifest), firstResult.manifestSha256);
  assert.equal(manifest.artifacts.length, firstResult.artifactCount);
  assert.equal(firstResult.artifactCount, 76);
  for (const artifact of manifest.artifacts) {
    const bytes = await readFile(join(first, artifact.path));
    assert.equal(bytes.length, artifact.bytes, artifact.path);
    assert.equal(sha256(bytes), artifact.sha256, artifact.path);
  }
  assert.deepEqual(firstResult.generatedBackends, ["c", "javascript", "php", "python", "rust"]);
  assert.equal(manifest.artifacts.some(item => item.path === "bindings/javascript/index.d.ts"), true);
  assert.equal(manifest.artifacts.some(item => item.path === "bindings/c/include/lean_alpha.h"), true);
  assert.equal(manifest.artifacts.some(item => item.path === "runtime/javascript/alpha-descriptor.json"), true);
  const npm = manifest.packages.find(item => item.ecosystem === "npm");
  assert.equal(npm.eligible, true);
  assert.equal(npm.target, "node-esm");
  assert.equal(npm.publicArtifacts.includes("javascript-library-loader"), true);
  const bundledValidator = await import(`${pathToFileURL(join(first, "validators/src/release/canonical-package-manifest.mjs")).href}?bundle-test`);
  assert.equal(bundledValidator.validateCanonicalPackageManifest(manifest), true);
}));

test("provenance and SBOM name the exact compiled core identity", async () => withBundles(async ({ first, firstResult }) => {
  const provenance = JSON.parse(await readFile(join(first, "metadata/provenance.intoto.json"), "utf8"));
  const sbom = JSON.parse(await readFile(join(first, "metadata/sbom.spdx.json"), "utf8"));
  const core = JSON.parse(await readFile(join(first, "metadata/core-artifact-set.json"), "utf8"));
  assert.equal(core.identitySha256, firstResult.coreArtifactSetSha256);
  assert.equal(provenance.predicate.runDetails.metadata.invocationId, core.identitySha256);
  assert.equal(sbom.packages[0].checksums[0].checksumValue, core.identitySha256);
  assert.deepEqual(provenance.subject.map(item => item.digest.sha256), core.files.map(item => item.sha256));
}));

test("packaging policy changes cannot mutate the compiled artifact set", async () => {
  const before = await createCoreArtifactSetManifest("build/lean-link-spike");
  const plan = {
    schemaVersion: 1,
    backend: "npm-v2",
    ecosystem: "npm",
    bundle: { id: "poc/lean-alpha@0.0.0", manifestSha256: "a".repeat(64) },
    compilerAccess: false,
    scriptPolicy: "disabled",
    versionSource: "canonical-manifest",
    semanticSource: "canonical-manifest",
    operations: ["arrange", "render-registry-metadata", "archive"],
    commands: ["tar --create package"],
    coreArtifacts: before.files.map(file => ({
      sourcePath: file.path,
      packagePath: `package/${file.path}`,
      sourceSha256: file.sha256,
      packageSha256: file.sha256,
    })),
  };
  assert.equal(validatePackagingBackendPlan(plan), true);
  const after = await createCoreArtifactSetManifest("build/lean-link-spike");
  assert.equal(assertCoreArtifactSetUnchanged(before, after), true);
});
