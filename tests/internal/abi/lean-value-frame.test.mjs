import assert from "node:assert/strict";
import test from "node:test";

import createLazyModule from "../../../build/lean-link-spike/lazy/main.mjs";
import { alpha } from "../../../poc/lean-link-spike/descriptors.mjs";
import { createLibraryLoader } from "../../../poc/link-spike/loader.mjs";

const frameBytes = 60;

const createFrame = module => {
  const pointer = module._malloc(frameBytes);
  assert.notEqual(pointer, 0);
  const reset = () => {
    const frame = new DataView(module.HEAP8.buffer, pointer, frameBytes);
    for (let offset = 0; offset < frameBytes; offset += 4) {
      frame.setUint32(offset, 0, true);
    }
    frame.setUint32(0, 1, true);
    frame.setUint32(4, frameBytes, true);
    return frame;
  };
  const read = offset =>
    new DataView(module.HEAP8.buffer, pointer, frameBytes).getUint32(
      offset,
      true,
    );
  return { pointer, reset, read, dispose: () => module._free(pointer) };
};

test("private value frame rejects version, size, boolean, and limit drift", async () => {
  const module = await createLazyModule();
  await createLibraryLoader(module).load(alpha);
  assert.equal(module._bridge_lean_runtime_init(), 1);
  const frame = createFrame(module);

  try {
    frame.reset().setUint32(0, 2, true);
    assert.equal(module._bridge_lean_alpha_round_trip(frame.pointer), 1);
    assert.equal(frame.read(8), 1);

    frame.reset().setUint32(4, frameBytes - 4, true);
    assert.equal(module._bridge_lean_alpha_round_trip(frame.pointer), 2);

    frame.reset().setUint32(16, 2, true);
    assert.equal(module._bridge_lean_alpha_round_trip(frame.pointer), 4);

    frame.reset().setUint32(28, 1024 * 1024 + 1, true);
    assert.equal(module._bridge_lean_alpha_round_trip(frame.pointer), 5);
    assert.equal(module._bridge_lean_active_frames(), 0);
  } finally {
    frame.dispose();
  }
});

test("copied-value arenas return to zero after repeated native calls", async () => {
  const module = await createLazyModule();
  const loadedAlpha = await createLibraryLoader(module).load(alpha);
  const input = {
    enabled: true,
    count: 0xffff_fffe,
    label: "repeat λ",
    bytes: new Uint8Array([0, 64, 128, 255]),
    values: [1, 2, 3, 0xffff_ffff],
  };

  for (let index = 0; index < 1_000; index += 1) {
    const output = loadedAlpha.roundTrip(input);
    assert.equal(output.enabled, false);
    assert.equal(output.count, 0xffff_ffff);
    assert.equal(module._bridge_lean_active_frames(), 0);
  }
  assert.equal(module._bridge_lean_live_handles(), 0);
});
