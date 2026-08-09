import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  createLibraryLoader,
  createLibrarySurface,
} from "../poc/link-spike/loader.mjs";

test("Lean-generated lazy side module binds into the existing Lean runtime", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);

  const loadedAlpha = await libraries.load(alpha);
  const sameSurface = createLibrarySurface(module, alpha);
  assert.equal(libraries.loaded.size, 1);
  assert.equal(Object.isFrozen(loadedAlpha), true);
  assert.deepEqual(
    Object.keys(loadedAlpha),
    ["Box", "roundTrip", "withCallback", "makeAdder"],
  );
  assert.equal(sameSurface.Box, loadedAlpha.Box);
  assert.equal(Object.keys(loadedAlpha).some(name => name.startsWith("_")), false);

  const box = new loadedAlpha.Box(42);
  assert.equal(box.read(), 42);
  assert.equal(box.identity(), box);
  assert.equal("handle" in box, false);
  assert.deepEqual(libraries.diagnostics().resources, {
    live: 1,
    wrappersCreated: 1,
    canonicalHits: 1,
    rejected: 0,
  });
  assert.deepEqual(libraries.diagnostics().leases, {
    acquired: 1,
    released: 0,
    finalized: 0,
  });
  box.dispose();
  assert.throws(
    () => box.read(),
    error => error.code === "resource-disposed" && /disposed/.test(error.message),
  );

  const input = {
    enabled: true,
    count: 41,
    label: "Lean λ\0bridge",
    bytes: new Uint8Array([0, 1, 127, 128, 255]),
    values: [0, 1, 0xffff_ffff],
  };
  const result = loadedAlpha.roundTrip(input);
  assert.deepEqual(result, {
    enabled: false,
    count: 42,
    label: "Lean λ\0bridge",
    bytes: new Uint8Array([0, 1, 127, 128, 255]),
    values: [0, 1, 0xffff_ffff],
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.values), true);
  assert.equal(input.enabled, true);
  assert.equal(input.count, 41);
  assert.equal(module._bridge_lean_active_frames(), 0);

  const callbackFrames = [];
  const nestedModule = await createLazyModule();
  const nestedLibraries = createLibraryLoader(nestedModule, {
    onCallbackFrame: event => callbackFrames.push(event),
  });
  const nestedAlpha = await nestedLibraries.load(alpha);
  const transform = value => {
    const nestedBox = new nestedAlpha.Box(value);
    try {
      const read = nestedBox.read();
      return read === 40
        ? nestedAlpha.withCallback(read, transform)
        : read;
    } finally {
      nestedBox.dispose();
    }
  };
  assert.equal(nestedAlpha.withCallback(39, transform), 43);
  assert.deepEqual(
    callbackFrames.map(event => [event.event, event.depth]),
    [["enter", 1], ["enter", 2], ["leave", 2], ["leave", 1]],
  );
  assert.equal(nestedLibraries.diagnostics().callbacks.canonicalHits, 1);
  assert.equal(nestedLibraries.diagnostics().callbacks.live, 0);
  assert.equal(nestedLibraries.diagnostics().callbacks.activeFrames, 0);
});

test("callback exceptions unwind to JavaScript without leaking the retained function", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);
  const loadedAlpha = await libraries.load(alpha);
  const expected = new Error("host callback failed");

  assert.throws(
    () => loadedAlpha.withCallback(40, () => { throw expected; }),
    error => error === expected,
  );
  assert.equal(module._bridge_lean_active_frames(), 0);
  assert.equal(libraries.diagnostics().callbacks.live, 0);
  assert.equal(libraries.diagnostics().callbacks.activeFrames, 0);
  assert.equal(loadedAlpha.withCallback(40, value => value), 42);
});

test("exported Lean closures are ordinary nested callables with deterministic cleanup", async () => {
  const callbackFrames = [];
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module, {
    onCallbackFrame: event => callbackFrames.push(event),
  });
  const loadedAlpha = await libraries.load(alpha);
  const addTwo = loadedAlpha.makeAdder(2);

  assert.equal(typeof addTwo, "function");
  assert.equal("handle" in addTwo, false);
  assert.equal(addTwo.disposed, false);
  assert.equal(loadedAlpha.withCallback(39, value => addTwo(value)), 43);
  assert.deepEqual(
    callbackFrames.map(event => [event.event, event.direction, event.depth]),
    [
      ["enter", "host", 1],
      ["enter", "lean", 2],
      ["leave", "lean", 2],
      ["leave", "host", 1],
    ],
  );
  assert.deepEqual(libraries.diagnostics().nativeClosures, {
    live: 1,
    created: 1,
    canonicalHits: 0,
    calls: 1,
    leasesAcquired: 1,
    leasesReleased: 0,
    finalized: 0,
  });
  assert.equal(addTwo.dispose(), true);
  assert.equal(addTwo.dispose(), false);
  assert.equal(addTwo.disposed, true);
  assert.throws(
    () => addTwo(40),
    error => error.code === "callback-disposed",
  );
  assert.equal(libraries.diagnostics().nativeClosures.live, 0);
  assert.equal(libraries.diagnostics().nativeClosures.leasesReleased, 1);
  assert.equal(module._bridge_lean_live_handles(), 0);
  assert.equal(libraries.shutdown(), true);
});

test("exported Lean closure finalizers queue native release until a safe bridge entry", async () => {
  const references = [];
  const registries = [];
  const module = await createLazyModule();
  const createControlledFinalizer = callback => {
    const holdings = [];
    const registry = {
      callback,
      holdings,
      register(_target, holding) {
        holdings.push(holding);
      },
      unregister() {
        return true;
      },
    };
    registries.push(registry);
    return registry;
  };
  const libraries = createLibraryLoader(module, {
    createWeakReference(target) {
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
    },
    createClosureCacheFinalizationRegistry: createControlledFinalizer,
    createClosureFinalizationRegistry: createControlledFinalizer,
  });
  const loadedAlpha = await libraries.load(alpha);
  loadedAlpha.makeAdder(2);
  const weakCacheRegistry = registries[0];
  const nativeReleaseRegistry = registries[1];

  references[0].clear();
  weakCacheRegistry.callback(weakCacheRegistry.holdings[0]);
  nativeReleaseRegistry.callback(nativeReleaseRegistry.holdings[0]);
  assert.equal(module._bridge_lean_live_handles(), 1);

  const diagnostics = libraries.diagnostics();
  assert.equal(diagnostics.nativeClosures.live, 0);
  assert.equal(diagnostics.nativeClosures.leasesReleased, 1);
  assert.equal(diagnostics.nativeClosures.finalized, 1);
  assert.equal(module._bridge_lean_live_handles(), 0);

  const explicitlyDisposed = loadedAlpha.makeAdder(3);
  const staleCacheHolding = weakCacheRegistry.holdings[1];
  const staleReleaseHolding = nativeReleaseRegistry.holdings[1];
  assert.equal(explicitlyDisposed.dispose(), true);
  weakCacheRegistry.callback(staleCacheHolding);
  nativeReleaseRegistry.callback(staleReleaseHolding);
  const afterStaleFinalizer = libraries.diagnostics();
  assert.equal(afterStaleFinalizer.nativeClosures.live, 0);
  assert.equal(afterStaleFinalizer.nativeClosures.leasesReleased, 2);
  assert.equal(afterStaleFinalizer.nativeClosures.finalized, 1);
  assert.equal(module._bridge_lean_live_handles(), 0);
  assert.equal(libraries.shutdown(), true);
});

test("resource wrappers reject nominal and cross-runtime misuse", async () => {
  const firstModule = await createLazyModule();
  const secondModule = await createLazyModule();
  const firstLibraries = createLibraryLoader(firstModule);
  const secondLibraries = createLibraryLoader(secondModule);
  const first = await firstLibraries.load(alpha);
  const second = await secondLibraries.load(alpha);
  const box = new first.Box(11);

  assert.throws(
    () => second.Box.prototype.read.call(box),
    error => error.code === "cross-runtime-handle",
  );

  const otherLifecycle = structuredClone(alpha.bindings[0].lifecycle);
  otherLifecycle.typeId = "lean:Alpha.OtherBox";
  otherLifecycle.constructor.result.typeId = "lean:Alpha.OtherBox";
  for (const method of otherLifecycle.methods) {
    method.receiver.typeId = "lean:Alpha.OtherBox";
    if (method.result.transport === "handle") {
      method.result.typeId = "lean:Alpha.OtherBox";
    }
  }
  const nominalDescriptor = Object.freeze({
    ...alpha,
    bindings: Object.freeze([
      ...alpha.bindings,
      Object.freeze({
        ...alpha.bindings[0],
        name: "OtherBox",
        typeId: "lean:Alpha.OtherBox",
        lifecycle: otherLifecycle,
        methods: otherLifecycle.methods.map(call => ({
          name: call.name,
          declarationId: call.declarationId,
          symbol: call.symbol,
          call,
        })),
      }),
    ]),
  });
  const nominal = createLibrarySurface(firstModule, nominalDescriptor);
  assert.throws(
    () => nominal.OtherBox.prototype.read.call(box),
    error => error.code === "wrong-handle-kind",
  );

  box.dispose();
  assert.equal(firstLibraries.shutdown(), true);
  assert.throws(
    () => first.roundTrip({
      enabled: true,
      count: 0,
      label: "closed",
      bytes: new Uint8Array(),
      values: [],
    }),
    error => error.code === "runtime-shut-down",
  );
  assert.equal(firstLibraries.diagnostics().state, "closed");
  assert.equal(firstLibraries.diagnostics().epoch, 2);
});

test("native copied-value validation returns structured errors", async () => {
  const module = await createLazyModule();
  const loadedAlpha = await createLibraryLoader(module).load(alpha);

  assert.throws(
    () =>
      loadedAlpha.roundTrip({
        enabled: true,
        count: -1,
        label: "invalid",
        bytes: new Uint8Array(),
        values: [],
      }),
    error => {
      assert.equal(error.name, "LeanBridgeError");
      assert.equal(error.code, "invalid-argument");
      assert.equal(error.library, "poc/lean-alpha@0.0.0");
      assert.equal(error.operation, "roundTrip");
      assert.equal(error.details.field, "count");
      return true;
    },
  );
  assert.equal(module._bridge_lean_active_frames(), 0);
});
