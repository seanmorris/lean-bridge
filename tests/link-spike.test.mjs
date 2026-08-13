import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../build/link-spike/lazy/main.mjs";
import { beta } from "../poc/link-spike/descriptors.mjs";
import { createLibraryLoader } from "../poc/link-spike/loader.mjs";

test("a named lazy load returns one native API and resolves dependencies once", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module, { libraries: [beta] });

  const [loadedBeta, sameLoadedBeta] = await Promise.all([
    libraries.load("beta")
    , libraries.load("beta")
  ]);
  assert.equal(sameLoadedBeta, loadedBeta);
  assert.equal(libraries.loaded.size, 2);
  assert.equal(Object.isFrozen(loadedBeta), true);
  assert.deepEqual(Object.keys(loadedBeta), ["chain"]);
  assert.equal(loadedBeta.chain(9), 1109);

  assert.equal(await libraries.load("beta"), loadedBeta);
  assert.equal(libraries.loaded.size, 2);
});
