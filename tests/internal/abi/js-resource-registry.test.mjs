import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../../../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import {
  __bridgeTest,
  createLibraryLoader,
} from "../../../poc/link-spike/loader.mjs";

test("host values use canonical generation-safe tokens and retained leases", () => {
  const firstRuntime = {};
  const secondRuntime = {};
  const hostValue = { answer: 42 };
  const first = __bridgeTest.internHostValue(firstRuntime, hostValue, 7);
  const same = __bridgeTest.internHostValue(firstRuntime, hostValue, 7);

  assert.equal(same, first);
  assert.equal(first >>> 31, 1);
  assert.equal((first >>> 24) & 0x7f, 7);
  assert.notEqual((first >>> 12) & 0x0fff, 0);
  assert.notEqual(first & 0x0fff, 0);
  assert.equal(
    __bridgeTest.borrowHostValue(
      firstRuntime,
      first,
      7,
      value => value.answer,
    ),
    42,
  );
  assert.throws(
    () => __bridgeTest.borrowHostValue(firstRuntime, first, 8, value => value),
    error => error.code === "wrong-handle-kind",
  );
  assert.throws(
    () => __bridgeTest.borrowHostValue(secondRuntime, first, 7, value => value),
    error => error.code === "stale-handle-token",
  );

  assert.equal(__bridgeTest.releaseHostValue(firstRuntime, first, 7), 1);
  assert.equal(__bridgeTest.releaseHostValue(firstRuntime, first, 7), 0);
  assert.throws(
    () => __bridgeTest.borrowHostValue(firstRuntime, first, 7, value => value),
    error => error.code === "stale-handle-token",
  );
  const replacement = __bridgeTest.internHostValue(firstRuntime, hostValue, 7);
  assert.notEqual(replacement, first);
  assert.equal(__bridgeTest.releaseHostValue(firstRuntime, replacement, 7), 0);

  assert.deepEqual(__bridgeTest.diagnostics(firstRuntime).hostValues, {
    live: 0,
    created: 2,
    canonicalHits: 1,
    rejected: 2,
    borrows: 1,
    activeBorrows: 0,
    leasesAcquired: 3,
    leasesReleased: 3,
  });
});

test("queued finalization releases an unreachable wrapper on the next safe entry", async () => {
  const weakReferences = [];
  let finalizationCallback;
  let holding;
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module, {
    createWeakReference(target) {
      let current = target;
      const reference = {
        deref: () => current,
        clear: () => {
          current = undefined;
        },
      };
      weakReferences.push(reference);
      return reference;
    },
    createFinalizationRegistry(callback) {
      finalizationCallback = callback;
      return {
        register(_target, registeredHolding) {
          holding = registeredHolding;
        },
        unregister() {
          return true;
        },
      };
    },
  });
  const api = await libraries.load(alpha);
  new api.Box(99);

  assert.equal(module._bridge_lean_live_handles(), 1);
  weakReferences[0].clear();
  finalizationCallback(holding);
  assert.equal(module._bridge_lean_live_handles(), 1);

  const diagnostics = libraries.diagnostics();
  assert.equal(module._bridge_lean_live_handles(), 0);
  assert.equal(diagnostics.resources.live, 0);
  assert.equal(diagnostics.leases.released, 1);
  assert.equal(diagnostics.leases.finalized, 1);
});

test("deterministic disposal cancels fallback finalization", async () => {
  let finalizationCallback;
  let holding;
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module, {
    createFinalizationRegistry(callback) {
      finalizationCallback = callback;
      return {
        register(_target, registeredHolding) {
          holding = registeredHolding;
        },
        unregister() {
          holding = undefined;
          return true;
        },
      };
    },
  });
  const api = await libraries.load(alpha);
  const box = new api.Box(100);

  box.dispose();
  assert.equal(holding, undefined);
  assert.equal(finalizationCallback instanceof Function, true);
  assert.equal(module._bridge_lean_live_handles(), 0);
  assert.deepEqual(libraries.diagnostics().leases, {
    acquired: 1,
    released: 1,
    finalized: 0,
  });
});

test("runtime shutdown releases both registry domains and expires wrappers", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);
  const api = await libraries.load(alpha);
  const box = new api.Box(101);
  const hostToken = __bridgeTest.internHostValue(module, { host: true }, 9);

  assert.equal(module._bridge_lean_live_handles(), 1);
  assert.equal(libraries.diagnostics().hostValues.live, 1);
  assert.equal(libraries.shutdown(), true);
  assert.equal(module._bridge_lean_live_handles(), 0);
  assert.equal(libraries.diagnostics().resources.live, 0);
  assert.equal(libraries.diagnostics().hostValues.live, 0);
  assert.throws(
    () => box.read(),
    error => error.code === "runtime-shut-down",
  );
  assert.throws(
    () => __bridgeTest.borrowHostValue(module, hostToken, 9, value => value),
    error => error.code === "stale-handle-token",
  );
});
