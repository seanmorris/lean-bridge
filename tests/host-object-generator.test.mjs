/**
 * Tests the host object generator behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import "./helpers/host-object-compiled.mjs";
import "./helpers/host-object-installed.mjs";
import "./helpers/host-object-project.mjs";
import "./helpers/lean-task-installed.mjs";
import "./helpers/lean-stream-only-installed.mjs";
import "./helpers/c-task-installed.mjs";
import { generatePythonHostExtension } from "../src/backends/python/host-exports.mjs";
import { generatePythonHostProvider } from "../src/backends/python/host-provider.mjs";

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

test("generated CPython providers refuse dynamic, asynchronous and unimplemented contracts", () => {
	for(const [change, why] of [
		[ir => { ir.types.find(t => t.host).host.dynamic = true; }, /statically declared/u]
		, [ir => { ir.declarations.find(d => d.name === "scale").resultMode = "promise"; }, /synchronous|promise/iu]
		, [ir => { ir.declarations.find(d => d.name === "box").result.lifetime.scope = "runtime"; }, /lifetime/u]
		, [ir => { hostMember(ir, "nested", { result: { type: { kind: "apply", constructor: "array", arguments: [primitiveRef("uint32")] }, ownership: "copy", lifetime: null } }); }, /copied scalar/u]
	]) {
		const ir = executableHostFixture(); change(ir);
		assert.throws(() => generatePythonHostProvider(ir), why);
	}
	const ir = executableHostFixture();
	const params = { ir, module: "Workshop", componentIdentity: "a".repeat(64), runtimeIdentity: "b".repeat(64) };
	const entry = { name: "read", declaration: "Workshop.read", parameters: [{ name: "box", type: { kind: "named", id: "lean:Alpha.Box" } }], result: primitiveRef("uint32") };
	const generate = entries => generatePythonHostExtension({ ...params, entries });
	assert.throws(() => generate([entry, entry]), /duplicate/u);
	assert.throws(() => generate([{ ...entry, name: "bind_hosts" }]), /duplicate/u);
	assert.throws(() => generate([{ ...entry, parameters: [...entry.parameters, ...entry.parameters] }]), /argument name/u);
	assert.throws(() => generate([{ ...entry, effect: "EIO", error: entry.parameters[0].type }]), /copied payloads/u);
	assert.throws(() => generate([{ ...entry, result: { kind: "apply", constructor: "result", arguments: [entry.result, entry.parameters[0].type] } }]), /copied payloads/u);
	const result = generate([entry]);
	assert.match(result.stub, /def read\(box: Box\) -> int:/u);
	assert.match(result.types, /@level.setter\n +def level\(self, value: int\) -> None:/u);
});
