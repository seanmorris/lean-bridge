/**
 * List identity, typed conversion, staged admission and bounded failure handling.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertComponentStructuredCallableBindings } from "../src/abi/component-structured-callables.mjs";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validateComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { canonicalizeJsonValue, parseBindingIr } from "../src/binding-ir/canonical.mjs";
import { assertComponentRecordBindings } from "../src/abi/component-records.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../src/build/compiler-adapters.mjs";
import { generateComponentRecordAdapters } from "../src/build/component-record-adapters.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { compileComponentCopiedCodec } from "../src/release/component-copied-codec.mjs";
import { compileComponentCopiedCall } from "../src/release/component-copied-runtime.mjs";
import { createNativeModel, createPhpWasmCopiedModel } from "../src/build/native-model.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { createElaboratedSemanticModel } from "../src/analyze/semantic-model.mjs";
import { reconcileReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const primitive = name => ({ kind: "primitive", name }), list = type => ({ kind: "apply", constructor: "list", arguments: [type] });
const plan = ir => generateCompilerAdapters({ analysis: {
	bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
	, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Lists", status: "exportable" }))
}
, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });

test("List remains distinct from Array through schemas, review and private ABI", async () => {
	const ir = listReviewedIr();
	parseBindingIr(canonicalJson(ir)); await assertJsonSchema("binding-ir", ir);
	const generated = plan(ir), abi = JSON.parse(canonicalJson(generated.plan.privateAbi));
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	assert.equal(abi.version, 6); assertComponentRecordBindings(abi, ir);
	const changed = structuredClone(abi);
	changed.exports.find(item => item.bindingId === "lean:Lists.reverse_uint32").parameters[0].constructor = "array";
	assert.throws(() => assertComponentRecordBindings(changed, ir), /mismatch/);
	const review = structuredClone(ir);
	review.declarations.find(item => item.id === "lean:Lists.reverse_uint32").parameters[0].type.constructor = "array";
	assert.throws(() => reconcileReviewedSource(review, ir, {}), { code: "reviewed-ir-source-mismatch" });
	for(const count of [0, 2])
	{
		const bad = structuredClone(ir);
		bad.declarations[0].parameters[0].type.arguments = Array(count).fill(primitive("uint32"));
		assert.throws(() => parseBindingIr(canonicalJson(bad)));
		assert.throws(() => validateCompilerAdapterPlan({ ...generated.plan, privateAbi: { ...abi, exports: [{ ...abi.exports[0], parameters: [bad.declarations[0].parameters[0].type] }] } }));
	}
});

test("typed List adapters never inspect cons tags and bound intermediate output", () => {
	for(const records of [true, false])
	{
		const ir = listReviewedIr();
		if(!records)
		{ ir.types = []; ir.declarations = ir.declarations.filter(d => d.name !== "transform"); }
		const generated = plan(ir), lean = generated.files["LeanBridgeGenerated.lean"], c = generateComponentRecordAdapters(generated.plan.privateAbi);
		assert.match(lean, /_root_\.List/); assert.match(lean, /\.toList/); assert.match(lean, /loop 1048577 values #\[\]/);
		assert.doesNotMatch(lean, /sorry|axiom|unsafeCast/);
		assert.doesNotMatch(c, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/);
		for(const [, symbol] of lean.matchAll(/@\[export ([A-Za-z0-9_]+)\]/g)) assert.ok(c.includes(`${symbol}(`), symbol);
		assert.ok(c.lastIndexOf("_validate(&frame->args") < c.lastIndexOf("_decode(&frame->args"));
	}
});

test("native and PHP-Wasm models preserve Lists; npm callbacks use structured admission", () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const type = { kind: "list", element: projection.result, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	validateNativeType(type);
	for(const nested of [type, { kind: "array", element: type, abi: type.abi }, { kind: "option", element: type, abi: type.abi }])
	{
		projection.result = nested;
		const semantic = createElaboratedSemanticModel({ metadata: input.metadata, request: input.sourceIdentity.request, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, elaborationSha256: "1".repeat(64) });
		assert.ok(JSON.stringify(semantic.document).includes('"constructor":"list"'));
		assert.ok(createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } }).types.some(value => value.kind === "list"));
		assert.ok(createPhpWasmCopiedModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } }).types.some(value => value.kind === "list"));
	}
	assert.throws(() => compilePrimitiveCSurface(listReviewedIr(), { compounds: true, callables: true }), { code: "unsupported-native-c-signature" });
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		if(position === "parameter") callback.callable.parameters[0].type = list(primitive("uint32"));
		else callback.callable.result.type = list(primitive("uint32"));
		const admitted = createComponentPrivateAbi(ir);
		assert.equal(admitted.version, 9);
		assertComponentStructuredCallableBindings(admitted, ir);
	}
});

test("List validators reject sparse, accessor and typed arrays without invoking getters", async () => {
	const files = generateJavaScriptPackage(listReviewedIr());
	const name = `assertApplied$${sha256(canonicalizeJsonValue(list(primitive("uint32")), "validator")).slice(0, 20)}`;
	const { [name]: validate } = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	let reads = 0;
	const getter = Object.defineProperty([1], 0, { get: () => { reads++; return 1; } });
	for(const value of [new Array(2), getter, new Uint32Array([1]), [1n], [-1], Object.assign([1], { extra: 1 })]) assert.throws(() => validate(value, "list"));
	validate([], "list"); validate([0, 42], "list"); assert.equal(reads, 0);
});

test("List validators cannot collide with a source record named ListOfUint32", async () => {
	const ir = listReviewedIr(); ir.types[0].name = "ListOfUint32";
	const files = generateJavaScriptPackage(ir);
	const validators = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	assert.equal(typeof validators.assertListOfUint32, "function");
	assert.doesNotThrow(() => validators.assertListOfUint32({ sequences: [], branches: [], buffers: [], arrays: [] }, "record"));
	assert.throws(() => validators.assertListOfUint32([1], "record"));
});

const memoryFixture = (failure = Infinity) => {
	const memory = new WebAssembly.Memory({ initial: 1 }), live = new Set();
	let next = 256, count = 0, clears = 0, poisoned = false;
	const module = { HEAP8: new Uint8Array(memory.buffer)
		, _malloc: bytes => {
			if(++count === failure) return 0;
			const pointer = next; next += Math.ceil(Math.max(bytes, 1) / 8) * 8;
			memory.grow(1); module.HEAP8 = new Uint8Array(memory.buffer); live.add(pointer); return pointer;
		}
		, _free: pointer => { assert.ok(live.delete(pointer)); }
		, _bridge_copied_frame_clear: () => { clears++; }
	};
	return { module, live, view: () => new DataView(memory.buffer), poison: () => { poisoned = true; }, state: () => ({ clears, poisoned }) };
};

test("List slots retain sequence layout and reject malformed output", () => {
	const codec = compileComponentCopiedCodec(list(primitive("uint32"))), f = memoryFixture();
	const slot = f.module._malloc(16);
	codec.write(f.module, slot, [42, 7], f.module._malloc);
	assert.deepEqual([...new Uint32Array(f.module.HEAP8.buffer, slot, 4)], [32, 0, 272, 2]);
	assert.deepEqual(codec.read(f.module, slot), [42, 7]);
	const saved = f.module.HEAP8.slice(slot, slot + 16);
	for(const [offset, value] of [[0, 33], [4, 1], [8, 1], [12, 0xffffffff]])
	{
		f.module.HEAP8.set(saved, slot); f.view().setUint32(slot + offset, value, true);
		assert.throws(() => codec.read(f.module, slot));
	}
	for(const pointer of [...f.live]) f.module._free(pointer);
	const cyclic = []; cyclic.push(cyclic);
	const nested = compileComponentCopiedCodec(list(list(primitive("uint32"))));
	assert.throws(() => nested.write(f.module, slot, cyclic, f.module._malloc), /Cyclic/);
	for(const pointer of [...f.live]) f.module._free(pointer);
});

test("List arenas clean partial inputs; budget errors recover and traps retire the heap", () => {
	const abi = createComponentPrivateAbi(listReviewedIr()), signature = abi.exports.find(e => e.bindingId === "lean:Lists.reverse_string");
	for(const failure of [1, 2, 3, 4, Infinity])
	{
		const f = memoryFixture(failure);
		const call = compileComponentCopiedCall(f.module, () => assert.fail("invalid input reached Lean"), signature, f.poison, 6, abi.records);
		assert.throws(() => call([failure === Infinity ? ["valid", null] : ["first", "second"]]), failure === Infinity ? TypeError : /allocation failed/);
		assert.equal(f.live.size, 0); assert.equal(f.state().poisoned, false);
	}
	for(const corrupt of [false, true])
	{
		const f = memoryFixture();
		const call = compileComponentCopiedCall(f.module, frame => {
			if(!corrupt) throw new WebAssembly.RuntimeError("List trap");
			f.view().setUint32(frame + 16, 32, true); f.view().setUint32(frame + 28, 1, true); return 0;
		}, signature, f.poison, 6, abi.records);
		assert.throws(() => call([[]])); assert.deepEqual(f.state(), { clears: 0, poisoned: true });
	}
	const f = memoryFixture();
	const call = compileComponentCopiedCall(f.module, frame => { f.view().setUint32(frame + 8, 4, true); return 4; }, signature, f.poison, 6, abi.records);
	for(let i = 0; i < 10; i++) assert.throws(() => call([["x"]]), /budget/);
	assert.deepEqual(f.state(), { clears: 10, poisoned: false }); assert.equal(f.live.size, 0);
});

test("List evidence binds installed archives, all five npm profiles and both source paths", async () => {
	const record = JSON.parse(await readFile("docs/evidence/npm-lists-20260920.json", "utf8"));
	for(const [path, hash] of Object.entries(record.sourceHashes))
	{
		// Preserve the recorded admission contract now that another host admits Lists.
		// Executed consumer, build driver, Lean fixture and signature hashes stay current.
		const source = path === "tests/component-list-contract.test.mjs"
			? "tests/fixtures/evidence/npm-lists-contract-20260920.mjs.txt" : path;
		assert.equal(sha256(await readFile(source)), hash, path);
	}
	assert.deepEqual(record.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const expected = { checks: 30226, primitives: 19, rejections: 25 };
	for(const run of record.runs)
	{
		assert.equal(run.sourceSha256, record.sourceHashes["tests/fixtures/onboarding/npm-lists/Lists.lean"]);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/list-consumers/npm.mjs"]);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRelocatedBeforeInstallation, true);
		assert.deepEqual(run.typescript, { strict: true, executed: true }); assert.deepEqual(run.result, expected);
		assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox", "webkit"]);
		for(const browser of run.browsers)
			for(const context of ["page", "react", "worker"]) assert.deepEqual(browser.result[context], expected);
		validateComponentPackageReceipt(run.receipt);
		assert.equal(run.receipt.component.id, "lists@1.0.0");
	}
	assert.equal(record.runs[0].receipt.runtime.sha256, record.runs[1].receipt.runtime.sha256);
	assert.equal(record.runs[0].receipt.componentArtifactSha256, record.runs[1].receipt.componentArtifactSha256);
});
