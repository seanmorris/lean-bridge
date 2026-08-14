/**
 * Tests the weak value map behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WeakValueMap } from "../src/runtime/weak-value-map.mjs";

const controlledRuntime = () => {
	const references = [];
	const registries = [];
	const createWeakReference = target => {
		let value = target;
		const reference = {
			clear:
				/**
         * Clears all tracked entries and resets auxiliary lifecycle state without retaining stale handles.
         */
				function() {
					value = undefined;
				}
			, deref:
				/**
         * Returns the test-controlled referent, including undefined after simulated collection.
         */
				function() {
					return value;
				}
		};
		references.push(reference);
		return reference;
	};
	const createFinalizationRegistry = callback => {
		const holdings = [];
		const registrations = new Map();
		const registry = {
			callback
			, holdings
			, register:
				/**
         * Associates the test target with its finalizer holding so simulated collection can deliver the correct lifecycle token.
         *
         * @param _target - Test-double input accepted for interface compatibility but intentionally unused.
         * @param holding - Lifecycle token retained by the finalization registry until it is unregistered or delivered.
         * @param token - Generation-safe handle identifying the live native entry.
         */
				function(_target, holding, token) {
					holdings.push(holding);
					registrations.set(token, holding);
				}
			, unregister:
				/**
         * Removes the captured finalizer holding and reports whether explicit lifecycle cleanup succeeded.
         *
         * @param token - Generation-safe handle identifying the live native entry.
         */
				function(token) {
					return registrations.delete(token);
				}
		};
		registries.push(registry);
		return registry;
	};
	return { createFinalizationRegistry, createWeakReference, references, registries };
};

test("weak values retain arbitrary keys and live canonical values", () => {
  const map = new WeakValueMap();
  const first = () => 1;
  const second = { answer: 42 };

  assert.equal(map.set(7, first), map);
  map.set("second", second);

  assert.equal(map.get(7), first);
  assert.equal(map.has("second"), true);
  assert.deepEqual([...map], [[7, first], ["second", second]]);
  assert.deepEqual([...map.keys()], [7, "second"]);
  assert.deepEqual([...map.values()], [first, second]);
  assert.equal(map.size, 2);
});

test("dead values disappear during lookup and iteration", () => {
  const runtime = controlledRuntime();
  const map = new WeakValueMap(runtime);
  const first = {};
  const second = {};
  map.set("first", first);
  map.set("second", second);

  runtime.references[0].clear();

  assert.equal(map.has("first"), false);
  assert.deepEqual([...map], [["second", second]]);
  assert.equal(map.size, 1);
});

test("a replaced value's stale finalizer cannot delete its replacement", () => {
  const runtime = controlledRuntime();
  const map = new WeakValueMap(runtime);
  const first = {};
  const replacement = {};
  map.set("same", first);
  const staleHolding = runtime.registries[0].holdings[0];
  map.set("same", replacement);

  runtime.references[0].clear();
  runtime.registries[0].callback(staleHolding);

  assert.equal(map.get("same"), replacement);
  assert.equal(map.size, 1);
});

test("a retired registry cannot mutate entries created after clear", () => {
  const runtime = controlledRuntime();
  const map = new WeakValueMap(runtime);
  const first = {};
  const replacement = {};
  map.set("same", first);
  const oldRegistry = runtime.registries[0];
  const staleHolding = oldRegistry.holdings[0];

  map.clear();
  map.set("same", replacement);
  runtime.references[0].clear();
  oldRegistry.callback(staleHolding);

  assert.equal(map.get("same"), replacement);
  assert.equal(map.size, 1);
});

test("weak values reject primitives and support deterministic deletion", () => {
  const runtime = controlledRuntime();
  const map = new WeakValueMap(runtime);
  const value = {};
  map.set("value", value);

  assert.throws(
    () => map.set("primitive", 1),
    /values must be objects or functions/,
  );
  assert.throws(
    () => map.set("null", null),
    /values must be objects or functions/,
  );
  assert.equal(map.delete("value"), true);
  assert.equal(map.delete("value"), false);
  assert.equal(map.size, 0);
});
