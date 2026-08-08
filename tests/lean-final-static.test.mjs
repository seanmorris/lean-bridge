import assert from "node:assert/strict";
import test from "node:test";

import createFinalStaticModule from "../build/lean-link-spike/final-static/main.mjs";
import createLazyModule from "../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  createLibraryLoader,
  createLibrarySurface,
} from "../poc/link-spike/loader.mjs";

const exerciseBox = api => {
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api), ["Box"]);
  const box = new api.Box(2718);
  assert.equal(box.read(), 2718);
  assert.equal("handle" in box, false);
  box.dispose();
};

test("dynamic and final-static graphs project the same native Alpha contract", async () => {
  const dynamicModule = await createLazyModule();
  const dynamicApi = await createLibraryLoader(dynamicModule).load(alpha);
  const staticApi = createLibrarySurface(await createFinalStaticModule(), alpha);

  assert.deepEqual(Object.keys(dynamicApi), Object.keys(staticApi));
  exerciseBox(dynamicApi);
  exerciseBox(staticApi);
});
