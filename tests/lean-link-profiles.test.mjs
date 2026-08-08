import assert from "node:assert/strict";
import test from "node:test";

import createThreadedLazyModule from "../build/lean-link-spike-threaded/lazy/main.mjs";
import { createAlphaDescriptor } from "../poc/lean-link-spike/descriptors.mjs";
import {
  inspectFinalStaticProfile,
  inspectLeanLinkProfile,
} from "./helpers/lean-link-structure.mjs";
import { createLibraryLoader } from "../poc/link-spike/loader.mjs";

const threadedAlpha = createAlphaDescriptor({
  target: "threaded",
  sideModule: new URL(
    "../build/lean-link-spike-threaded/lazy/alpha.so.wasm",
    import.meta.url,
  ),
});

test("threaded lazy side module loads into the existing shared memory", async () => {
  const module = await createThreadedLazyModule();
  const libraries = createLibraryLoader(module);
  const alpha = await libraries.load(threadedAlpha);

  assert.equal(libraries.loaded.size, 1);
  assert.equal(Object.isFrozen(alpha), true);
  assert.deepEqual(Object.keys(alpha), ["Box"]);
  const box = new alpha.Box(73);
  assert.equal(box.read(), 73);
  assert.equal("handle" in box, false);
  box.dispose();
});

test("threaded side modules bind the main shared memory and runtime", async () => {
  await inspectLeanLinkProfile({
    root: "build/lean-link-spike-threaded",
    profile: "startup",
    mainMemoryMode: "imported",
  });
  await inspectLeanLinkProfile({
    root: "build/lean-link-spike-threaded",
    profile: "lazy",
    mainMemoryMode: "imported",
  });
  await inspectFinalStaticProfile({
    root: "build/lean-link-spike-threaded",
    mainMemoryMode: "imported",
  });
});
