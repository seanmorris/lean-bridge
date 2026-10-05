/**
 * Tests the Lean pending operation behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../../../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import {
	__bridgeTest,
	createLibraryLoader,
	createLibrarySurface,
} from "../../../poc/link-spike/loader.mjs";
import { compileJavaScriptProjection } from "../../../src/backends/javascript/projection.mjs";

const declarationId = "bridge:Alpha.deferBoxValue";

const pendingDescriptor = () => {
	const bindingIr = structuredClone(alpha.bindingIr);
	bindingIr.declarations.push({
		id: declarationId
		, name: "deferBoxValue"
		, kind: "function"
		, owner: null
		, overloadKey: "deferBoxValue(uint32)"
		, typeParameters: []
		, receiver: null
		, parameters: [
			{
				name: "value"
				, type: { kind: "primitive", name: "uint32" }
				, ownership: "copy"
				, lifetime: null
				, mutability: "immutable"
				, optional: false
				, default: null
			}
		]
		, result: {
			type: { kind: "primitive", name: "uint32" }
			, ownership: "copy"
			, lifetime: null
		}
		, mutability: "immutable"
		, effects: ["allocates", "async"]
		, failure: { mode: "none", errors: [], unexpected: "poison-runtime" }
		, resultMode: "promise"
		, capabilities: ["capability:shared-runtime"]
		, assurance: []
		, documentation: {
			summary: "Read a Lean value after returning from the initiating Wasm call."
			, details: "The private adapter schedules settlement through the shared pending domain."
		}
		, source: {
			producer: "bridge"
			, declaration: "Alpha.deferBoxValue"
			, extensions: {
				"lean-wasm.org/intrinsic": "stackless-pending-probe"
			}
		}
	});
	const privateAbi = structuredClone(alpha.privateAbi);
	privateAbi.declarations[declarationId] = {
		symbol: "_bridge_lean_alpha_defer_box_value"
		, adapter: {
			kind: "pending-operation-v1"
			, abiVersion: 1
			, cancel: "_bridge_lean_alpha_cancel_defer_box_value"
		}
	};
	const projection = compileJavaScriptProjection(bindingIr, privateAbi);
	const binding = projection.bindings.find(item => item.declarationId === declarationId);
	return {
		...alpha,
		bindingIr
		, bindingIrSha256: projection.bindingIrSha256
		, bindings: [binding]
	};
};

const waitForNativeDrain = async module => {
	for(let attempt = 0; attempt < 100; attempt += 1)
	{
		if(module._bridge_lean_native_pending_operations() === 0) return;
		await new Promise(resolve => setTimeout(resolve, 2));
	}
	assert.fail("native pending operation did not drain");
};

test("Lean settles a public Promise after the initiating Wasm stack returns", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);
  await libraries.load(alpha);
  const api = createLibrarySurface(module, pendingDescriptor());

  const result = api.deferBoxValue(42);
  assert.equal(result instanceof Promise, true);
  assert.equal(module._bridge_lean_active_frames(), 0);
  assert.equal(module._bridge_lean_native_pending_operations(), 1);
  assert.equal(libraries.diagnostics().pendingOperations.live, 1);

  assert.equal(await result, 42);
  assert.equal(module._bridge_lean_native_pending_operations(), 0);
  assert.equal(libraries.diagnostics().pendingOperations.live, 0);
  assert.equal(libraries.diagnostics().pendingOperations.resolved, 1);
  assert.equal(libraries.shutdown(), true);
});

test("cancellation stops the scheduled Lean call and completes once", async () => {
  let token;
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module, {
    onPendingTransition:
      /**
       * Captures each pending-operation transition so the test can verify registration, settlement, and cleanup order.
       *
       * @param transition - Pending-operation lifecycle transition captured by the observer test double.
       */
      function(transition) {
      if(transition.event === "begin") token = transition.token;
      }
  });
  await libraries.load(alpha);
  const api = createLibrarySurface(module, pendingDescriptor());
  const result = api.deferBoxValue(7);
  const rejected = assert.rejects(
    result,
    error => error.code === "operation-cancelled",
  );

  assert.equal(__bridgeTest.cancelPendingOperation(module, token, "cancelled"), true);
  assert.equal(module._bridge_lean_native_pending_operations(), 0);
  assert.equal(module._bridge_lean_alpha_cancel_defer_box_value(token), 0);
  await rejected;
  await waitForNativeDrain(module);
  assert.equal(module._bridge_lean_native_cancelled_operations(), 1);
  assert.equal(module._bridge_lean_native_late_settlements(), 0);
  assert.equal(libraries.diagnostics().pendingOperations.cancelled, 1);
  assert.throws(
    () => __bridgeTest.resolvePendingOperation(module, token, 7),
    error => error.code === "stale-pending-operation",
  );
  assert.equal(libraries.shutdown(), true);
});

test("runtime shutdown cancels native pending work before Lean finalization", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);
  await libraries.load(alpha);
  const api = createLibrarySurface(module, pendingDescriptor());
  const result = api.deferBoxValue(9);
  const rejected = assert.rejects(
    result,
    error => error.code === "operation-cancelled",
  );

  assert.equal(libraries.shutdown(), true);
  assert.equal(module._bridge_lean_native_pending_operations(), 0);
  await rejected;
  await waitForNativeDrain(module);
  assert.equal(module._bridge_lean_native_cancelled_operations(), 1);
  assert.equal(module._bridge_lean_runtime_status(), 4);
  assert.equal(libraries.diagnostics().pendingOperations.state, "closed");
});

test("native cancellation unlinks any pending slot before synchronous shutdown", async () => {
	const tokens = [], module = await createLazyModule();
	const libraries = createLibraryLoader(module, { onPendingTransition: transition => {
		if(transition.event === "begin") tokens.push(transition.token);
	} });
	await libraries.load(alpha);
	const api = createLibrarySurface(module, pendingDescriptor());
	const pending = [10, 20, 30, 40].map(value => api.deferBoxValue(value));
	const settled = Promise.allSettled(pending);
	assert.equal(module._bridge_lean_runtime_shutdown(), 0, "live native work still blocks finalization");
	for(const [index, live] of [[1, 3], [3, 2], [0, 1]])
	{
		assert.equal(__bridgeTest.cancelPendingOperation(module, tokens[index], "cancelled"), true);
		assert.equal(module._bridge_lean_native_pending_operations(), live);
		assert.equal(module._bridge_lean_alpha_cancel_defer_box_value(tokens[index]), 0);
	}
	assert.equal(await pending[2], 30);
	const results = await settled;
	assert.deepEqual(results.map(item => item.status), ["rejected", "rejected", "fulfilled", "rejected"]);
	for(const index of [0, 1, 3]) assert.equal(results[index].reason.code, "operation-cancelled");
	assert.equal(module._bridge_lean_native_pending_operations(), 0);
	const shutdownPending = Array.from({ length: 16 }, (_, index) => api.deferBoxValue(index));
	const shutdownSettled = Promise.allSettled(shutdownPending);
	assert.equal(libraries.shutdown(), true);
	assert.equal(module._bridge_lean_native_pending_operations(), 0);
	assert.equal(module._bridge_lean_native_cancelled_operations(), 19);
	assert.ok((await shutdownSettled).every(item => item.status === "rejected" && item.reason.code === "operation-cancelled"));
	await new Promise(resolve => setTimeout(resolve, 10));
	assert.equal(module._bridge_lean_native_pending_operations(), 0);
	assert.equal(module._bridge_lean_native_cancelled_operations(), 19);
	assert.equal(module._bridge_lean_native_late_settlements(), 0);
	assert.equal(libraries.shutdown(), true);
});
