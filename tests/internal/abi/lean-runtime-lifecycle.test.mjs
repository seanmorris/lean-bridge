import assert from "node:assert/strict";
import test from "node:test";

import createStartupModule from "../../../build/lean-link-spike/startup/main.mjs";
import createLazyModule from "../../../build/lean-link-spike/lazy/main.mjs";

const exerciseBox = module => {
  assert.equal(module._bridge_lean_runtime_status(), 0);
  assert.equal(module._bridge_lean_runtime_init(), 1);
  assert.equal(module._bridge_lean_runtime_status(), 2);
  assert.equal(module._bridge_lean_runtime_init_runs(), 1);
  assert.equal(module._bridge_lean_runtime_init(), 1);
  assert.equal(module._bridge_lean_runtime_init_runs(), 1);
  assert.equal(module._bridge_has_lean_alpha(), 1);

  const handle = module._bridge_lean_alpha_make(42);
  assert.notEqual(handle, 0);
  assert.equal(module._bridge_lean_handle_identity(handle), handle);
  assert.equal(module._bridge_lean_alpha_read(handle), 42);
  assert.equal(module._bridge_lean_alpha_read(handle), 42);
  assert.equal(module._bridge_lean_live_handles(), 1);
  assert.equal(module._bridge_lean_runtime_shutdown(), 0);
  assert.equal(module._bridge_lean_runtime_status(), 2);
  assert.equal(module._bridge_lean_release(handle), 0);
  assert.equal(module._bridge_lean_live_handles(), 0);
  assert.equal(module._bridge_lean_runtime_shutdown(), 1);
  assert.equal(module._bridge_lean_runtime_status(), 4);
  assert.equal(module._bridge_lean_runtime_shutdown(), 1);
  assert.equal(module._bridge_lean_runtime_init(), 0);
  assert.equal(module._bridge_lean_alpha_make(43), 0);
  assert.equal(module._bridge_lean_alpha_read(handle), -1);
};

test("startup module preserves the private Lean lifecycle invariants", async () => {
  const module = await createStartupModule();
  exerciseBox(module);
});

test("Init failure makes the application instance terminal", async () => {
  const module = await createLazyModule();

  assert.equal(module._bridge_lean_runtime_status(), 0);
  assert.equal(module._bridge_test_lean_runtime_force_init_error(), 1);
  assert.equal(module._bridge_lean_runtime_init(), 0);
  assert.equal(module._bridge_lean_runtime_status(), 3);
  assert.equal(module._bridge_lean_runtime_init_runs(), 1);
  assert.equal(module._bridge_lean_runtime_init(), 0);
  assert.equal(module._bridge_lean_runtime_init_runs(), 1);
  assert.equal(module._bridge_lean_runtime_shutdown(), 0);
  assert.equal(module._bridge_lean_alpha_make(42), 0);
});
