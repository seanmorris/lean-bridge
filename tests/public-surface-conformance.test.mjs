import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { compileGeneratedPackageGate } from "../src/binding-ir/package-gate.mjs";

const consumerFixtures = Object.freeze([
  "tests/link-spike.test.mjs",
  "tests/lean-link-spike.test.mjs",
  "tests/lean-link-profiles.test.mjs",
  "tests/lean-final-static.test.mjs",
]);

const publicCodePattern = /\b(?:ccall|cwrap)\b|_bridge_|_Lean|\bWebAssembly\b|\bgeneric\s+(?:invoke|dispatch)\b|\bownershipFlag\b|\bcreateLibrarySurface\b|\bcompileJavaScriptProjection\b/;

const codeFences = source => {
  const blocks = [];
  const pattern = /^```[^\n]*\n([\s\S]*?)^```\s*$/gm;
  for (const match of source.matchAll(pattern)) blocks.push(match[1]);
  return blocks;
};

test("consumer fixtures, examples, and generated packages expose only native APIs", async () => {
  for (const path of consumerFixtures) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, publicCodePattern, path);
  }

  const documentation = [
    "README.md",
    "docs/architecture/native-bindings.md",
    "docs/evidence/lean-runtime-link-spike.md",
  ];
  for (const path of documentation) {
    const source = await readFile(path, "utf8");
    for (const block of codeFences(source)) {
      assert.doesNotMatch(block, publicCodePattern, `${path} code example`);
    }
  }

  const report = compileGeneratedPackageGate(alpha.bindingIr);
  assert.deepEqual(report.packages.map(item => item.backend), [
    "javascript",
    "php",
    "python",
    "c",
    "rust",
  ]);
});
