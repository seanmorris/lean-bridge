import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { performanceProfiles, runPerformanceSuite } from "../src/performance/harness.mjs";

const manifest = JSON.parse(await readFile("poc/performance/workloads.v1.json", "utf8"));

test("the performance result schema closes the versioned report envelope", async () => {
  const schema = JSON.parse(await readFile("schema/performance-result.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.run.additionalProperties, false);
  assert.deepEqual(performanceProfiles, ["lazy", "startup", "final-static", "islands"]);
});

test("one harness runs identical native-API work across every composition profile", async () => {
  const result = await runPerformanceSuite({
    manifest
    , workload: "interactive-clustered-2d"
    , profiles: performanceProfiles
  });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.kind, "lean-bridge-performance-suite");
  assert.equal(result.runs.length, 4);

  const expected = manifest.workloads[0].expected;
  for(const run of result.runs)
{
    assert.equal(run.correctness.accepted, true);
    assert.equal(run.correctness.checkedOperations, expected.operationCount);
    assert.equal(run.correctness.resultSha256, expected.resultSha256);
    assert.equal(run.workload.contentSha256, expected.contentSha256);
    assert.equal(run.composition.shutdown.every(Boolean), true);
    assert.equal(
      run.composition.diagnosticsBeforeShutdown.every(item => item.liveResources === 0),
      true,
    );
    for(const name of ["lowerBound", "nearest", "range", "insert", "consumerRangeChecksum"])
{
      assert.ok(run.timing.operations[name].samples > 0);
      assert.ok(run.timing.operations[name].medianNs >= 0);
}
}
  assert.deepEqual(result.runs.map(run => run.profile), performanceProfiles);
  assert.deepEqual(result.runs.map(run => run.composition.runtimeInstances), [1, 1, 1, 3]);
  assert.ok(result.runs[3].memory.initialWasmBytes >= result.runs[0].memory.initialWasmBytes * 3);
});

test("the benchmark client contains no raw bridge or generic dispatch path", async () => {
  const client = await readFile("scripts/benchmark-spatial-runtime.mjs", "utf8");
  const harness = await readFile("src/performance/harness.mjs", "utf8");
  for(const source of [client, harness])
{
    assert.doesNotMatch(source, /\bccall\b|\bcwrap\b|_bridge_|generic\s+(?:invoke|dispatch)|numeric handle/i);
}
  assert.match(harness, /\.lowerBound\(/);
  assert.match(harness, /new spatial\.SpatialIndex\(/);
  assert.match(harness, /consumer\.rangeChecksum\(/);
});
