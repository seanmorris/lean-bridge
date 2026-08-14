/**
 * Tests the performance lifecycle behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runLifecycleStabilitySuite } from "../src/performance/lifecycle.mjs";

test("the lifecycle result schema closes the report envelope", async () => {
  const schema = JSON.parse(await readFile(
    "schema/performance-lifecycle-result.schema.json",
    "utf8",
  ));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.properties.kind.const, "lean-bridge-lifecycle-stability-suite");
});

test("lifecycle rounds return every registry to its defined baseline", async () => {
  const result = await runLifecycleStabilitySuite({
    rounds: 2
    , resourcesPerRound: 8
    , closuresPerRound: 3
    , callbacksPerRound: 4
    , copiedValuesPerRound: 3
    , pendingPerRound: 3
    , iteratorItemsPerRound: 5
    , collectHostGarbage: false
  });

  assert.equal(result.correctness.accepted, true);
  assert.deepEqual(result.lifecycle.highWater, {
    resources: 8
    , nativeClosures: 3
    , pendingOperations: 3
    , iterators: 1
    , callbacks: 2
    , callbackDepth: 2
  });
  assert.deepEqual(result.lifecycle.retained, {
    resources: 0
    , hostValues: 0
    , nativeClosures: 0
    , callbacks: 0
    , pendingOperations: 0
    , iterators: 0
  });
  for(const round of result.lifecycle.rounds)
{
    assert.equal(Object.values(round.liveAfter).every(value => value === 0), true);
    assert.equal(round.staleWrapperError, "resource-disposed");
    assert.equal(round.wasmMemoryBytes, result.memory.stableWasmBytesAfterWarmup);
}
  assert.equal(result.memory.retained.wasmMemoryBytes, 0);
});

test("lifecycle validation rejects finalizer, runtime, generation, and shutdown drift", async () => {
  const result = await runLifecycleStabilitySuite({
    rounds: 1
    , resourcesPerRound: 2
    , closuresPerRound: 1
    , callbacksPerRound: 1
    , copiedValuesPerRound: 1
    , pendingPerRound: 1
    , iteratorItemsPerRound: 2
    , collectHostGarbage: false
  });

  assert.deepEqual(result.lifecycle.delayedFinalization, {
    nativeResourcesBeforeSafeEntry: 1
    , nativeResourcesAfterSafeEntry: 0
    , finalizedLeases: 1
    , retainedResources: 0
  });
  assert.deepEqual(result.lifecycle.crossRuntime, {
    checked: true
    , errorCode: "cross-runtime-handle"
  });
  assert.deepEqual(result.lifecycle.shutdownWithLiveOwnership, {
    liveBeforeShutdown: 1
    , liveAfterShutdown: 0
    , shutdownAccepted: true
    , expiredWrapperCode: "runtime-shut-down"
  });
});

test("the lifecycle benchmark consumer cannot reach private bridge calls", async () => {
  const client = await readFile("scripts/benchmark-lifecycle-stability.mjs", "utf8");
  const harness = await readFile("src/performance/lifecycle.mjs", "utf8");
  for(const source of [client, harness])
{
    assert.doesNotMatch(
      source,
      /\bccall\b|\bcwrap\b|_bridge_|generic\s+(?:invoke|dispatch)|numeric handle/i,
    );
}
  assert.match(harness, /new api\.Box\(/);
  assert.match(harness, /api\.roundTrip\(/);
  assert.match(harness, /api\.withCallback\(/);
  assert.match(harness, /api\.deferBoxValue\(/);
  assert.match(harness, /api\.sequence\(/);
});
