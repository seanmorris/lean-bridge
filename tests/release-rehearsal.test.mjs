import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  canonicalPackageManifestJson,
  hashCanonicalPackageManifest,
  parseCanonicalPackageManifest,
} from "../src/release/canonical-package-manifest.mjs";
import {
  parsePublicationIndex,
  rehearseRelease,
  validatePublicationIndex,
} from "../src/release/release-rehearsal.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const revision = "831ca2661cf8e38f31c94b69deb6458171e08139";

const withBundle = async operation => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-release-rehearsal-"));
  try {
    const bundle = join(scratch, "bundle");
    await buildUniversalReleaseBundle({
      projectRoot: process.cwd(),
      coreRoot: "build/lean-link-spike",
      outputRoot: bundle,
      revision,
      sourceDateEpoch: 1786261809,
    });
    return await operation({ scratch, bundle });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

const rewriteIdentity = async (directory, manifest) => {
  const manifestSha256 = hashCanonicalPackageManifest(manifest);
  await writeFile(join(directory, "canonical-package.json"), `${canonicalPackageManifestJson(manifest)}\n`);
  await writeFile(join(directory, "canonical-package.sha256"), `${manifestSha256}  canonical-package.json\n`);
  const identityPath = join(directory, "bundle-identity.json");
  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  identity.canonicalManifestSha256 = manifestSha256;
  await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
};

const enableReviewedCBindingTarget = async (bundle, destination) => {
  await cp(bundle, destination, { recursive: true });
  const manifest = structuredClone(parseCanonicalPackageManifest(
    await readFile(join(destination, "canonical-package.json"), "utf8"),
  ));
  const cArtifacts = manifest.artifacts.filter(artifact => artifact.path.startsWith("bindings/c/"));
  cArtifacts.forEach(artifact => { artifact.target = "c-bindings"; });
  manifest.targets.push({
    id: "c-bindings",
    eligible: true,
    reason: null,
    platforms: ["c11"],
    capabilities: ["external-runtime-adapter", "source-bindings", "typed-bindings"],
    entryPoints: [
      { name: "library", kind: "library", artifact: cArtifacts.find(artifact => artifact.path.endsWith("include/lean_alpha.h")).id },
      { name: "types", kind: "types", artifact: "binding-ir" },
      { name: "documentation", kind: "documentation", artifact: cArtifacts.find(artifact => artifact.path.endsWith("README.md")).id },
    ],
  });
  const mapping = manifest.packages.find(candidate => candidate.ecosystem === "c");
  mapping.target = "c-bindings";
  mapping.eligible = true;
  mapping.reason = null;
  mapping.publicArtifacts = [
    ...cArtifacts.map(artifact => artifact.id),
    "license",
    "assurance",
    "core-artifact-set",
    "sbom",
    "provenance",
  ];
  await rewriteIdentity(destination, manifest);
};

test("the source-only bundle rehearses npm and records explicit omissions", async () => withBundle(async ({ scratch, bundle }) => {
  const output = join(scratch, "release");
  const result = await rehearseRelease({ bundleRoot: bundle, outputRoot: output });
  assert.equal(result.ready, 1);
  assert.equal(result.omitted, 5);
  const indexSource = await readFile(result.index, "utf8");
  const index = parsePublicationIndex(indexSource);
  assert.equal(index.mode, "no-publish");
  assert.deepEqual(index.publication, {
    externalRegistryWrites: false,
    networkAccess: false,
    omitted: 5,
    ready: 1,
  });
  assert.deepEqual(await readdir(join(output, "packages")), ["npm"]);
  assert.deepEqual(index.packages.filter(item => item.status === "ready").map(item => item.ecosystem), ["npm"]);
  assert.deepEqual(index.packages.filter(item => item.status === "omitted").map(item => item.ecosystem), ["c", "cargo", "cpp", "pypi", "wit-wasi"]);
  const npm = index.packages.find(item => item.ecosystem === "npm");
  assert.equal(npm.archives.length, 1);
  assert.equal(npm.archives[0].sha256, (await readFile(join(output, "publication-index.intoto.json"), "utf8").then(JSON.parse)).subject.find(subject => subject.name === npm.archives[0].path).digest.sha256);
  assert.match(npm.backendPlan.path, /^packages\/npm\/npm-projection\.json$/);
  assert.equal(await readFile(join(output, "publication-index.sha256"), "utf8"), `${result.indexSha256}  publication-index.json\n`);
}));

test("one bundle identity produces deterministic npm and C rehearsal archives plus an in-toto statement", async () => withBundle(async ({ scratch, bundle }) => {
  const eligible = join(scratch, "eligible");
  await enableReviewedCBindingTarget(bundle, eligible);
  const first = await rehearseRelease({ bundleRoot: eligible, outputRoot: join(scratch, "first") });
  const second = await rehearseRelease({ bundleRoot: eligible, outputRoot: join(scratch, "second") });
  assert.equal(first.ready, 2);
  assert.equal(first.omitted, 4);
  assert.equal(first.indexSha256, second.indexSha256);
  assert.equal(first.attestationSha256, second.attestationSha256);
  assert.deepEqual(await readFile(first.index), await readFile(second.index));
  assert.deepEqual(await readFile(first.attestation), await readFile(second.attestation));

  const index = parsePublicationIndex(await readFile(first.index, "utf8"));
  const ready = index.packages.filter(item => item.status === "ready");
  assert.deepEqual(ready.map(item => item.ecosystem), ["c", "npm"]);
  assert.equal(new Set(ready.map(item => item.identity.canonicalManifestSha256)).size, 1);
  assert.equal(new Set(ready.map(item => item.identity.flakeLockSha256)).size, 1);
  assert.equal(new Set(ready.map(item => item.identity.graphLockSha256)).size, 1);
  assert.equal(new Set(ready.map(item => item.identity.bindingIrSha256)).size, 1);
  assert.equal(new Set(ready.map(item => item.identity.coreArtifactSetSha256)).size, 1);
  for (const item of ready) {
    for (const archive of item.archives) {
      const firstBytes = await readFile(join(scratch, "first", archive.path));
      const secondBytes = await readFile(join(scratch, "second", archive.path));
      assert.deepEqual(firstBytes, secondBytes, archive.path);
    }
  }
  const attestation = JSON.parse(await readFile(first.attestation, "utf8"));
  assert.equal(attestation.predicateType, index.attestation.predicateType);
  assert.equal(attestation.predicate.externalRegistryWrites, false);
  assert.equal(attestation.predicate.networkAccess, false);
  assert.equal(attestation.subject.some(subject => subject.name === "publication-index.json"), true);
  assert.equal(attestation.subject.filter(subject => subject.name.endsWith("projection.json")).length, 2);
  assert.equal(attestation.subject.filter(subject => /\.(?:tgz|tar\.gz)$/.test(subject.name)).length, 2);
}));

test("publication index validation rejects publish mode, unknown fields, and identity drift", async () => withBundle(async ({ scratch, bundle }) => {
  const result = await rehearseRelease({ bundleRoot: bundle, outputRoot: join(scratch, "release") });
  const index = parsePublicationIndex(await readFile(result.index, "utf8"));
  assert.equal(validatePublicationIndex(index), true);

  const publishEnabled = structuredClone(index);
  publishEnabled.publication.networkAccess = true;
  assert.throws(
    () => validatePublicationIndex(publishEnabled),
    error => error.code === "publish-enabled",
  );

  const extended = structuredClone(index);
  extended.registry = "npm";
  assert.throws(
    () => validatePublicationIndex(extended),
    error => error.code === "invalid-publication-index" && /fields must be closed/.test(error.message),
  );

  const drifted = structuredClone(index);
  drifted.packages.find(item => item.status === "ready").identity.flakeLockSha256 = "0".repeat(64);
  assert.throws(
    () => validatePublicationIndex(drifted),
    error => error.code === "package-identity-drift",
  );
}));
