import assert from "node:assert/strict";
import test from "node:test";

import createFinalStaticModule from "../../../build/lean-link-spike/final-static/main.mjs";
import createLazyModule from "../../../build/lean-link-spike/lazy/main.mjs";
import createStartupModule from "../../../build/lean-link-spike/startup/main.mjs";
import createThreadedFinalStaticModule from "../../../build/lean-link-spike-threaded/final-static/main.mjs";
import createThreadedLazyModule from "../../../build/lean-link-spike-threaded/lazy/main.mjs";
import {
	createAlphaDescriptor,
	createBetaDescriptor,
	createGammaDescriptor,
	gamma,
} from "../../../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../../../poc/link-spike/loader.mjs";

const threadedAlpha = createAlphaDescriptor({
	target: "threaded"
	, sideModule: new URL(
		"../../../build/lean-link-spike-threaded/lazy/alpha.so.wasm",
		import.meta.url,
	)
});
const threadedBeta = createBetaDescriptor({
	target: "threaded"
	, sideModule: new URL(
		"../../../build/lean-link-spike-threaded/lazy/beta.so.wasm",
		import.meta.url,
	)
	, alpha: threadedAlpha
});
const threadedGamma = createGammaDescriptor({
	target: "threaded"
	, sideModule: new URL(
		"../../../build/lean-link-spike-threaded/lazy/gamma.so.wasm",
		import.meta.url,
	)
	, beta: threadedBeta
});

const exerciseIdentityChain = module => {
	assert.equal(module._bridge_has_lean_alpha(), 1);
	assert.equal(module._bridge_has_lean_beta(), 1);
	assert.equal(module._bridge_has_lean_gamma(), 1);
	assert.equal(module._bridge_lean_runtime_init(), 1);
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.equal(module._bridge_lean_library_init_runs(), 1);

	const handle = module._bridge_lean_alpha_make(314);
	assert.notEqual(handle, 0);
	assert.equal(module._bridge_lean_live_handles(), 1);
	assert.equal(module._bridge_lean_cross_library_identity(handle), handle);
	assert.equal(module._bridge_lean_alpha_read(handle), 314);
	assert.equal(module._bridge_lean_live_handles(), 1);
	assert.equal(module._bridge_lean_release(handle), 0);
};

test("startup graph passes one retained object through Alpha, Beta, and Gamma", async () => {
  exerciseIdentityChain(await createStartupModule());
});

test("lazy graph resolves Gamma to Beta to Alpha before preserving identity", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);

  await libraries.load(gamma);
  assert.equal(libraries.loaded.size, 3);
  exerciseIdentityChain(module);
});

test("final-static graph preserves the same cross-library identity", async () => {
  exerciseIdentityChain(await createFinalStaticModule());
});

test("threaded lazy graph preserves identity in the shared memory", async () => {
  const module = await createThreadedLazyModule();
  const libraries = createLibraryLoader(module);

  await libraries.load(threadedGamma);
  assert.equal(libraries.loaded.size, 3);
  exerciseIdentityChain(module);
});

test("threaded final-static graph preserves the same identity", async () => {
  exerciseIdentityChain(await createThreadedFinalStaticModule());
});
