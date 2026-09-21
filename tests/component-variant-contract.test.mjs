/**
 * Named copied descriptors, typed adapters and adversarial host validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { parseBindingIr } from "../src/binding-ir/canonical.mjs";
import { assertComponentRecordAbi, assertComponentRecordBindings, resolveComponentRecordType } from "../src/abi/component-records.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { generateComponentRecordAdapters } from "../src/build/component-record-adapters.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { compileComponentCopiedCall } from "../src/release/component-copied-runtime.mjs";
import { validateComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { variantReviewedIr } from "./helpers/variant-fixture.mjs";
import { recordReviewedIr } from "./helpers/record-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const plan = ir => generateCompilerAdapters({ analysis: {
	bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
	, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Variants", status: "exportable" }))
}
, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });

test("nominal ABI authenticates constructors, field order and immutable copied semantics", async () => {
	const ir = variantReviewedIr(), abi = createComponentPrivateAbi(ir);
	parseBindingIr(canonicalJson(ir)); await assertJsonSchema("binding-ir", ir);
	assert.equal(abi.version, 7); assert.equal(abi.dispatch, "copied-nominal-frame-v1");
	assert.equal(abi.records, undefined); assertComponentRecordBindings(abi, ir);
	const generated = plan(ir); await assertJsonSchema("compiler-adapter-plan", generated.plan);
	const signal = value => value.types.find(type => type.id === "lean:Variants.Signal");
	for(const mutate of [
		value => { signal(value).cases.reverse(); }
		, value => { signal(value).cases[2].fields.reverse(); }
		, value => { signal(value).cases[0].name = "newCase"; }
		, value => { signal(value).cases[2].fields[0].type.name = "uint16"; }
		, value => { signal(value).cases[2].fields[0].name = "renamed"; }
		, value => { value.types.pop(); }
		, value => { value.records = []; }
		, value => { value.version = 6; value.dispatch = "copied-compound-frame-v1"; }
		, value => { signal(value).cases = []; }
		, value => { signal(value).cases[2].fields[0].name = "kind"; }
	]){
		const changed = structuredClone(abi); mutate(changed); assert.throws(() => assertComponentRecordBindings(changed, ir));
	}
	for(const mutate of [
		value => { value.declarations[0].parameters[0].ownership = "borrow"; }
		, value => { value.declarations[0].result.ownership = "lease"; }
		, value => { value.declarations[0].effects = ["host-call"]; }
		, value => { value.declarations[0].resultMode = "promise"; }
		, value => { signal(value).representation = "identity"; }
		, value => { signal(value).cases[2].fields[0].mutability = "write"; }
	]){
		const changed = structuredClone(ir); mutate(changed); assert.throws(() => assertComponentRecordBindings(abi, changed));
	}
});

test("nominal descriptors reject accessors, unknown names and recursive expansions", () => {
	let reads = 0;
	const getter = { get: () => { reads++; return "variant"; } };
	for(const modify of [
		abi => Object.defineProperty(abi, "version", getter)
		, abi => Object.defineProperty(abi.types[0], "kind", getter)
		, abi => Object.defineProperty(abi.types[0], "cases", getter)
		, abi => Object.defineProperty(abi.types[0].cases[0], "fields", getter)
	]){
		const abi = createComponentPrivateAbi(variantReviewedIr()); modify(abi); assert.throws(() => assertComponentRecordAbi(abi));
	}
	assert.equal(reads, 0);
	const ref = { kind: "named", id: "lean:Recursive" };
	assert.throws(() => resolveComponentRecordType(ref, [{ kind: "alias", id: ref.id, target: ref }], true, true), /recursive/);
	assert.throws(() => resolveComponentRecordType(ref, [{ kind: "variant", id: ref.id, cases: [{ name: "next", fields: [{ name: "value", type: ref }] }] }], true, true), /recursive/);
	assert.throws(() => resolveComponentRecordType(ref, [], true, true), /unknown/);
});

test("copied ABI versions require exact numbers without coercion", () => {
	let conversions = 0;
	const coercible = { [Symbol.toPrimitive]: () => { conversions++; return 5; } };
	for(const fixture of [recordReviewedIr, compoundReviewedIr, variantReviewedIr])
	{
		const valid = createComponentPrivateAbi(fixture()); assertComponentRecordAbi(valid);
		for(const version of [String(valid.version), BigInt(valid.version), coercible, null, undefined, NaN, Infinity, 4, 8])
		{
			const changed = structuredClone(valid); changed.version = version;
			assert.throws(() => assertComponentRecordAbi(changed));
		}
	}
	assert.equal(conversions, 0);
});

test("generated variant helpers use typed matches, never Lean constructor layouts", () => {
	const generated = plan(variantReviewedIr()), abi = JSON.parse(canonicalJson(generated.plan.privateAbi));
	const lean = generated.files["LeanBridgeGenerated.lean"], c = generateComponentRecordAdapters(abi);
	assert.match(lean, /\.«data»/); assert.match(lean, /\.«only» field =>/);
	assert.doesNotMatch(lean, /sorry|axiom|unsafeCast/);
	assert.doesNotMatch(c, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor|lean_obj_tag/);
	assert.match(c, /bridge_nominal_children_validate/); assert.match(c, /switch \(slot->flags >> 2\)/);
	for(const [, symbol] of lean.matchAll(/@\[export ([A-Za-z0-9_]+)\]/g)) assert.ok(c.includes(`${symbol}(`), symbol);
	assert.ok(c.lastIndexOf("_validate(&frame->args") < c.lastIndexOf("_decode(&frame->args"));
});

test("generated variant validators reject getters, inherited fields and extra symbols", async () => {
	const files = generateJavaScriptPackage(variantReviewedIr());
	const { assertSignal } = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	let reads = 0;
	const getter = { get: () => { reads++; return "idle"; } };
	for(const input of [Object.defineProperty({}, "kind", getter)
		, Object.defineProperty({ kind: "marker" }, "value", getter)
		, Object.create({ kind: "idle" }), { kind: "marker" }
		, { kind: "idle", [Symbol("extra")]: 0 }, { kind: "bad" }])
		assert.throws(() => assertSignal(input, "signal"));
	assertSignal({ kind: "marker", value: undefined }, "signal");
	assertSignal(Object.assign(Object.create(null), { kind: "idle" }), "signal"); assert.equal(reads, 0);
});

test("missing nominal runtime rejects before component code is fetched", async t => {
	let reads = 0;
	t.mock.method(globalThis, "fetch", () => { reads++; assert.fail("old runtime fetched variant code"); });
	const module = { _bridge_lean_runtime_init: () => 1, FS: {}
		, _bridge_scalar_frame_clear: () => {}, _bridge_copied_frame_clear: () => {}
		, _bridge_copied_abi: () => 1, _bridge_record_abi: () => 1
		, _bridge_compound_abi: () => 1 };
	const runtime = await createComponentRuntime(async () => module, new URL("https://invalid.test/runtime.wasm"));
	const ir = variantReviewedIr();
	await assert.rejects(() => runtime.loadComponent({
		id: "variants", buildHash: "a".repeat(64), integrity: "b".repeat(64)
		, initializer: "initialize_Variants"
		, sideModule: new URL("https://invalid.test/component.wasm")
		, bindingIr: ir, privateAbi: createComponentPrivateAbi(ir)
	}), /nominal ABI/);
	assert.equal(reads, 0);
});

test("variant payloads do not bypass primitive-only callable admission", () => {
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		const ref = { kind: "named", id: "lean:Variants.Signal" };
		ir.types.push(variantReviewedIr().types.find(type => type.id === ref.id));
		if(position === "parameter") callback.callable.parameters[0].type = ref;
		else callback.callable.result.type = ref;
		assert.throws(() => createComponentPrivateAbi(ir));
	}
});

test("nominal call arenas clean failed inputs, recover budget errors and poison corrupted output", () => {
	const abi = createComponentPrivateAbi(variantReviewedIr());
	const signature = abi.exports.find(item => item.bindingId === "lean:Variants.echo");
	const fixture = failure => {
		const memory = new WebAssembly.Memory({ initial: 1 }), live = new Set();
		let next = 256, allocations = 0, clears = 0, poisoned = false;
		const module = {
			HEAP8: new Uint8Array(memory.buffer)
			, _malloc: bytes => {
				if(++allocations === failure) return 0;
				const pointer = next; next += Math.ceil(Math.max(bytes, 1) / 8) * 8;
				memory.grow(1); module.HEAP8 = new Uint8Array(memory.buffer); live.add(pointer); return pointer;
			}
			, _free: pointer => assert.ok(live.delete(pointer))
			, _bridge_copied_frame_clear: () => { clears++; }
		};
		return { module, live, view: () => new DataView(memory.buffer), poison: () => { poisoned = true; }, state: () => ({ clears, poisoned }) };
	};
	for(const failure of [1, 2, 3])
	{
		const f = fixture(failure);
		const call = compileComponentCopiedCall(f.module, () => assert.fail("failed input reached Lean"), signature, f.poison, 7, abi.types);
		assert.throws(() => call([{ kind: "data", count: 7, label: "test" }]), /allocation failed/);
		assert.equal(f.live.size, 0); assert.equal(f.state().poisoned, false);
	}
	for(const status of [4, 5])
	{
		const f = fixture(Infinity), call = compileComponentCopiedCall(f.module, frame => { f.view().setUint32(frame + 8, status, true); return status; }, signature, f.poison, 7, abi.types);
		for(let i = 0; i < 10; i++) assert.throws(() => call([{ kind: "data", count: 7, label: "test" }]));
		assert.equal(f.live.size, 0); assert.deepEqual(f.state(), { clears: 10, poisoned: false });
	}
	for(const corrupt of [false, true])
	{
		const f = fixture(Infinity), call = compileComponentCopiedCall(f.module, frame => {
			if(!corrupt) throw new WebAssembly.RuntimeError("trap");
			f.view().setUint32(frame + 16, 37, true); f.view().setUint32(frame + 20, 1023 << 2, true); return 0;
		}, signature, f.poison, 7, abi.types);
		assert.throws(() => call([{ kind: "idle" }])); assert.deepEqual(f.state(), { clears: 0, poisoned: true });
	}
});

test("variant evidence binds both source paths and every npm context to exact archives", async () => {
	const record = JSON.parse(await readFile("docs/evidence/npm-variants-20260921.json", "utf8"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs)
	{
		assert.equal(run.sourceSha256, record.sourceHashes["tests/fixtures/onboarding/npm-variants/Variants.lean"]);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/npm.mjs"]);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRelocatedBeforeInstallation, true);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		assert.equal(run.result.primitives, 19); assert.ok(run.result.checks > 2000); assert.ok(run.result.rejections > 30);
		assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox", "webkit"]);
		for(const browser of run.browsers)
			for(const context of ["page", "react", "worker"]) assert.deepEqual(browser.result[context], run.result);
		validateComponentPackageReceipt(run.receipt); assert.equal(run.receipt.component.id, "variants@1.0.0");
	}
	assert.equal(record.runs[0].receipt.runtime.sha256, record.runs[1].receipt.runtime.sha256);
	assert.equal(record.runs[0].receipt.componentArtifactSha256, record.runs[1].receipt.componentArtifactSha256);
});
