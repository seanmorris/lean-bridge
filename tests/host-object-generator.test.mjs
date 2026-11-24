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
import "./helpers/python-retained-task-installed.mjs";
import "./helpers/lean-stream-only-installed.mjs";
import "./helpers/c-task-installed.mjs";
import "./helpers/c-retained-task-installed.mjs";
import "./helpers/c-task-broker-coexistence.mjs";
import "./helpers/cpp-task-installed.mjs";
import "./helpers/cpp-retained-task-installed.mjs";
import "./helpers/cpp-task-abi-coexistence.mjs";
import "./helpers/task-integer-installed.mjs";
import "./helpers/resource-task-installed.mjs";
import "./helpers/rust-task-installed.mjs";
import "./helpers/native-effect-policy.mjs";
import "./helpers/native-sync-io.mjs";
import "./helpers/native-sync-peer.mjs";
import "./helpers/ruby-sync-installed.mjs";
import "./helpers/ruby-host-provider.mjs";
import "./helpers/ruby-task-installed.mjs";
import "./helpers/ruby-retained-task-installed.mjs";
import "./helpers/ruby-resource-installed.mjs";
import "./helpers/dotnet-io-installed.mjs";
import "./helpers/jvm-io-installed.mjs";
import "./helpers/jvm-tasks-installed.mjs";
import "./helpers/jvm-retained-installed.mjs";
import "./helpers/jvm-resource-installed.mjs";
import "./helpers/jvm-lease-tasks-installed.mjs";
import "./helpers/perl-io-installed.mjs";
import "./helpers/perl-tasks-installed.mjs";
import "./helpers/perl-retained-registration.mjs";
import "./helpers/perl-retained-packages.mjs";
import "./helpers/perl-retained-consumers.mjs";
import "./helpers/perl-heap-identity.mjs";
import "./helpers/perl-lease-packages.mjs";
import "./helpers/perl-lease-consumers.mjs";
import "./helpers/perl-lease-pin.mjs";
import "./helpers/php-sync-installed.mjs";
import "./helpers/php-wasm-io-core.mjs";
import "./helpers/php-wasm-io-installed.mjs";
import "./helpers/php-wasm-io-source-project.mjs";
import "./helpers/php-wasm-io-codec.mjs";
import "./helpers/php-sync-consumers.mjs";
import "./helpers/php-sync-reproduction.mjs";
import "./helpers/php-sync-evidence.mjs";
import "./helpers/php-lease-installed.mjs";
import "./helpers/php-lease-consumers.mjs";
import "./helpers/php-lease-contract.mjs";
import "./helpers/php-task-installed.mjs";
import "./helpers/php-task-consumers.mjs";
import "./helpers/php-task-contract.mjs";
import "./helpers/php-task-lease-contract.mjs";
import "./helpers/php-retained-installed.mjs";
import "./helpers/php-retained-consumers.mjs";
import "./helpers/php-retained-contract.mjs";
import "./helpers/perl-task-consumers.mjs";
import "./helpers/dotnet-task-installed.mjs";
import "./helpers/dotnet-task-managed-replay.mjs";
import "./helpers/dotnet-resource-installed.mjs";
import "./helpers/python-resource-installed.mjs";
import "./helpers/native-task-companions.mjs";
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
	const host = entry.parameters[0].type, sum = { kind: "apply", constructor: "result", arguments: [entry.result, host] };
	assert.match(generate([{ ...entry, effect: "EIO", error: host, result: sum }]).stub, /Ok\[int\] \| Err\[Box\]/u);
	const unknown = { ...sum, arguments: [entry.result, {kind: "named", id: "other:Box"}] };
	assert.throws(() => generate([{ ...entry, result: unknown }]), /copied payloads/u);
	for(const parameters of [[], [{name: "f", type: {kind: "io-callback", argument: entry.result, reply: entry.result}}]])
	{
		for(const [result, error] of [[host, entry.result], [entry.result, sum]])
			assert.throws(() => generate([{ ...entry, parameters, delivery: "task", effect: "EIO", result, error }]), /copied carriers or checked Lean resources/u);
	}
	const result = generate([entry]);
	assert.match(result.stub, /def read\(box: Box\) -> int:/u);
	assert.match(result.types, /@level.setter\n +def level\(self, value: int\) -> None:/u);
});
