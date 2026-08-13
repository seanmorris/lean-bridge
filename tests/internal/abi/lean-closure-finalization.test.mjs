import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../../../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../../../poc/link-spike/loader.mjs";

test("Lean closure finalizers queue native release until a safe bridge entry", async () => {
  const references = [];
  const registries = [];
  const module = await createLazyModule();
  const createControlledFinalizer = callback => {
    const holdings = [];
    const registry = {
      callback
      , holdings
      , register:
        /**
         * Associates the test target with its finalizer holding so simulated collection can deliver the correct lifecycle token.
         *
         * @param _target - Test-double input accepted for interface compatibility but intentionally unused.
         * @param holding - Lifecycle token retained by the finalization registry until it is unregistered or delivered.
         */
        function(_target, holding) {
        holdings.push(holding);
        }
      , unregister:
        /**
         * Removes the captured finalizer holding and reports whether explicit lifecycle cleanup succeeded.
         */
        function() {
        return true;
        }
    };
    registries.push(registry);
    return registry;
  };
  const libraries = createLibraryLoader(module, {
    createWeakReference:
      /**
       * Returns a controllable weak-reference stand-in whose referent the test can clear explicitly.
       *
       * @param target - Projected closure wrapper held until the test simulates collection.
       */
      function(target) {
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
      }
    , createClosureCacheFinalizationRegistry: createControlledFinalizer
    , createClosureFinalizationRegistry: createControlledFinalizer
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
