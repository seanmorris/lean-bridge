import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { canonicalJson } from "../src/capsule/node.mjs";
import {
  classifyReleasePath,
  collectReleaseInventory,
  collectReleaseTree,
  compareReleaseInventories,
  compareReleaseTrees,
  verifyReleaseInventory,
} from "../src/release/reproducibility.mjs";
import {
  prepareCleanGitSources,
  ReproducibilityGateError,
  runReproducibilityGate,
  verifyReleaseAuthorization,
} from "../src/release/reproducibility-gate.mjs";
import {
  verifyPublishManifest,
  writePublishManifest,
} from "../src/release/publish-manifest.mjs";
import { rehearseRelease } from "../src/release/release-rehearsal.mjs";
import { buildUniversalReleaseBundle } from "../src/release/universal-release-bundle.mjs";

const execute = promisify(execFile);

const sha256 = async path => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(await readFile(path)).digest("hex");
};

test("release tree comparison identifies missing and changed artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-release-tree-"));
  try {
    const left = join(root, "left");
    const right = join(root, "right");
    await Promise.all([mkdir(left), mkdir(right)]);
    await Promise.all([
      writeFile(join(left, "same.php"), "<?php\n"),
      writeFile(join(right, "same.php"), "<?php\n"),
      writeFile(join(left, "changed.c"), "left\n"),
      writeFile(join(right, "changed.c"), "right\n"),
      writeFile(join(left, "missing.md"), "left only\n"),
    ]);
    const comparison = compareReleaseTrees(
      await collectReleaseTree(left),
      await collectReleaseTree(right),
    );
    assert.deepEqual(comparison.artifacts.map(artifact => artifact.path), ["same.php"]);
    assert.deepEqual(comparison.differences.map(artifact => artifact.path), ["changed.c", "missing.md"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release path classification covers retained source and package artifacts", () => {
  assert.deepEqual(classifyReleasePath("composer/stubs/alpha.php"), ["php", "stub"]);
  assert.deepEqual(classifyReleasePath("metadata/sources/runtime.c"), ["c", "metadata"]);
  assert.deepEqual(classifyReleasePath("lib/alpha.so.wasm"), ["wasm"]);
  assert.deepEqual(classifyReleasePath("lib/php8.4-alpha.so"), ["extension"]);
  assert.deepEqual(classifyReleasePath("metadata/release-manifest.json"), ["manifest", "metadata"]);
  assert.deepEqual(classifyReleasePath("README.md"), ["documentation"]);
});

test("release inventory rejects an artifact hash mismatch", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-release-inventory-"));
  try {
    await mkdir(join(root, "metadata"));
    await writeFile(join(root, "payload.php"), "<?php\n");
    const payloadHash = await sha256(join(root, "payload.php"));
    const release = {
      packageId: "fixture@0",
      bindingIr: { semanticSha256: "1".repeat(64) },
      artifacts: [{ path: "payload.php", bytes: 6, sha256: payloadHash }],
    };
    await writeFile(join(root, "metadata/release.json"), `${JSON.stringify(release)}\n`);
    const releaseHash = await sha256(join(root, "metadata/release.json"));
    await writeFile(join(root, "metadata/sha256.txt"), `${payloadHash}  payload.php\n${releaseHash}  metadata/release.json\n`);
    await writeFile(join(root, "payload.php"), "changed\n");
    await assert.rejects(
      verifyReleaseInventory({
        directory: root,
        releaseManifestPath: "metadata/release.json",
        hashInventoryPath: "metadata/sha256.txt",
        requiredCategories: ["php"],
      }),
      error => error.code === "release-artifact-hash-mismatch",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release inventory comparison reports modes and bounded text diagnostics", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-release-mode-"));
  try {
    const left = join(root, "left");
    const right = join(root, "right");
    await Promise.all([mkdir(left), mkdir(right)]);
    await Promise.all([
      writeFile(join(left, "manifest.json"), `${JSON.stringify({ createdAt: "2026-08-09T00:00:00Z", value: 1 })}\n`, { mode: 0o644 }),
      writeFile(join(right, "manifest.json"), `${JSON.stringify({ createdAt: "2026-08-10T00:00:00Z", value: 1 })}\n`, { mode: 0o644 }),
      writeFile(join(left, "runner.sh"), "exit 0\n", { mode: 0o644 }),
      writeFile(join(right, "runner.sh"), "exit 0\n", { mode: 0o755 }),
      writeFile(join(left, "ordered.json"), "{\"b\":1,\"a\":2}\n"),
      writeFile(join(right, "ordered.json"), "{\"a\":2,\"b\":1}\n"),
      writeFile(join(left, "diagnostic.txt"), "LANG=en_US build=123e4567-e89b-12d3-a456-426614174000 /tmp/a https://example.invalid/latest\n"),
      writeFile(join(right, "diagnostic.txt"), "LANG=C build=123e4567-e89b-12d3-a456-426614174001 /workspace/b https://example.invalid/main\n"),
      writeFile(join(left, "package.tgz"), Buffer.from([1, 2, 3])),
      writeFile(join(right, "package.tgz"), Buffer.from([1, 2, 4])),
      writeFile(join(left, "module.wasm"), Buffer.from([0, 97, 115, 109, 1])),
      writeFile(join(right, "module.wasm"), Buffer.from([0, 97, 115, 109, 2])),
    ]);
    const comparison = compareReleaseInventories(
      await collectReleaseInventory(left),
      await collectReleaseInventory(right),
      { previewBytes: 80 },
    );
    assert.deepEqual(comparison.differences.map(item => [item.path, item.kind]), [
      ["diagnostic.txt", "content"],
      ["manifest.json", "content"],
      ["module.wasm", "content"],
      ["ordered.json", "content"],
      ["package.tgz", "content"],
      ["runner.sh", "mode"],
    ]);
    const byPath = new Map(comparison.differences.map(item => [item.path, item]));
    assert.deepEqual(byPath.get("diagnostic.txt").likelyEntropyCategories, [
      "absolute-path", "locale-or-timezone", "possibly-unpinned-input", "random-identifier",
    ]);
    assert.equal(byPath.get("manifest.json").preview.kind, "json");
    assert.deepEqual(byPath.get("manifest.json").likelyEntropyCategories, ["timestamp"]);
    assert.deepEqual(byPath.get("ordered.json").likelyEntropyCategories, ["serialization-order"]);
    assert.deepEqual(byPath.get("package.tgz").likelyEntropyCategories, ["archive-or-compression-metadata"]);
    assert.deepEqual(byPath.get("module.wasm").likelyEntropyCategories, ["compiler-build-id-or-toolchain"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source preparation creates two independent clean clones of one commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-clean-source-"));
  const repository = join(root, "repository");
  const scratch = join(root, "scratch");
  try {
    await Promise.all([mkdir(repository), mkdir(scratch)]);
    await Promise.all([
      writeFile(join(repository, "flake.lock"), "{}\n"),
      writeFile(join(repository, "Main.lean"), "def answer := 42\n"),
    ]);
    await execute("git", ["init", "--quiet"], { cwd: repository });
    await execute("git", ["add", "."], { cwd: repository });
    await execute("git", [
      "-c", "user.name=Lean Bridge",
      "-c", "user.email=bridge@example.invalid",
      "commit", "--quiet", "-m", "fixture",
    ], { cwd: repository });
    const prepared = await prepareCleanGitSources({ projectRoot: repository, scratchRoot: scratch });
    assert.equal(prepared.roots.length, 2);
    assert.notEqual(prepared.roots[0], prepared.roots[1]);
    assert.match(prepared.source.revision, /^[0-9a-f]{40}$/);
    assert.equal((await execute("git", ["status", "--porcelain"], { cwd: prepared.roots[0] })).stdout, "");

    await writeFile(join(repository, "Main.lean"), "def answer := 43\n");
    await assert.rejects(
      prepareCleanGitSources({ projectRoot: repository, scratchRoot: join(root, "dirty-scratch") }),
      error => error.code === "source-tree-dirty",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const fixtureGate = async ({ outputRoot, mutateSecond = null, inspectIsolation = false }) => {
  const revision = "1".repeat(40);
  const flakeLockSha256 = createHash("sha256").update(await readFile("flake.lock")).digest("hex");
  let buildNumber = 0;
  const seen = [];
  const build = async ({ projectRoot, outputRoot: buildRoot, environment }) => {
    buildNumber += 1;
    seen.push({ projectRoot, buildRoot, store: environment.LEAN_BRIDGE_NIX_STORE });
    if (inspectIsolation && buildNumber === 1) {
      await mkdir(environment.LEAN_BRIDGE_NIX_STORE);
      await writeFile(join(environment.LEAN_BRIDGE_NIX_STORE, "first-build-marker"), "first\n");
    }
    if (inspectIsolation && buildNumber === 2) {
      assert.notEqual(seen[0].projectRoot, projectRoot);
      assert.notEqual(seen[0].buildRoot, buildRoot);
      assert.notEqual(seen[0].store, environment.LEAN_BRIDGE_NIX_STORE);
      await assert.rejects(access(join(projectRoot, "first-source-marker"), constants.F_OK), error => error.code === "ENOENT");
      await assert.rejects(access(join(environment.LEAN_BRIDGE_NIX_STORE, "first-build-marker"), constants.F_OK), error => error.code === "ENOENT");
    }
    await buildUniversalReleaseBundle({
      projectRoot: process.cwd(),
      coreRoot: "build/lean-link-spike",
      outputRoot: join(buildRoot, "bundle"),
      revision,
      sourceDateEpoch: 1786261809,
      builder: "reproducibility-test-double",
    });
    await rehearseRelease({
      bundleRoot: join(buildRoot, "bundle"),
      outputRoot: join(buildRoot, "packages"),
    });
    await writeFile(join(buildRoot, "build-report.json"), canonicalJson({
      schemaVersion: 1,
      backend: "docker-nix",
      builder: "test-double",
      bundleStorePath: `/nix/store/build-${buildNumber}`,
      packagesStorePath: `/nix/store/packages-${buildNumber}`,
      bundlePath: "bundle",
      packagesPath: "packages",
      flakeOutputs: ["universal-release-bundle", "release-rehearsal"],
      sourceReadOnly: true,
      componentBinariesRebuiltByProjection: false,
    }));
    if (buildNumber === 2 && mutateSecond !== null) await mutateSecond(buildRoot);
    const publication = JSON.parse(await readFile(join(buildRoot, "packages", "publication-index.json"), "utf8"));
    return {
      backend: "docker",
      backendVersion: "24.0.9",
      builderDefinitionSha256: "a".repeat(64),
      bundle: { coreArtifactSetSha256: publication.bundle.coreArtifactSetSha256 },
    };
  };
  let tick = Date.parse("2026-08-09T00:00:00Z");
  return runReproducibilityGate({
    projectRoot: process.cwd(),
    outputRoot,
    build,
    sourcePreparer: async ({ scratchRoot }) => {
      if (!inspectIsolation) return {
        roots: [process.cwd(), process.cwd()],
        source: {
          repository: "https://github.com/seanmorris/lean-bridge",
          projectPath: ".",
          revision,
          tree: "2".repeat(40),
          flakeLockSha256,
        },
      };
      const roots = [join(scratchRoot, "fixture-source-a"), join(scratchRoot, "fixture-source-b")];
      await Promise.all(roots.map(root => mkdir(root)));
      await writeFile(join(roots[0], "first-source-marker"), "first\n");
      return {
        roots,
        source: {
          repository: "https://github.com/seanmorris/lean-bridge",
          projectPath: ".",
          revision,
          tree: "2".repeat(40),
          flakeLockSha256,
        },
      };
    },
    analyze: async () => ({
      bindingIr: { semanticSha256: "9".repeat(64) },
      adapterHints: [],
    }),
    now: () => {
      tick += 10;
      return tick;
    },
  });
};

test("build B cannot inherit build A source, output, or writable store markers", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-release-isolation-"));
  try {
    const result = await fixtureGate({ outputRoot: join(scratch, "gate"), inspectIsolation: true });
    assert.equal(result.result, "passed");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("two clean candidate builds produce one content-addressed release authorization", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-release-authorization-"));
  const output = join(scratch, "gate");
  try {
    const result = await fixtureGate({ outputRoot: output });
    assert.equal(result.result, "passed");
    assert.equal(result.externalRegistryWrites, false);
    const report = JSON.parse(await readFile(result.report, "utf8"));
    assert.equal(report.builds.length, 2);
    assert.equal(report.differences.length, 0);
    assert.ok(report.artifacts.some(item => item.path === "bundle/canonical-package.json"));
    assert.ok(report.artifacts.some(item => item.path === "packages/publication-index.json"));
    const verified = await verifyReleaseAuthorization({
      authorizationRoot: output,
      candidateRoot: join(output, "release"),
    });
    assert.equal(verified.status, "authorized");
    assert.equal(verified.candidate.id, result.candidate.id);

    await writeFile(join(output, "release", "packages", "publication-index.json"), "{}\n");
    await assert.rejects(
      verifyReleaseAuthorization({ authorizationRoot: output, candidateRoot: join(output, "release") }),
      error => error.code === "authorized-candidate-drift",
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("dry run derives one credential-free manifest that execute mode can verify", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-publish-manifest-"));
  const output = join(scratch, "gate");
  try {
    await fixtureGate({ outputRoot: output });
    const written = await writePublishManifest({ gateRoot: output, requestedTargets: ["npm"] });
    assert.equal(written.path, join(output, "publish-manifest.json"));
    assert.match(written.manifestSha256, /^[0-9a-f]{64}$/);
    assert.equal(written.manifest.mode, "authorized-no-publish");
    assert.deepEqual(written.manifest.selection, {
      allTargets: false,
      requested: ["npm"],
      plannedEcosystems: ["npm"],
    });
    assert.equal(written.manifest.policy.networkAccessPerformed, false);
    assert.equal(written.manifest.policy.externalRegistryWritesPerformed, false);
    assert.equal(written.manifest.policy.credentialsRead, false);
    assert.deepEqual(written.manifest.targets.map(item => [
      item.order,
      item.ecosystem,
      item.operation,
      item.destination.kind,
      item.credentialEnvironment,
    ]), [[1, "npm", "publish", "npm", ["NPM_TOKEN"]]]);
    assert.match(written.manifest.targets[0].idempotencyKey, /^[0-9a-f]{64}$/);
    assert.equal("credentials" in written.manifest.targets[0], false);

    const verified = await verifyPublishManifest({
      manifestPath: written.path,
      requestedTargets: ["npm"],
    });
    assert.equal(verified.manifestSha256, written.manifestSha256);
    assert.equal(verified.authorization.candidate.id, written.manifest.authorization.candidateId);

    await assert.rejects(
      verifyPublishManifest({ manifestPath: written.path, requestedTargets: ["cargo"] }),
      error => error.code === "publish-selection-drift",
    );
    await assert.rejects(
      writePublishManifest({ gateRoot: output, requestedTargets: ["npm"] }),
      error => error.code === "publish-manifest-exists",
    );

    await writeFile(written.path, `${await readFile(written.path, "utf8")}\n`);
    await assert.rejects(
      verifyPublishManifest({ manifestPath: written.path }),
      error => error.code === "publish-manifest-hash-drift",
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("one generated byte difference blocks authorization and retains both reports", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-release-failure-"));
  const output = join(scratch, "gate");
  try {
    await assert.rejects(
      fixtureGate({
        outputRoot: output,
        mutateSecond: buildRoot => writeFile(join(buildRoot, "packages", "entropy.txt"), "2026-08-10T00:00:00Z /tmp/build-b\n"),
      }),
      error => error instanceof ReproducibilityGateError && error.code === "release-not-reproducible",
    );
    const report = JSON.parse(await readFile(join(output, "evidence", "reproducibility.json"), "utf8"));
    assert.equal(report.result, "failed");
    assert.equal(report.differences[0].path, "packages/entropy.txt");
    assert.equal(report.failure.code, "release-not-reproducible");
    assert.match(await readFile(join(output, "evidence", "reproducibility.md"), "utf8"), /No release candidate was authorized|Result: \*\*failed\*\*/);
    await assert.rejects(readFile(join(output, "release-authorization.json")), error => error.code === "ENOENT");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("reproducibility, authorization, and publish manifest schemas close every published field", async () => {
  const [report, authorization, manifest] = await Promise.all([
    readFile("schema/reproducibility-report.schema.json", "utf8").then(JSON.parse),
    readFile("schema/release-authorization.schema.json", "utf8").then(JSON.parse),
    readFile("schema/publish-manifest.schema.json", "utf8").then(JSON.parse),
  ]);
  assert.equal(report.additionalProperties, false);
  assert.equal(report.$defs.artifact.additionalProperties, false);
  assert.equal(report.$defs.difference.additionalProperties, false);
  assert.equal(authorization.additionalProperties, false);
  assert.equal(authorization.properties.evidence.additionalProperties, false);
  assert.equal(manifest.additionalProperties, false);
  assert.equal(manifest.properties.authorization.additionalProperties, false);
  assert.equal(manifest.$defs.target.additionalProperties, false);
});
