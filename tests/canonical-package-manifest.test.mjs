import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  CanonicalPackageManifestError,
  canonicalPackageManifestJson,
  hashCanonicalPackageManifest,
  parseCanonicalPackageManifest,
  validateCanonicalPackageManifest,
} from "../src/release/canonical-package-manifest.mjs";

const fixtureSource = await readFile("poc/universal-package-fixture/canonical-package.json", "utf8");
const fixture = JSON.parse(fixtureSource);

test("canonical package schema is closed and uses draft 2020-12", async () => {
  const schema = JSON.parse(await readFile("schema/canonical-package-manifest.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.component.additionalProperties, false);
  assert.equal(schema.properties.locks.additionalProperties, false);
  assert.equal(schema.properties.provenance.additionalProperties, false);
});

test("fixture binds one component to locks, artifacts, targets, packages, assurance, and provenance", () => {
  const manifest = parseCanonicalPackageManifest(fixtureSource);
  assert.equal(manifest.component.id, "poc/lean-alpha@0.0.0");
  assert.equal(manifest.runtime.shared, true);
  assert.equal(manifest.targets.find(target => target.id === "browser").eligible, true);
  assert.equal(manifest.packages.find(item => item.ecosystem === "npm").eligible, true);
  assert.equal(manifest.packages.filter(item => item.eligible).length, 1);
  assert.equal(hashCanonicalPackageManifest(manifest), "aa39b00b770b98193a0facf31ad56718a6e5bd2761aab3c9873d5925407351ee");
});

test("fixture source, locks, metadata, documentation, and license match recorded bytes", async () => {
  for (const artifact of fixture.artifacts.filter(item => !item.core)) {
    const bytes = await readFile(artifact.path);
    assert.equal(bytes.length, artifact.bytes, artifact.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.sha256, artifact.path);
  }
});

test("canonical identity ignores object insertion order", () => {
  const reversed = Object.fromEntries(Object.entries(fixture).reverse());
  assert.equal(hashCanonicalPackageManifest(reversed), hashCanonicalPackageManifest(fixture));
  assert.equal(canonicalPackageManifestJson(reversed), canonicalPackageManifestJson(fixture));
});

test("unknown fields and missing provenance fail closed", () => {
  const unknown = structuredClone(fixture);
  unknown.packages[0].registryHint = "latest";
  assert.throws(
    () => validateCanonicalPackageManifest(unknown),
    error => error instanceof CanonicalPackageManifestError && error.code === "invalid-canonical-package-manifest",
  );
  const missing = structuredClone(fixture);
  delete missing.provenance.toolchainSha256;
  assert.throws(
    () => validateCanonicalPackageManifest(missing),
    error => error.code === "invalid-canonical-package-manifest",
  );
});

test("component, package, runtime, graph, and closure identities cannot drift", () => {
  const cases = [
    [manifest => { manifest.component.version = "0.0.1"; }, "component-version-drift"],
    [manifest => { manifest.packages[0].version = "0.0.1"; }, "package-version-drift"],
    [manifest => { manifest.runtime.profile = "side-startup"; }, "runtime-graph-profile-drift"],
    [manifest => { manifest.provenance.inputClosureSha256 = "2".repeat(64); }, "provenance-closure-drift"],
  ];
  for (const [mutate, code] of cases) {
    const manifest = structuredClone(fixture);
    mutate(manifest);
    assert.throws(() => validateCanonicalPackageManifest(manifest), error => error.code === code);
  }
});

test("target eligibility, capability, and artifact claims cannot contradict each other", () => {
  const entryPoint = structuredClone(fixture);
  entryPoint.targets[0].eligible = false;
  entryPoint.targets[0].reason = "disabled";
  assert.throws(
    () => validateCanonicalPackageManifest(entryPoint),
    error => error.code === "contradictory-target-eligibility",
  );
  const capability = structuredClone(fixture);
  capability.targets[1].capabilities.push("native-library-artifact");
  assert.throws(
    () => validateCanonicalPackageManifest(capability),
    error => error.code === "contradictory-target-capability",
  );
  const artifact = structuredClone(fixture);
  artifact.packages[0].publicArtifacts.push("lean-source");
  artifact.artifacts.find(item => item.id === "lean-source").target = "native-ffi";
  assert.throws(
    () => validateCanonicalPackageManifest(artifact),
    error => error.code === "package-target-artifact-drift",
  );
});

test("assurance claims cannot launder absent proof or trust evidence", () => {
  const proof = structuredClone(fixture);
  proof.assurance.claims[0].state = "proved";
  proof.assurance.claims[0].theorems = [];
  assert.throws(
    () => validateCanonicalPackageManifest(proof),
    error => error.code === "proof-claim-without-theorem",
  );
  const trust = structuredClone(fixture);
  trust.assurance.claims[0].assumptions = [];
  assert.throws(
    () => validateCanonicalPackageManifest(trust),
    error => error.code === "trust-claim-without-assumption",
  );
});
