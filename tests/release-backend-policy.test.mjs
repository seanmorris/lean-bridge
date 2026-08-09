import assert from "node:assert/strict";
import test from "node:test";

import {
  packagingBackendPolicy,
  validatePackagingBackendPlan,
} from "../src/release/backend-policy.mjs";

const hash = "1".repeat(64);
const validPlan = () => ({
  schemaVersion: 1,
  backend: "npm-v1",
  ecosystem: "npm",
  bundle: { id: "poc/lean-alpha@0.0.0", manifestSha256: hash },
  compilerAccess: false,
  scriptPolicy: "disabled",
  versionSource: "canonical-manifest",
  semanticSource: "canonical-manifest",
  operations: ["select", "arrange", "copy", "render-registry-metadata", "archive", "attest"],
  commands: ["npm pack --ignore-scripts"],
  coreArtifacts: [{
    sourcePath: "artifacts/alpha.wasm",
    packagePath: "dist/alpha.wasm",
    sourceSha256: hash,
    packageSha256: hash,
  }],
});

test("compile-once policy accepts a hash-preserving registry projection", () => {
  assert.equal(packagingBackendPolicy.compilerAccess, false);
  assert.equal(packagingBackendPolicy.scriptPolicy, "disabled");
  assert.equal(validatePackagingBackendPlan(validPlan()), true);
});

test("packaging backends cannot compile, link, or regenerate semantics", () => {
  for (const operation of ["compile", "link", "regenerate-bindings", "resolve-graph"]) {
    const plan = validPlan();
    plan.operations.push(operation);
    assert.throws(
      () => validatePackagingBackendPlan(plan),
      error => error.code === "backend-operation-forbidden",
    );
  }
  for (const command of ["lean Alpha.lean", "emcc alpha.c", "/usr/bin/wasm-ld alpha.o", "cargo package"]) {
    const plan = validPlan();
    plan.commands.push(command);
    assert.throws(
      () => validatePackagingBackendPlan(plan),
      error => error.code === "backend-compiler-command",
    );
  }
});

test("canonical manifest owns package versions and binding semantics", () => {
  const versionDrift = validPlan();
  versionDrift.versionSource = "package-json";
  assert.throws(
    () => validatePackagingBackendPlan(versionDrift),
    error => error.code === "backend-version-authority",
  );
  const semanticDrift = validPlan();
  semanticDrift.semanticSource = "backend-template";
  assert.throws(
    () => validatePackagingBackendPlan(semanticDrift),
    error => error.code === "backend-semantic-authority",
  );
  const scripts = validPlan();
  scripts.scriptPolicy = "registry-default";
  assert.throws(
    () => validatePackagingBackendPlan(scripts),
    error => error.code === "backend-script-policy",
  );
});

test("a packaging backend cannot mutate or collide core artifacts", () => {
  const mutation = validPlan();
  mutation.coreArtifacts[0].packageSha256 = "2".repeat(64);
  assert.throws(
    () => validatePackagingBackendPlan(mutation),
    error => error.code === "backend-core-artifact-mutation",
  );
  const collision = validPlan();
  collision.coreArtifacts.push({
    sourcePath: "artifacts/beta.wasm",
    packagePath: "dist/alpha.wasm",
    sourceSha256: hash,
    packageSha256: hash,
  });
  assert.throws(
    () => validatePackagingBackendPlan(collision),
    error => error.code === "backend-package-path-collision",
  );
});
