/**
 * Tests the callback runtime behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CallbackRegistry } from "../src/runtime/callbacks.mjs";

const plan = (overrides = {}) => ({
	kind: "callback-signature-v1"
	, abiVersion: 1
	, signatureId: "callback-v1:test"
	, invocation: "many"
	, reentry: {
		policy: "same-agent"
		, maxDepth: 64
	}
	, selfDisposal: "reject",
	...overrides
});

test("callbacks receive canonical generation-safe handles by signature", () => {
  const callbacks = new CallbackRegistry({ handleKind: 9 });
  const signature = plan();
  const callback = value => value + 1;
  const first = callbacks.retain(callback, signature);
  const same = callbacks.retain(callback, signature);

  assert.equal(same, first);
  assert.equal(first >>> 31, 1);
  assert.equal((first >>> 24) & 0x7f, 9);
  assert.notEqual((first >>> 12) & 0x0fff, 0);
  assert.notEqual(first & 0x0fff, 0);
  assert.equal(callbacks.invoke(first, signature, [41]), 42);
  assert.equal(callbacks.release(first, signature), 1);
  assert.equal(callbacks.release(first, signature), 0);
  assert.throws(
    () => callbacks.invoke(first, signature, [41]),
    error => error.code === "stale-callback-token",
  );

  const replacement = callbacks.retain(callback, signature);
  assert.notEqual(replacement, first);
  assert.equal(callbacks.release(replacement, signature), 0);
  assert.equal(callbacks.snapshot().canonicalHits, 1);
});

test("nested callback frames enter and leave in last-in-first-out order", () => {
  const events = [];
  const callbacks = new CallbackRegistry({ onFrame: event => events.push(event) });
  const signature = plan();
  let innerToken;
  const inner = value => {
    assert.deepEqual(
      callbacks.snapshot().frames.map(frame => frame.depth),
      [1, 2],
    );
    return value + 1;
  };
  const outer = value => callbacks.invokeRetained(innerToken, [value]) + 1;
  innerToken = callbacks.retain(inner, signature);
  const outerToken = callbacks.retain(outer, signature);

  assert.equal(callbacks.invoke(outerToken, signature, [40]), 42);
  assert.deepEqual(
    events.map(event => [event.event, event.depth]),
    [["enter", 1], ["enter", 2], ["leave", 2], ["leave", 1]],
  );
  assert.equal(callbacks.snapshot().activeFrames, 0);
  assert.equal(callbacks.snapshot().maxDepth, 2);
});

test("native Lean closures share the nested frame stack with host callbacks", () => {
  const events = [];
  const callbacks = new CallbackRegistry({ onFrame: event => events.push(event) });
  const signature = plan();
  const hostToken = callbacks.retain(
    value =>
      callbacks.invokeNative(
        0x0200_1001,
        signature,
        nested => nested + 1,
        [value],
      ),
    signature,
  );

  assert.equal(callbacks.invokeRetained(hostToken, [41]), 42);
  assert.deepEqual(
    events.map(event => [event.event, event.direction, event.depth]),
    [
      ["enter", "host", 1]
      , ["enter", "lean", 2]
      , ["leave", "lean", 2]
      , ["leave", "host", 1]
    ],
  );
  assert.equal(callbacks.snapshot().activeFrames, 0);
});

test("an active non-reentrant callback rejects a nested native call", () => {
  const callbacks = new CallbackRegistry();
  const signature = plan({
    reentry: { policy: "disallowed", maxDepth: 64 }
  });
  const token = callbacks.retain(() => callbacks.beforeNativeCall(), signature);

  assert.throws(
    () => callbacks.invokeRetained(token),
    error => error.code === "callback-reentry-disallowed",
  );
  assert.equal(callbacks.snapshot().activeFrames, 0);
});

test("depth overflow rejects before entering another callback", () => {
  const callbacks = new CallbackRegistry();
  const signature = plan({
    reentry: { policy: "same-agent", maxDepth: 2 }
  });
  let token;
  const recursive = depth =>
    depth === 0 ? 0 : callbacks.invoke(token, signature, [depth - 1]);
  token = callbacks.retain(recursive, signature);

  assert.throws(
    () => callbacks.invoke(token, signature, [2]),
    error =>
      error.code === "callback-depth-exceeded"
      && error.details.maxDepth === 2,
  );
  assert.equal(callbacks.snapshot().activeFrames, 0);
});

test("exceptions unwind to the entry frame and leave the registry usable", () => {
  const callbacks = new CallbackRegistry();
  const signature = plan();
  const expected = new Error("callback failed");
  const failing = callbacks.retain(() => {
    throw expected;
  }, signature);
  const healthy = callbacks.retain(value => value, signature);

  assert.throws(() => callbacks.invoke(failing, signature), error => error === expected);
  assert.equal(callbacks.snapshot().activeFrames, 0);
  assert.equal(callbacks.invoke(healthy, signature, [42]), 42);
  assert.equal(callbacks.snapshot().exceptions, 1);
});

test("active final release follows the generated self-disposal policy", () => {
  const rejectingRegistry = new CallbackRegistry();
  const rejectingPlan = plan();
  let rejectingToken;
  rejectingToken = rejectingRegistry.retain(
    () => rejectingRegistry.release(rejectingToken, rejectingPlan),
    rejectingPlan,
  );
  assert.throws(
    () => rejectingRegistry.invoke(rejectingToken, rejectingPlan),
    error => error.code === "callback-active",
  );
  assert.equal(rejectingRegistry.snapshot().live, 1);

  const deferringRegistry = new CallbackRegistry();
  const deferringPlan = plan({ selfDisposal: "defer" });
  let deferringToken;
  deferringToken = deferringRegistry.retain(
    () => deferringRegistry.release(deferringToken, deferringPlan),
    deferringPlan,
  );
  assert.equal(deferringRegistry.invoke(deferringToken, deferringPlan), 0);
  assert.equal(deferringRegistry.snapshot().live, 0);
  assert.throws(
    () => deferringRegistry.invoke(deferringToken, deferringPlan),
    error => error.code === "stale-callback-token",
  );
});

test("once and non-reentrant callback policies are enforced", () => {
  const onceRegistry = new CallbackRegistry();
  const oncePlan = plan({ invocation: "once" });
  const onceToken = onceRegistry.retain(() => 1, oncePlan);
  assert.equal(onceRegistry.invoke(onceToken, oncePlan), 1);
  assert.throws(
    () => onceRegistry.invoke(onceToken, oncePlan),
    error => error.code === "callback-already-invoked",
  );

  const nestedRegistry = new CallbackRegistry();
  const nestedPlan = plan({
    reentry: { policy: "disallowed", maxDepth: 64 }
  });
  const innerToken = nestedRegistry.retain(() => 1, nestedPlan);
  const outerToken = nestedRegistry.retain(
    () => nestedRegistry.invoke(innerToken, nestedPlan),
    nestedPlan,
  );
  assert.throws(
    () => nestedRegistry.invoke(outerToken, nestedPlan),
    error => error.code === "callback-reentry-disallowed",
  );
  assert.equal(nestedRegistry.snapshot().activeFrames, 0);
});
