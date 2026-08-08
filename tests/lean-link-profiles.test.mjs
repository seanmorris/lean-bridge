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
  assert.deepEqual(Object.keys(alpha), ["Box", "roundTrip"]);
  const box = new alpha.Box(73);
  assert.equal(box.read(), 73);
  assert.equal("handle" in box, false);
  box.dispose();

  assert.deepEqual(
    alpha.roundTrip({
      enabled: false,
      count: 72,
      label: "threaded",
      bytes: new Uint8Array([7, 3]),
      values: new Uint32Array([11, 13]),
    }),
    {
      enabled: true,
      count: 73,
      label: "threaded",
      bytes: new Uint8Array([7, 3]),
      values: [11, 13],
    },
  );
  assert.equal(module._bridge_lean_active_frames(), 0);
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
