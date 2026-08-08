import assert from "node:assert/strict";
import test from "node:test";

import createStartupModule from "../build/lean-link-spike/startup/main.mjs";
import createLazyModule from "../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../poc/link-spike/loader.mjs";

const call = (module, name, args = []) => module.ccall(
  name,
  "number",
  args.map(() => "number"),
  args,
);

const exerciseBox = module => {
  assert.equal(call(module, "bridge_lean_runtime_init"), 1);
  assert.equal(call(module, "bridge_has_lean_alpha"), 1);

  const handle = call(module, "bridge_lean_alpha_make", [42]);
  assert.notEqual(handle, 0);
  assert.equal(call(module, "bridge_lean_handle_identity", [handle]), handle);
  assert.equal(call(module, "bridge_lean_alpha_read", [handle]), 42);
  assert.equal(call(module, "bridge_lean_alpha_read", [handle]), 42);
  assert.equal(call(module, "bridge_lean_live_handles"), 1);
  assert.equal(call(module, "bridge_lean_release", [handle]), 0);
  assert.equal(call(module, "bridge_lean_live_handles"), 0);
};

test("Lean-generated startup side module allocates in the main Lean runtime", async () => {
  const module = await createStartupModule();
  exerciseBox(module);
});

test("Lean-generated lazy side module binds into the existing Lean runtime", async () => {
  const module = await createLazyModule();
  const libraries = createLibraryLoader(module);

  assert.equal(call(module, "bridge_has_lean_alpha"), 0);
  await libraries.load(alpha);
  assert.equal(libraries.loaded.size, 1);
  exerciseBox(module);
});
