import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../poc/link-spike/loader.mjs";

test("Lean-generated lazy side module binds into the existing Lean runtime", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);

  const loadedAlpha = await libraries.load(alpha);
  assert.equal(libraries.loaded.size, 1);
  assert.equal(Object.isFrozen(loadedAlpha), true);
  assert.deepEqual(Object.keys(loadedAlpha), ["Box", "roundTrip"]);
  assert.equal(Object.keys(loadedAlpha).some(name => name.startsWith("_")), false);

  const box = new loadedAlpha.Box(42);
  assert.equal(box.read(), 42);
  box.dispose();
  assert.throws(() => box.read(), /Box has been disposed/);

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
