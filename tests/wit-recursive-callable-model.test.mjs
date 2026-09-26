/**
 * Preserve source signatures and nominal callable identities in finite WIT.
 * These checks compile the component, not Lean or an installed package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { compileCallableWitGraphModel } from "../src/backends/wit/callable-graph-model.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { jvmRecursiveMixedFixture } from "./helpers/jvm-recursive-callable-mixed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const interfaces = document => {
	const ref = id => typeof id === "string" || id === null ? id : document.types[id].name ?? shape(document.types[id].kind);
	const shape = kind => {
		if(kind === "resource") return kind;
		if(kind.type !== undefined) return { type: ref(kind.type) };
		if(kind.list !== undefined) return { list: ref(kind.list) };
		if(kind.option !== undefined) return { option: ref(kind.option) };
		if(kind.result) return { result: [ref(kind.result.ok), ref(kind.result.err)] };
		if(kind.tuple) return { tuple: kind.tuple.types.map(ref) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: ref(field.type) })) };
		if(kind.enum) return { enum: kind.enum.cases.map(branch => branch.name) };
		if(kind.variant) return { variant: kind.variant.cases.map(branch => ({ name: branch.name, type: ref(branch.type) })) };
		if(kind.handle) return Object.fromEntries(Object.entries(kind.handle).map(([key, type]) => [key, ref(type)]));
		assert.fail(`Unexpected WIT type ${JSON.stringify(kind)}`);
	};
	return Object.fromEntries(["native", "api"].map(name => {
		const iface = document.interfaces.find(item => item.name === name);
		return [name, {
			functions: Object.fromEntries(Object.entries(iface.functions).map(([name, fn]) => [
				name, {
				parameters: fn.params.map(site => ({ name: site.name, type: ref(site.type) }))
				, result: ref(fn.result)
				}
			]))
			, types: Object.fromEntries(Object.entries(iface.types).map(([name, id]) => [name, shape(document.types[id].kind)]))
		}];
	}));
};

for(const [fixture, exports, callbacks] of [["independent", 29, 16], ["nested", 33, 18], ["mixed", 98, 59]])
	test(`recursive WIT model compiles ${fixture} interfaces without coalescing callback identities`, {
		skip: process.env.LEAN_BRIDGE_WIT_RECURSIVE_CALLABLE_TEST !== "1"
	}, async t => {
		const ir = fixture === "independent" ? structuredCallableReviewedIr({ recursive: true })
			: fixture === "nested" ? nativeRecursiveCallableReviewedIr() : (await jvmRecursiveMixedFixture()).ir;
		const original = canonicalJson(ir), model = compileCallableWitGraphModel(ir);
		assert.equal(canonicalJson(ir), original);
		assert.equal(canonicalJson(model.ir), original);
		assert.equal(model.functions.length, exports);
		assert.equal(model.callbacks.size, callbacks);
		assert.equal(model.wire.resources.length, callbacks);
		assert.equal(new Set(model.wire.resources.map(resource => resource.witName)).size, callbacks);
		assert.equal(model.manifest.bindingIrSha256, hashBindingIr(ir));
		assert.equal(model.manifest.graph.wireBindingIrSha256, hashBindingIr(model.wireIr));
		assert.notEqual(model.manifest.bindingIrSha256, model.manifest.graph.wireBindingIrSha256);
		assert.equal(model.manifest.assuranceScope, "original-lean-binding-ir");
		assert.deepEqual(model.wireIr.assurance, []);
		assert.ok([...model.wireIr.types, ...model.wireIr.declarations].every(type => !type.assurance.length
			&& type.source.producer === "witCopiedGraph"
			&& type.source.extensions["lean-bridge.org/original-binding-ir-sha256"] === hashBindingIr(ir)));
		assert.deepEqual(model.manifest.deferred, ["resource-containing-aggregates", "retained-host-callbacks", "asynchronous-callables"]);
		assert.equal(model.manifest.native.layoutSha256, model.native.layoutSha256);
		assert.equal(model.manifest.native.descriptorSha256, sha256(canonicalJson(model.native.descriptor)));
		for(const contract of model.manifest.callables)
		{
			assert.equal(contract.parameter, "borrow"); assert.equal(contract.result, "own");
			assert.deepEqual(contract.signature, ir.types.find(type => type.id === contract.id).callable);
		}
		for(const fn of model.functions)
		{
			const contract = model.manifest.declarations.find(item => item.id === fn.declaration.id);
			assert.deepEqual(contract.parameters.map(item => item.type), fn.declaration.parameters.map(item => item.type));
			assert.deepEqual(contract.result.type, fn.declaration.result.type);
		}
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-recursive-model-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
		const run = args => processBuildRunner.capture({ command: "wasm-tools", args, cwd: root, timeoutMs: 60000 });
		await run(["parse", "model.wat", "-o", "model.wasm"]);
		await run(["validate", "--features", "component-model", "model.wasm"]);
		const declared = JSON.parse((await run(["component", "wit", "model.wit", "--json"])).stdout);
		const compiled = JSON.parse((await run(["component", "wit", "model.wasm", "--json"])).stdout);
		assert.deepEqual(interfaces(compiled), interfaces(declared));
	});

test("explicit WIT callback names reject missing, extra, invalid and conflicting identities", () => {
	const model = compileCallableWitGraphModel(nativeRecursiveCallableReviewedIr());
	const names = new Map(model.wire.resources.map(resource => [resource.type.id, resource.witName]));
	for(const mutate of [
		entries => entries.delete(entries.keys().next().value)
		, entries => entries.set("unknown:callback", "unknown-callback")
		, entries => entries.set(entries.keys().next().value, "BAD NAME")
		, entries => { const [first, second] = entries.keys(); entries.set(first, entries.get(second)); }
	]) {
		const changed = new Map(names); mutate(changed);
		assert.throws(() => compileCopiedWitModel(model.wireIr, {}, { callables: true, callableResourceNames: changed }), /callback identities|WIT name/);
	}
	assert.throws(() => compileCopiedWitModel(model.wireIr, {}, { callables: true, callableResourceNames: {} }), /callback identities/);
});

test("recursive callable model rejects retained callback ownership before wire lowering", () => {
	const ir = nativeRecursiveCallableReviewedIr();
	const parameter = ir.declarations[0].parameters.find(site => site.ownership === "borrow");
	parameter.lifetime.scope = "component";
	assert.throws(() => compileCallableWitGraphModel(ir));
});
