import assert from "node:assert/strict";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
  LeanHostObjectGenerationError,
  generateLeanHostObjectAdapters,
} from "../src/backends/lean/host-object.mjs";

const clone = value => structuredClone(value);

const hostFixture = () => {
  const ir = clone(alpha.bindingIr);
  const box = ir.types.find(type => type.name === "Box");
  box.host = {
    targets: ["javascript", "python"],
    identity: "weak-canonical",
    dynamic: false,
  };
  for (const declaration of ir.declarations.filter(item => item.owner === box.id)) {
    if (!declaration.effects.includes("host-call")) declaration.effects.push("host-call");
  }
  return ir;
};

test("Lean host adapters preserve native members, ownership, and target identity", () => {
  const files = generateLeanHostObjectAdapters(hostFixture());
  assert.deepEqual(files, generateLeanHostObjectAdapters(hostFixture()));
  const javascript = files["LeanBridge/Host/Javascript.lean"];
  const python = files["LeanBridge/Host/Python.lean"];
  assert.match(javascript, /opaque Box : Type/);
  assert.match(javascript, /opaque box \(value : UInt32\) : IO \(Box\)/);
  assert.match(javascript, /opaque read \(self : @& Box\) : IO \(UInt32\)/);
  assert.match(javascript, /receiver borrow, lifetime call/);
  assert.match(python, /lean_bridge_host_python_box_read/);

  const manifest = JSON.parse(files["host-object-manifest.json"]);
  assert.equal(manifest.resources[0].identity, "weak-canonical");
  assert.equal(manifest.handleTransport.public, false);
  assert.equal(manifest.handleTransport.generationSafe, true);
  assert.equal(manifest.resources[0].declarations[0].kind, "constructor");
});

test("host adapters reject calls that omit the trusted host boundary", () => {
  const ir = hostFixture();
  ir.declarations.find(item => item.owner === "lean:Alpha.Box").effects = ["allocates"];
  assert.throws(
    () => generateLeanHostObjectAdapters(ir),
    error => error instanceof LeanHostObjectGenerationError && error.code === "missing-host-effect",
  );
});
