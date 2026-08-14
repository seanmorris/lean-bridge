/**
 * Tests the performance overhead behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	overheadBindingIrSha256,
	overheadDescriptor,
} from "../src/performance/overhead-fixture.mjs";
import { runNativeOverheadSuite } from "../src/performance/overhead.mjs";

test("the native overhead result schema closes the report envelope", async () => {
  const schema = JSON.parse(await readFile(
    "schema/performance-overhead-result.schema.json",
    "utf8",
  ));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.properties.kind.const, "lean-bridge-native-overhead-suite");
});

test("the overhead fixture extends Binding IR with ordinary async and iterator functions", () => {
  assert.match(overheadBindingIrSha256, /^[a-f0-9]{64}$/);
  assert.equal(overheadDescriptor.bindingIrSha256, overheadBindingIrSha256);
  assert.deepEqual(
    overheadDescriptor.bindings.map(binding => binding.name),
    ["Box", "roundTrip", "withCallback", "makeAdder", "deferBoxValue", "sequence"],
  );
  const declarations = new Map(
    overheadDescriptor.bindingIr.declarations.map(declaration => [declaration.name, declaration]),
  );
  assert.equal(declarations.get("deferBoxValue").resultMode, "promise");
  assert.equal(declarations.get("sequence").resultMode, "iterator");
});

test("the native overhead suite measures generated calls and releases every value", async () => {
  const result = await runNativeOverheadSuite({
    scalarSamples: 2
    , scalarIterations: 10
    , lifecycleSamples: 2
    , lifecycleIterations: 5
    , copiedSamples: 2
    , copiedIterations: 2
    , batchSamples: 2
    , iteratorSamples: 2
    , callbackSamples: 2
    , callbackIterations: 5
    , nestedCallbackIterations: 2
    , exceptionIterations: 2
    , promiseSamples: 2
    , cancellationSamples: 2
    , cancellationWidth: 3
  });

  assert.equal(result.correctness.accepted, true);
  assert.equal(result.correctness.shutdown, true);
  assert.equal(result.correctness.diagnosticsBeforeCleanup.pendingOperations.live, 0);
  assert.equal(result.correctness.diagnosticsBeforeCleanup.callbacks.live, 0);
  assert.equal(result.correctness.diagnosticsAfterCleanup.resources.live, 0);
  assert.equal(result.correctness.diagnosticsAfterCleanup.nativeClosures.live, 0);
  assert.equal(result.correctness.iterator.live, 0);
  assert.equal(result.cancellation.pendingPerSample, 3);
  assert.equal(result.cancellation.checkedPromises, 6);
  assert.deepEqual(Object.keys(result.operations), [
    "scalarLeanClosure"
    , "retainedBoxRead"
    , "boxConstructReadDispose"
    , "canonicalIdentityCache"
    , "copiedRecordSmall"
    , "copiedRecord1024Items"
    , "copiedRecordPerItem"
    , "callback"
    , "nestedCallback"
    , "iterator256Items"
    , "iteratorPerItem"
    , "callbackException"
    , "promiseLatency"
    , "cancellationShutdown"
  ]);
  for(const operation of Object.values(result.operations))
{
    assert.ok(operation.samples > 0);
    assert.ok(operation.medianNs >= 0);
    assert.equal(operation.samplesNs.length, operation.samples);
}
});

test("the overhead benchmark consumer cannot reach private bridge calls", async () => {
  const client = await readFile("scripts/benchmark-native-overhead.mjs", "utf8");
  const harness = await readFile("src/performance/overhead.mjs", "utf8");
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
