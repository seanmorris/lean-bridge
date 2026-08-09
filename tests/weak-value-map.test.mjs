import assert from "node:assert/strict";
import test from "node:test";

import { WeakValueMap } from "../src/runtime/weak-value-map.mjs";

const controlledRuntime = () => {
  const references = [];
  const registries = [];
  const createWeakReference = target => {
    let value = target;
    const reference = {
      clear() {
        value = undefined;
      },
      deref() {
        return value;
      },
    };
    references.push(reference);
    return reference;
  };
  const createFinalizationRegistry = callback => {
    const holdings = [];
    const registrations = new Map();
    const registry = {
      callback,
      holdings,
      register(_target, holding, token) {
        holdings.push(holding);
        registrations.set(token, holding);
      },
      unregister(token) {
        return registrations.delete(token);
      },
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
