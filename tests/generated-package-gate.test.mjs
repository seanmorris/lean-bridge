import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import {
  GeneratedPackageGateError,
  assertGeneratedPackageGate,
  auditGeneratedPublicSurface,
  compileGeneratedPackageGate,
} from "../src/binding-ir/package-gate.mjs";

const run = promisify(execFile);
const reportPath = "poc/lean-link-spike/bindings/generated-package-gate.json";

const expectedReport = async () => JSON.parse(await readFile(reportPath, "utf8"));

test("one reviewed report locks every generated host package", async () => {
  const expected = await expectedReport();
  const actual = compileGeneratedPackageGate(alpha.bindingIr);
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.packages.map(item => item.backend), [
    "javascript",
    "python",
    "c",
    "rust",
  ]);
  assert.equal(new Set(actual.packages.map(item => item.fileSetSha256)).size, 4);
  assert.equal(Object.isFrozen(actual.packages[0].files), true);
});

test("file, export, documentation, and generator drift blocks the gate", async () => {
  const expected = await expectedReport();
  expected.packages[0].files[0].sha256 = "0".repeat(64);
  assert.throws(
    () => assertGeneratedPackageGate(alpha.bindingIr, expected),
    error =>
      error instanceof GeneratedPackageGateError &&
      error.code === "generated-package-drift" &&
      error.details.diffs.some(diff => diff.path === "report.packages.0.files.0.sha256"),
  );
});

test("the shared public-surface gate scans generated package documentation", () => {
  const files = { ...generateCBindingPackage(alpha.bindingIr) };
  files["README.md"] += "\nUse the generic dispatcher.\n";
  assert.throws(
    () => auditGeneratedPublicSurface("c", files),
    error =>
      error instanceof GeneratedPackageGateError &&
      error.code === "generic-dispatch" &&
      error.details.path === "README.md",
  );
});

test("the package gate CLI checks the reviewed report", async () => {
  const { stdout } = await run("node", [
    "scripts/binding-package-gate.mjs",
    "check",
    "poc/lean-link-spike/bindings/alpha.binding-ir.json",
    reportPath,
  ]);
  const result = JSON.parse(stdout);
  assert.equal(result.bindingIrSha256, alpha.bindingIrSha256);
  assert.deepEqual(result.packages.map(item => item.backend), [
    "javascript",
    "python",
    "c",
    "rust",
  ]);
});
