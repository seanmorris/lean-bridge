import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  classifyReleasePath,
  collectReleaseTree,
  compareReleaseTrees,
  verifyReleaseInventory,
} from "../src/release/reproducibility.mjs";

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
