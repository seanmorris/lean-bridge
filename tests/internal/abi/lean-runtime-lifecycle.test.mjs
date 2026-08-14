/**
 * Tests the Lean runtime lifecycle behavior.
 *
 * @file
 */

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
	assert.equal(handle >>> 31, 0);
	assert.equal((handle >>> 24) & 0x7f, 1);
	assert.notEqual((handle >>> 12) & 0x0fff, 0);
	assert.notEqual(handle & 0x0fff, 0);
	assert.equal(module._bridge_lean_handle_identity(handle), handle);
	assert.equal(module._bridge_lean_alpha_read(handle), 42);
	assert.equal(module._bridge_lean_alpha_read(handle), 42);
	const rejectedBefore = module._bridge_lean_rejected_handles();
	assert.equal(module._bridge_lean_alpha_read(handle ^ (3 << 24)), -1);
	assert.equal(module._bridge_lean_alpha_read(handle | 0x8000_0000), -1);
	assert.equal(module._bridge_lean_rejected_handles(), rejectedBefore + 2);
	assert.equal(module._bridge_lean_handle_capacity(), 1024);
	assert.equal(module._bridge_lean_retired_handle_slots(), 0);
	assert.equal(module._bridge_lean_live_handles(), 1);
	assert.equal(module._bridge_lean_runtime_shutdown(), 0);
	assert.equal(module._bridge_lean_runtime_status(), 2);
	assert.equal(module._bridge_lean_release(handle), 0);
	assert.equal(module._bridge_lean_live_handles(), 0);
	const replacement = module._bridge_lean_alpha_make(43);
	assert.notEqual(replacement, handle);
	assert.equal(module._bridge_lean_alpha_read(handle), -1);
	assert.equal(module._bridge_lean_alpha_read(replacement), 43);
	assert.equal(module._bridge_lean_release(handle), -1);
	assert.equal(module._bridge_lean_release(replacement), 0);
	assert.equal(module._bridge_lean_runtime_shutdown(), 1);
	assert.equal(module._bridge_lean_runtime_status(), 4);
	assert.equal(module._bridge_lean_runtime_shutdown(), 1);
	assert.equal(module._bridge_lean_runtime_init(), 0);
	assert.equal(module._bridge_lean_alpha_make(44), 0);
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

test("an unused runtime can shut down without running Init", async () => {
  const module = await createLazyModule();

  assert.equal(module._bridge_lean_runtime_status(), 0);
  assert.equal(module._bridge_lean_runtime_shutdown(), 1);
  assert.equal(module._bridge_lean_runtime_status(), 4);
  assert.equal(module._bridge_lean_runtime_init_runs(), 0);
  assert.equal(module._bridge_lean_runtime_init(), 0);
});

test("the Lean registry fails closed at its declared capacity", async () => {
  const module = await createStartupModule();
  assert.equal(module._bridge_lean_runtime_init(), 1);
  const capacity = module._bridge_lean_handle_capacity();
  const handles = [];

  for(let index = 0; index < capacity; index += 1)
{
    const handle = module._bridge_lean_alpha_make(index);
    assert.notEqual(handle, 0);
    handles.push(handle);
}
  assert.equal(module._bridge_lean_live_handles(), capacity);
  assert.equal(module._bridge_lean_alpha_make(capacity), 0);
  assert.equal(module._bridge_lean_live_handles(), capacity);

  for(const handle of handles) module._bridge_lean_release(handle);
  assert.equal(module._bridge_lean_live_handles(), 0);
  assert.equal(module._bridge_lean_runtime_shutdown(), 1);
});
