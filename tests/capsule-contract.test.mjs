import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CapsuleContractError,
  resolveLockedGraph,
  validateCapsule,
} from "../src/capsule/contract.mjs";

const lock = JSON.parse(
  await readFile("poc/lean-link-spike/graph-lock.json", "utf8"),
);
const capsules = await Promise.all(
  lock.libraries.map(async library =>
    JSON.parse(
      await readFile(`poc/lean-link-spike/${library.capsule.path}`, "utf8"),
    ),
  ),
);
const digests = new Map(
  await Promise.all(
    lock.libraries.map(async library => [
      library.id,
      createHash("sha256")
        .update(await readFile(`poc/lean-link-spike/${library.capsule.path}`))
        .digest("hex"),
    ]),
  ),
);

const clone = value => structuredClone(value);
const resolve = ({
  candidateLock = lock,
  candidateCapsules = capsules,
  capsuleDigests = digests,
  profile = "side-lazy",
  roots,
} = {}) =>
  resolveLockedGraph({
    lock: candidateLock,
    capsules: candidateCapsules,
    capsuleDigests,
    profile,
    roots,
  });

const contractError = (operation, code) => {
  assert.throws(operation, error => {
    assert.equal(error instanceof CapsuleContractError, true);
    assert.equal(error.code, code);
    return true;
  });
};

test("resolver is dependency-first and stable across capsule input order", () => {
  const forward = resolve();
  const reverse = resolve({ candidateCapsules: [...capsules].reverse() });
  assert.deepEqual(forward.order, [
    "poc/lean-alpha@0.0.0",
    "poc/lean-beta@0.0.0",
    "poc/lean-gamma@0.0.0",
  ]);
  assert.deepEqual(reverse.order, forward.order);
});

test("resolver selects only the requested transitive closure", () => {
  const alpha = lock.libraries[0];
  const graph = resolve({
    roots: [{ id: alpha.id, sha256: alpha.capsule.sha256 }],
  });
  assert.deepEqual(graph.order, ["poc/lean-alpha@0.0.0"]);
});

test("capsule schema rejects undeclared fields", () => {
  const candidate = clone(capsules[0]);
  candidate.privateRuntimeEscapeHatch = true;
  contractError(() => validateCapsule(candidate), "unknown-property");
});

test("resolver rejects capsule integrity drift before composition", () => {
  const candidateDigests = new Map(digests);
  candidateDigests.set(lock.libraries[0].id, "0".repeat(64));
  contractError(() => resolve({ capsuleDigests: candidateDigests }), "integrity-mismatch");
});

test("resolver rejects a package built for another shared runtime", () => {
  const candidateCapsules = clone(capsules);
  candidateCapsules[1].runtime.leanCommit = "0".repeat(40);
  contractError(
    () => resolve({ candidateCapsules, capsuleDigests: null }),
    "runtime-conflict",
  );
});

test("resolver rejects conflicting dependency content identities", () => {
  const candidateLock = clone(lock);
  candidateLock.libraries[1].dependencies[0].sha256 = "0".repeat(64);
  contractError(
    () => resolve({ candidateLock, capsuleDigests: null }),
    "dependency-integrity-conflict",
  );
});

test("resolver rejects duplicate library symbols", () => {
  const candidateCapsules = clone(capsules);
  candidateCapsules[2].symbols.exports.push("lean_link_alpha_read");
  contractError(
    () => resolve({ candidateCapsules, capsuleDigests: null }),
    "symbol-conflict",
  );
});

test("resolver rejects duplicate initializer symbols", () => {
  const candidateCapsules = clone(capsules);
  candidateCapsules[1].initializer = {
    mode: "required",
    symbol: "initialize_Alpha",
  };
  contractError(
    () => resolve({ candidateCapsules, capsuleDigests: null }),
    "initializer-conflict",
  );
});

test("resolver rejects unresolved package symbols", () => {
  const candidateCapsules = clone(capsules);
  candidateCapsules[2].symbols.requires.push("lean_link_missing");
  contractError(
    () => resolve({ candidateCapsules, capsuleDigests: null }),
    "unresolved-symbol",
  );
});

test("resolver reports the complete dependency cycle", () => {
  const candidateLock = clone(lock);
  const candidateCapsules = clone(capsules);
  candidateLock.libraries[0].dependencies.push({
    id: candidateLock.libraries[2].id,
    sha256: candidateLock.libraries[2].capsule.sha256,
  });
  candidateCapsules[0].dependencies.push({ id: candidateLock.libraries[2].id });
  assert.throws(
    () => resolve({ candidateLock, candidateCapsules, capsuleDigests: null }),
    error => {
      assert.equal(error.code, "dependency-cycle");
      assert.deepEqual(error.details.cycle, [
        "poc/lean-gamma@0.0.0",
        "poc/lean-beta@0.0.0",
        "poc/lean-alpha@0.0.0",
        "poc/lean-gamma@0.0.0",
      ]);
      return true;
    },
  );
});

test("capsule and graph-lock JSON schemas are valid JSON documents", async () => {
  for (const path of [
    "schema/library-capsule.schema.json",
    "schema/library-graph-lock.schema.json",
  ]) {
    const schema = JSON.parse(await readFile(path, "utf8"));
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.additionalProperties, false);
  }
});
