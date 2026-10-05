/**
 * Nominal binding checks and independent copied-record wire/host validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assertComponentRecordAbi, assertComponentRecordBindings, resolveComponentRecordType } from "../src/abi/component-records.mjs";
import { createComponentCopyBudget } from "../src/abi/component-copied.mjs";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";
import { compileComponentCopiedCall } from "../src/release/component-copied-runtime.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { generateComponentRecordAdapters } from "../src/build/component-record-adapters.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { recordReviewedIr } from "./helpers/record-fixture.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

const primitive = name => ({ kind: "primitive", name });
test("record evidence binds both source paths to installed packages in three browser engines", async () => {
	const record = JSON.parse(await readFile("docs/evidence/npm-records-20260920.json", "utf8"));
	assert.deepEqual(record.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs)
	{
		assert.equal(run.sourceSha256, sha256(await readFile("tests/fixtures/onboarding/npm-records/Records.lean")));
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/record-consumers/npm.mjs")));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRelocatedBeforeInstallation, true);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		assert.deepEqual(run.result, { checks: 4257, primitives: 19, records: 7 });
		assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox", "webkit"]);
		for(const browser of run.browsers)
			for(const profile of ["page", "react", "worker"]) assert.deepEqual(browser.result[profile], run.result);
		for(const artifact of [run.receipt.package, run.receipt.runtime]) assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
	}
	assert.equal(record.runs[0].receipt.runtime.sha256, record.runs[1].receipt.runtime.sha256);
	assert.equal(record.runs[0].receipt.componentArtifactSha256, record.runs[1].receipt.componentArtifactSha256);
});
const small = { kind: "record", id: "lean:Record", fields: [{ name: "value", type: primitive("uint32") }, { name: "text", type: primitive("string") }] };
const fixture = (fail = Infinity) => {
	const memory = new WebAssembly.Memory({ initial: 1 }), live = new Set();
	let next = 256, calls = 0, cleared = 0, poisoned = false;
	const module = {
		HEAP8: new Uint8Array(memory.buffer)
		, _malloc: bytes => {
			if(++calls === fail) return 0;
			const pointer = next; next += Math.ceil(Math.max(bytes, 1) / 8) * 8;
			memory.grow(1); module.HEAP8 = new Uint8Array(memory.buffer); live.add(pointer); return pointer;
		}
		, _free: pointer => { assert.ok(live.delete(pointer)); }
		, _bridge_copied_frame_clear: () => { cleared++; }
	};
	return { module, live, allocate: module._malloc
		, view: () => new DataView(memory.buffer)
		, poison: () => { poisoned = true; }, state: () => ({ cleared, poisoned }) };
};

test("record compiler plans use typed Lean constructors and carriers without guessing layouts", async () => {
	const ir = recordReviewedIr(), abi = createComponentPrivateAbi(ir);
	assert.equal(abi.version, 5); assertComponentRecordBindings(abi, ir);
	assertComponentRecordBindings(JSON.parse(canonicalJson(abi)), ir);
	const generated = generateCompilerAdapters({ analysis: {
		bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
		, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Records", status: "exportable" }))
	}
	, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	const lean = generated.files["LeanBridgeGenerated.lean"], c = generateComponentRecordAdapters(abi);
	assert.match(lean, /if bound : 0 < value.size then value\[0\]'bound/);
	assert.match(lean, /Array _root_\.Records\.Single/); assert.match(lean, /«second» :=/);
	assert.doesNotMatch(lean, /sorry|unsafeCast|axiom/);
	assert.match(c, /bridge_record_children_validate/); assert.match(c, /bridge_record_children_allocate/);
	assert.doesNotMatch(c, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/);
	assert.ok(c.lastIndexOf("_validate(&frame->args") < c.lastIndexOf("_decode(&frame->args"));
});

test("record ABI rejects mismatched nominal identities, fields, ownership and unsupported kinds", () => {
	const ir = recordReviewedIr(), abi = createComponentPrivateAbi(ir);
	for(const mutate of [
		value => { value.records[0].extra = true; }
		, value => { value.records[0].fields.push({ name: "extra", type: primitive("bool") }); }
		, value => { value.records.find(r => r.fields.length > 1).fields.reverse(); }
		, value => { value.records[1].id = value.records[0].id; }
		, value => { value.records[0].fields = [{ name: "constructor", type: primitive("bool") }]; }
		, value => { value.records[0].fields = [{ name: "self", type: { kind: "named", id: value.records[0].id } }]; }
		, value => { value.records[0].fields = [{ name: "option", type: { kind: "apply", constructor: "option", arguments: [primitive("bool")] } }]; }
		, value => { value.exports[0].resultMode = "promise"; }
		, value => { value.exports[1].symbol = value.exports[0].symbol; }
	]){
		const changed = structuredClone(abi); mutate(changed); assert.throws(() => assertComponentRecordBindings(changed, ir));
	}
	for(const mutate of [
		value => { value.types[0].representation = "identity"; }
		, value => { value.types[0].fields[0].mutability = "write"; }
		, value => { value.declarations[0].parameters[0].ownership = "borrow"; }
		, value => { value.declarations[0].effects = ["host-call"]; }
		, value => { value.declarations[0].parameters[0].type.id = "lean:Records.Single"; }
	]){
		const changed = structuredClone(ir); mutate(changed); assert.throws(() => assertComponentRecordBindings(abi, changed));
	}
});

test("record definitions reject accessors, excessive nesting and recursive named references", () => {
	const abi = createComponentPrivateAbi(recordReviewedIr());
	let reads = 0;
	const changed = structuredClone(abi);
	Object.defineProperty(changed.records[0].fields, 0, { get: () => { reads++; return {}; } });
	assert.throws(() => assertComponentRecordAbi(changed)); assert.equal(reads, 0);
	let type = primitive("bool");
	for(let i = 0; i < 33; i++) type = { kind: "apply", constructor: "array", arguments: [type] };
	assert.throws(() => resolveComponentRecordType(type, abi.records), /nesting/);
	const snapshot = resolveComponentRecordType({ kind: "named", id: "lean:Records.Packet" }, abi.records);
	assert.ok(Object.isFrozen(snapshot.fields)); assert.ok(Object.isFrozen(snapshot.fields[0].type));
	assert.throws(() => resolveComponentRecordType({ kind: "named", id: "lean:Unknown" }, abi.records), /unknown/);
});

test("record decoder reads independently populated native-owned field slots", () => {
	const f = fixture(), codec = compileComponentCopiedCodec(small), slot = 64, children = 128, payload = 192;
	const data = f.view();
	data.setUint32(slot, 36, true); data.setUint32(slot + 4, 2, true); data.setUint32(slot + 8, children, true); data.setUint32(slot + 12, 2, true);
	data.setUint32(children, 4, true); data.setUint32(children + 8, 0xffffffff, true);
	data.setUint32(children + 16, 14, true); data.setUint32(children + 20, 2, true); data.setUint32(children + 24, payload, true); data.setUint32(children + 28, 5, true);
	f.module.HEAP8.set([0xf0, 0x9f, 0x8c, 0xb1, 0], payload);
	assert.deepEqual(codec.read(f.module, slot), { value: 0xffffffff, text: "🌱\0" });
	for(const [offset, value] of [[0, 32], [4, 3], [8, 129], [12, 1], [8, 0]])
	{
		const original = data.getUint32(slot + offset, true); data.setUint32(slot + offset, value, true);
		assert.throws(() => codec.read(f.module, slot)); data.setUint32(slot + offset, original, true);
	}
	assert.throws(() => codec.read(f.module, slot, createComponentCopyBudget(48)), /budget/);
});

test("record host values require exact own data fields and independent storage", () => {
	const f = fixture(), codec = compileComponentCopiedCodec(small), input = { value: 7, text: "\uFEFF🌱\0" };
	codec.write(f.module, 64, input, f.allocate);
	const output = codec.read(f.module, 64); assert.deepEqual(output, input); assert.notEqual(output, input);
	let reads = 0;
	const getter = { ...input }; Object.defineProperty(getter, "value", { get: () => { reads++; return 7; } });
	for(const bad of [getter, {}, { ...input, extra: 1 }, { ...input, [Symbol("extra")]: 1 }, Object.create(input), null, [], { ...input, value: -1 }])
		assert.throws(() => codec.write(f.module, 64, bad, f.allocate));
	assert.equal(reads, 0);
});

test("partial record input failures free arenas, while malformed record output poisons", () => {
	const abi = createComponentPrivateAbi(recordReviewedIr()), signature = abi.exports.find(e => e.bindingId === "lean:Records.make");
	const takesPair = { ...signature, parameters: [signature.result] };
	for(const failure of [1, 2, 3, Infinity])
	{
		const f = fixture(failure);
		const call = compileComponentCopiedCall(f.module, () => assert.fail("invalid input reached Lean"), takesPair, f.poison, 5, abi.records);
		assert.throws(() => call([{ first: 1, second: null }]));
		assert.equal(f.live.size, 0); assert.equal(f.state().poisoned, false);
	}
	const f = fixture();
	const call = compileComponentCopiedCall(f.module, frame => { f.view().setUint32(frame + 16, 36, true); return 0; }, signature, f.poison, 5, abi.records);
	assert.throws(() => call([]), /shape/); assert.deepEqual(f.state(), { cleared: 0, poisoned: true });
});

test("generated record validators reject getters without evaluating them", async () => {
	const files = generateJavaScriptPackage(recordReviewedIr());
	const validators = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	let reads = 0;
	const getter = Object.defineProperty({}, "value", { get: () => { reads++; return 1n; }, enumerable: true });
	assert.throws(() => validators.assertSingle(getter, "single"), /own data fields/); assert.equal(reads, 0);
	assert.throws(() => validators.assertSingle(Object.create({ value: 1n }), "single"), /plain record/);
	assert.throws(() => validators.assertEmpty({ [Symbol("extra")]: true }, "empty"), /does not match/);
});

test("old record runtimes and changed field tables reject before fetching code", async t => {
	let reads = 0;
	t.mock.method(globalThis, "fetch", () => { reads++; assert.fail("invalid descriptor fetched code"); });
	for(const present of [false, true])
	{
		const module = {
			_bridge_lean_runtime_init: () => 1, FS: {}
			, _bridge_scalar_frame_clear: () => {}
			, _bridge_copied_abi: () => 1, _bridge_copied_frame_clear: () => {}
			, ...(present ? { _bridge_record_abi: () => 1 } : {}) };
		const runtime = await createComponentRuntime(async () => module, new URL("file:///main.wasm"));
		const bindingIr = recordReviewedIr(), privateAbi = createComponentPrivateAbi(bindingIr);
		if(present) privateAbi.records.find(record => record.fields.length > 1).fields.reverse();
		await assert.rejects(runtime.loadComponent({ id: "records", sideModule: new URL("https://example.invalid/component.wasm"), bindingIr, privateAbi }), /record ABI|record field/);
	}
	assert.equal(reads, 0);
});
