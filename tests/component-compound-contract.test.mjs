/**
 * Compound admission, canonical helper identities and failure containment.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assertComponentRecordAbi, assertComponentRecordBindings, resolveComponentRecordType } from "../src/abi/component-records.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { generateComponentRecordAdapters } from "../src/build/component-record-adapters.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../src/build/compiler-adapters.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { compileComponentCopiedCall } from "../src/release/component-copied-runtime.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

test("compound evidence binds both source paths and three browser engines to installed archives", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/npm-compounds-20260920.json", "utf8"));
	for(const [runs, result] of [[evidence.runs, { checks: 5197, primitives: 19, constructors: 3 }], [evidence.recordless, { checks: 3 }]])
	{
		assert.deepEqual(runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
		for(const run of runs)
		{
			assert.equal(run.sourceSha256, sha256(await readFile("tests/fixtures/onboarding/npm-compounds/Compounds.lean")));
			assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/compound-consumers/npm.mjs")));
			assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
			assert.equal(run.sourceRelocatedBeforeInstallation, true);
			assert.deepEqual(run.typescript, { strict: true, executed: true }); assert.deepEqual(run.result, result);
			assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox", "webkit"]);
			for(const browser of run.browsers)
				for(const profile of ["page", "react", "worker"]) assert.deepEqual(browser.result[profile], result);
			for(const archive of [run.receipt.package, run.receipt.runtime]) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
		}
		assert.equal(runs[0].receipt.runtime.sha256, runs[1].receipt.runtime.sha256);
		assert.equal(runs[0].receipt.componentArtifactSha256, runs[1].receipt.componentArtifactSha256);
	}
});

const plan = ir => generateCompilerAdapters({ analysis: {
	bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
	, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Compounds", status: "exportable" }))
}
, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });

test("compound callback syntax does not promote compiled callable admission", () => {
	for(const constructor of ["option", "result", "tuple"])
		for(const position of ["parameter", "result"])
		{
			const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
			const type = { kind: "apply", constructor, arguments: Array.from({ length: constructor === "option" ? 1 : 2 }, () => ({ kind: "primitive", name: "uint32" })) };
			if(position === "parameter") callback.callable.parameters[0].type = type;
			else callback.callable.result.type = type;
			assert.doesNotThrow(() => generateJavaScriptPackage(ir));
			assert.throws(() => createComponentPrivateAbi(ir));
		}
});

test("compound ABI agrees with schemas and retains helper symbols after canonical serialization", async () => {
	for(const recordless of [false, true])
	{
		const ir = compoundReviewedIr();
		if(recordless)
		{ ir.types = []; ir.declarations = ir.declarations.filter(d => d.name !== "transform"); }
		const generated = plan(ir), abi = generated.plan.privateAbi;
		validateCompilerAdapterPlan(generated.plan); await assertJsonSchema("compiler-adapter-plan", generated.plan);
		assert.equal(abi.version, 6); assert.equal(abi.dispatch, "copied-compound-frame-v1");
		assert.equal(abi.records.length, recordless ? 0 : 1);
		assertComponentRecordBindings(abi, ir);
		const canonical = JSON.parse(canonicalJson(abi)); assertComponentRecordBindings(canonical, ir);
		const lean = generated.files["LeanBridgeGenerated.lean"], c = generateComponentRecordAdapters(canonical);
		const exported = [...lean.matchAll(/@\[export ([A-Za-z0-9_]+)\]/g)].map(match => match[1]);
		assert.ok(exported.length > 200);
		for(const symbol of exported) assert.ok(c.includes(`${symbol}(`), `Missing C declaration for ${symbol}`);
		assert.match(lean, /match .* with \| \.none => 0 \| \.some _ => 1/);
		assert.match(lean, /match .* with \| \.ok _ => 0 \| \.error _ => 1/);
		assert.doesNotMatch(lean, /sorry|axiom|unsafeCast/);
		assert.match(c, /bridge_compound_children_validate/); assert.match(c, /bridge_compound_children_allocate/);
		assert.doesNotMatch(c, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/);
		assert.ok(c.lastIndexOf("_validate(&frame->args") < c.lastIndexOf("_decode(&frame->args"));
	}
});

test("compound descriptors bind result order, product nesting and exact pure copied semantics", () => {
	const ir = compoundReviewedIr(), abi = createComponentPrivateAbi(ir);
	for(const mutate of [
		value => { value.version = 5; value.dispatch = "copied-record-frame-v1"; }
		, value => { value.records = []; }
		, value => { value.extra = true; }
		, value => { value.exports.find(e => e.bindingId === "lean:Compounds.flip").parameters[0].arguments.reverse(); }
		, value => { value.exports.find(e => e.bindingId === "lean:Compounds.tuple_unit").result.arguments.push({ kind: "primitive", name: "unit" }); }
		, value => { value.records[0].fields[0].type.arguments[0].constructor = "list"; }
		, value => { value.records[0].fields[0].type = { kind: "named", id: value.records[0].id }; }
	]){
		const changed = structuredClone(abi); mutate(changed); assert.throws(() => assertComponentRecordBindings(changed, ir));
	}
	for(const mutate of [
		value => { value.declarations[0].parameters[0].ownership = "borrow"; }
		, value => { value.declarations[0].result.ownership = "lease"; }
		, value => { value.declarations[0].parameters[0].optional = true; }
		, value => { value.declarations[0].effects = ["host-call"]; }
		, value => { value.declarations[0].resultMode = "promise"; }
		, value => { value.types[0].representation = "identity"; }
		, value => { value.types[0].fields[0].mutability = "write"; }
	]){
		const changed = structuredClone(ir); mutate(changed); assert.throws(() => assertComponentRecordBindings(abi, changed));
	}
	let reads = 0;
	const changed = structuredClone(abi);
	Object.defineProperty(changed.exports[0].parameters[0], "arguments", { get: () => { reads++; return []; } });
	assert.throws(() => assertComponentRecordAbi(changed)); assert.equal(reads, 0);
	let deep = { kind: "primitive", name: "unit" };
	for(let i = 0; i < 33; i++) deep = { kind: "apply", constructor: "option", arguments: [deep] };
	assert.throws(() => resolveComponentRecordType(deep, [], true), /nesting/);
});

test("generated compound validators preserve tags and reject accessors before transport", async () => {
	const files = generateJavaScriptPackage(compoundReviewedIr());
	const validators = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	const good = { choice: { tag: "some", value: { ok: [42n, undefined] } }, products: [[1, "x"], [true, "🌱"]], rows: [], nested: { error: { tag: "none" } } };
	assert.doesNotThrow(() => validators.assertPacket(good, "packet"));
	let reads = 0;
	const getter = Object.defineProperty({ tag: "some" }, "value", { get: () => { reads++; return undefined; } });
	for(const choice of [null, { tag: "none", value: undefined }, { tag: "some" }, getter, { tag: "some", value: { ok: [1n, undefined], error: "bad" } }])
		assert.throws(() => validators.assertPacket({ ...good, choice }, "packet"));
	assert.throws(() => validators.assertPacket({ ...good, products: [1, "x", [true, "🌱"]] }, "packet"));
	assert.equal(reads, 0);
});

const fixture = (failAllocation = Infinity) => {
	const memory = new WebAssembly.Memory({ initial: 1 }), live = new Set();
	let next = 256, allocations = 0, cleared = 0, poisoned = false;
	const module = {
		HEAP8: new Uint8Array(memory.buffer)
		, _malloc: bytes => {
			if(++allocations === failAllocation) return 0;
			const pointer = next; next += Math.ceil(Math.max(bytes, 1) / 8) * 8;
			memory.grow(1); module.HEAP8 = new Uint8Array(memory.buffer); live.add(pointer); return pointer;
		}
		, _free: pointer => { assert.ok(live.delete(pointer)); }
		, _bridge_copied_frame_clear: () => { cleared++; }
	};
	return { module, live, view: () => new DataView(memory.buffer), poison: () => { poisoned = true; }, state: () => ({ cleared, poisoned }) };
};

test("compound allocation failures free arenas; invalid outputs and traps retire the heap", () => {
	const abi = createComponentPrivateAbi(compoundReviewedIr()), signature = abi.exports.find(e => e.bindingId === "lean:Compounds.option_string");
	for(const failure of [1, 2, 3, Infinity])
	{
		const f = fixture(failure);
		const call = compileComponentCopiedCall(f.module, () => assert.fail("bad input reached Lean"), signature, f.poison, 6, abi.records);
		assert.throws(() => call([{ tag: "some", value: null }]));
		assert.equal(f.live.size, 0); assert.equal(f.state().poisoned, false);
	}
	for(const operation of [
		() => { throw new WebAssembly.RuntimeError("trap"); }
		, (frame, f) => { f.view().setUint32(frame + 16, 34, true); f.view().setUint32(frame + 20, 1, true); return 0; }
	]){
		const f = fixture();
		const call = compileComponentCopiedCall(f.module, frame => operation(frame, f), signature, f.poison, 6, abi.records);
		assert.throws(() => call([{ tag: "none" }]));
		assert.deepEqual(f.state(), { cleared: 0, poisoned: true });
	}
	const f = fixture();
	const call = compileComponentCopiedCall(f.module, frame => { f.view().setUint32(frame + 8, 4, true); return 4; }, signature, f.poison, 6, abi.records);
	for(let i = 0; i < 10; i++) assert.throws(() => call([{ tag: "some", value: "x" }]), /budget/);
	assert.deepEqual(f.state(), { cleared: 10, poisoned: false }); assert.equal(f.live.size, 0);
});

test("missing compound runtimes and changed result order reject before fetching code", async t => {
	let reads = 0;
	t.mock.method(globalThis, "fetch", () => { reads++; assert.fail("invalid descriptor fetched code"); });
	for(const present of [false, true])
	{
		const module = {
			_bridge_lean_runtime_init: () => 1, FS: {}
			, _bridge_scalar_frame_clear: () => {}
			, _bridge_copied_abi: () => 1, _bridge_copied_frame_clear: () => {}
			, _bridge_record_abi: () => 1
			, ...(present ? { _bridge_compound_abi: () => 1 } : {})
		};
		const runtime = await createComponentRuntime(async () => module, new URL("file:///main.wasm"));
		const bindingIr = compoundReviewedIr(), privateAbi = structuredClone(createComponentPrivateAbi(bindingIr));
		if(present) privateAbi.exports.find(e => e.bindingId === "lean:Compounds.flip").result.arguments.reverse();
		await assert.rejects(runtime.loadComponent({ id: "compounds", sideModule: new URL("https://example.invalid/component.wasm"), bindingIr, privateAbi }), /compound ABI|type/);
	}
	assert.equal(reads, 0);
});
