/**
 * Tests the host object generator behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import "./helpers/host-object-compiled.mjs";

import { executableHostFixture, hostFixture, hostMember, hostParameter, primitiveRef } from "./helpers/host-object-contract.mjs";
import {
	LeanHostObjectGenerationError,
	generateLeanHostObjectAdapters,
} from "../src/backends/lean/host-object.mjs";

test("Lean host adapters preserve native members, ownership, and target identity", () => {
  const files = generateLeanHostObjectAdapters(hostFixture());
  assert.deepEqual(files, generateLeanHostObjectAdapters(hostFixture()));
  const javascript = files["LeanBridge/Host/Javascript.lean"];
  const python = files["LeanBridge/Host/Python.lean"];
  assert.match(javascript, /opaque Box : Type/);
  assert.match(javascript, /opaque box \(value : _root_\.UInt32\) : _root_\.IO \(Box\)/);
  assert.match(javascript, /opaque read \(self : @& Box\) : _root_\.IO \(_root_\.UInt32\)/);
  assert.match(javascript, /receiver borrow, lifetime call/);
  assert.match(python, /lean_bridge_host_python_box_read/);

  const manifest = JSON.parse(files["host-object-manifest.json"]);
  assert.equal(manifest.resources[0].identity, "weak-canonical");
  assert.equal(manifest.handleTransport.public, false);
  assert.equal(manifest.handleTransport.generationSafe, true);
  assert.equal(manifest.resources[0].declarations[0].kind, "constructor");
});

test("host imports distinguish borrowed and consumed references, and reject unbound types", () => {
	const ir = executableHostFixture();
	const lean = generateLeanHostObjectAdapters(ir)["LeanBridge/Host/Python.lean"];
	assert.match(lean, /opaque sameAs \(self : @& Box\) \(other : @& Box\)/u);
	assert.match(lean, /opaque finish \(self : Box\)/u);
	hostMember(ir, "unbound", { parameters: [hostParameter("value", { kind: "apply", constructor: "host-null", arguments: [primitiveRef("uint32")] })] });
	assert.throws(() => generateLeanHostObjectAdapters(ir), { code: "unsupported-host-member-type" });
});

test("host adapters reject calls that omit the trusted host boundary", () => {
  const ir = hostFixture();
  ir.declarations.find(item => item.owner === "lean:Alpha.Box").effects = ["allocates"];
  assert.throws(
    () => generateLeanHostObjectAdapters(ir),
    error => error instanceof LeanHostObjectGenerationError && error.code === "missing-host-effect",
  );
});
