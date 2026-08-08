import assert from "node:assert/strict";
import test from "node:test";

import createBrowserModule from "../../../build/lean-link-spike/startup/main.mjs";
import createThreadedModule from "../../../build/lean-link-spike-threaded/startup/main.mjs";

const exerciseMemoryGrowth = module => {
  const before = module._bridge_test_lean_heap_size();
  assert.equal(module.HEAP8.buffer.byteLength, before);

  const after = module._bridge_test_lean_grow_heap();
  assert.ok(after > before);
  assert.equal(module.HEAP8.buffer.byteLength, after);

  assert.equal(module._bridge_lean_runtime_init(), 1);
  const handle = module._bridge_lean_alpha_make(73);
  assert.notEqual(handle, 0);
  assert.equal(module._bridge_lean_alpha_read(handle), 73);
  assert.equal(module._bridge_lean_release(handle), 0);
};

test("browser profile owns one growable unshared memory", async () => {
  const module = await createBrowserModule();
  assert.equal(module.ccall, undefined);
  assert.equal(module.HEAP8.buffer instanceof SharedArrayBuffer, false);
  exerciseMemoryGrowth(module);
});

test("threaded profile imports one growable shared memory", async () => {
  const module = await createThreadedModule();
  assert.equal(module.ccall, undefined);
  assert.equal(module.HEAP8.buffer instanceof SharedArrayBuffer, true);
  exerciseMemoryGrowth(module);
});
