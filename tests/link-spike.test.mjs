import assert from "node:assert/strict";
import test from "node:test";

import createStartupModule from "../build/link-spike/startup/main.mjs";
import createLazyModule from "../build/link-spike/lazy/main.mjs";
import { beta } from "../poc/link-spike/descriptors.mjs";
import { createLibraryLoader } from "../poc/link-spike/loader.mjs";

const call = (module, name, args = []) => module.ccall(
  name,
  "number",
  args.map(() => "number"),
  args,
);

test("startup side modules register into one main runtime", async () => {
  const module = await createStartupModule();

  assert.equal(call(module, "bridge_has_alpha"), 1);
  assert.equal(call(module, "bridge_has_beta"), 1);
  assert.equal(call(module, "bridge_get_counter"), 3030);
  assert.equal(call(module, "bridge_call_alpha", [7]), 107);
  assert.equal(call(module, "bridge_call_beta", [5]), 1105);
  assert.equal(call(module, "bridge_get_counter"), 3052);
});

test("lazy recursive descriptors load dependencies once", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);

  assert.equal(call(module, "bridge_get_counter"), 0);
  assert.equal(call(module, "bridge_has_alpha"), 0);
  assert.equal(call(module, "bridge_has_beta"), 0);

  await libraries.load(beta);
  assert.equal(libraries.loaded.size, 2);
  assert.equal(call(module, "bridge_has_alpha"), 1);
  assert.equal(call(module, "bridge_has_beta"), 1);
  assert.equal(call(module, "bridge_get_counter"), 3030);
  assert.equal(call(module, "bridge_call_beta", [9]), 1109);
  assert.equal(call(module, "bridge_get_counter"), 3057);

  await libraries.load(beta);
  assert.equal(libraries.loaded.size, 2);
  assert.equal(call(module, "bridge_get_counter"), 3057);
});
