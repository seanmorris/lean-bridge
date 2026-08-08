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
  assert.deepEqual(Object.keys(loadedAlpha), ["Box"]);
  assert.equal(Object.keys(loadedAlpha).some(name => name.startsWith("_")), false);

  const box = new loadedAlpha.Box(42);
  assert.equal(box.read(), 42);
  box.dispose();
  assert.throws(() => box.read(), /Box has been disposed/);
});
