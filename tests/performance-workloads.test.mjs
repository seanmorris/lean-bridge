import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	PerformanceWorkloadError,
	hashPerformanceWorkloadManifest,
	materializePerformanceTier,
	materializePerformanceWorkload,
	validatePerformanceWorkloads,
} from "../src/performance/workloads.mjs";

const manifest = JSON.parse(await readFile("poc/performance/workloads.v1.json", "utf8"));

test("the workload schema is closed and uses draft 2020-12", async () => {
  const schema = JSON.parse(await readFile("schema/performance-workloads.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.workload.additionalProperties, false);
  assert.equal(validatePerformanceWorkloads(manifest), manifest);
});

test("browser and extended tiers materialize from stable seeds and generators", () => {
  const browser = materializePerformanceTier(manifest, "browser-safe");
  const extended = materializePerformanceTier(manifest, "extended-node");
  assert.equal(browser.length, 2);
  assert.equal(extended.length, 2);
  assert.deepEqual(
    [...browser, ...extended].map(workload => workload.identity.generator),
    Array(4).fill(manifest.generator),
  );
  assert.deepEqual(
    [...browser, ...extended].map(workload => workload.identity.license),
    Array(4).fill("CC0-1.0"),
  );
});

test("every generated trace matches its reviewed content and result digests", () => {
  for(const specification of manifest.workloads)
{
    const first = materializePerformanceWorkload(manifest, specification);
    const second = materializePerformanceWorkload(manifest, specification);
    assert.equal(first.contentSha256, specification.expected.contentSha256);
    assert.equal(first.resultSha256, specification.expected.resultSha256);
    assert.equal(first.trace.length, specification.expected.operationCount);
    assert.deepEqual(first.initialPoints, second.initialPoints);
    assert.deepEqual(first.trace, second.trace);
    assert.deepEqual(first.expectedResults, second.expectedResults);
}
});

test("workloads cover dimensions, scales, distributions, locality, hits, duplicates, and updates", () => {
  assert.deepEqual(new Set(manifest.workloads.map(workload => workload.dimensions)), new Set([2, 4, 8]));
  assert.deepEqual(
    new Set(manifest.workloads.map(workload => workload.scale)),
    new Set(["small", "medium", "large", "adversarial"]),
  );
  assert.deepEqual(
    new Set(manifest.workloads.map(workload => workload.distribution.kind)),
    new Set(["clustered", "uniform", "diagonal-degenerate"]),
  );
  for(const workload of manifest.workloads)
{
    assert.ok(workload.queryProfile.keyLocality > 0);
    assert.ok(workload.queryProfile.hitRatio > 0 && workload.queryProfile.hitRatio < 1);
    assert.ok(workload.distribution.duplicateCoordinateRate > 0);
    assert.ok(workload.operations.insert > 0);
    assert.ok(workload.operations.consumerRangeChecksum > 0);
}
});

test("each trace includes setup, warmup, mixed measurement, cross-library handoff, and cleanup", () => {
  for(const specification of manifest.workloads)
{
    const workload = materializePerformanceWorkload(manifest, specification);
    assert.deepEqual(workload.trace[0], {
      sequence: 0
      , phase: "setup"
      , call: "build"
      , arguments: {}
    });
    assert.equal(workload.trace.at(-1).call, "dispose");
    assert.ok(workload.trace.some(step => step.phase === "warmup"));
    assert.ok(workload.trace.some(step => step.call === "insert"));
    assert.ok(workload.trace.some(step => step.call === "consumerRangeChecksum"));
    assert.equal(workload.expectedResults.at(-1).result.released, true);
}
});

test("manifest and generated drift fail closed", () => {
  const changed = structuredClone(manifest);
  changed.workloads[0].seed += 1;
  assert.throws(
    () => materializePerformanceWorkload(changed, changed.workloads[0]),
    error => error instanceof PerformanceWorkloadError && error.code === "content-drift",
  );

  const unknown = structuredClone(manifest);
  unknown.workloads[0].shortcut = true;
  assert.throws(
    () => validatePerformanceWorkloads(unknown),
    error => error instanceof PerformanceWorkloadError && error.code === "closed-contract",
  );
  assert.match(hashPerformanceWorkloadManifest(manifest), shaPattern);
});

const shaPattern = /^[0-9a-f]{64}$/;
