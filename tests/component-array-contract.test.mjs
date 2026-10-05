/**
 * Closed copied-array admission and call-arena failure containment.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { assertComponentCopiedBindings } from "../src/abi/component-copied.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { generateComponentCopiedAdapters } from "../src/build/component-copied-adapters.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../src/build/compiler-adapters.mjs";
import { compileComponentCopiedCall } from "../src/release/component-copied-runtime.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { arrayReviewedIr } from "./helpers/array-fixture.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

test("array compiler plans agree with schemas and preserve parenthesized nested types", async () => {
	const ir = arrayReviewedIr();
	const generated = generateCompilerAdapters({ analysis: {
		bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
		, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Arrays", status: "exportable" }))
	}
	, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });
	validateCompilerAdapterPlan(generated.plan);
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	assert.equal(generated.plan.privateAbi.version, 4);
	assert.match(generated.files["LeanBridgeGenerated.lean"], /\(_root_\.Array \(_root_\.Array _root_\.UInt32\)\)/);
	const c = generateComponentCopiedAdapters(generated.plan.privateAbi);
	assert.match(c, /bridge_copied_validate\(&frame->args\[0\], 4, 2, &budget\)/);
	assert.match(c, /bridge_copied_encode\(&frame->result, 4, 2, result, &budget\)/);
	assert.ok(c.indexOf("bridge_copied_validate") < c.indexOf("bridge_copied_decode"));
});

test("array admission rejects changed types, ownership, effects and unsupported compounds", () => {
	const ir = arrayReviewedIr(), abi = createComponentPrivateAbi(ir);
	assertComponentCopiedBindings(abi, ir);
	for(const mutate of [
		value => { value.declarations[0].parameters[0].ownership = "borrow"; }
		, value => { value.declarations[0].parameters[0].lifetime = { scope: "call", anchor: null }; }
		, value => { value.declarations[0].parameters[0].optional = true; }
		, value => { value.declarations[0].parameters[0].type.arguments[0].arguments[0].name = "bool"; }
		, value => { value.declarations[0].result.ownership = "lease"; }
		, value => { value.declarations[0].resultMode = "promise"; }
		, value => { value.declarations[0].effects = ["host-call"]; }
		, value => { value.declarations[0].failure.unexpected = "throw"; }
		, value => { value.declarations[1].id = value.declarations[0].id; }
		, value => { value.declarations[0].parameters[0].type.constructor = "option"; }
	]){
		const changed = structuredClone(ir); mutate(changed);
		assert.throws(() => assertComponentCopiedBindings(abi, changed));
	}
	for(const mutate of [
		value => { value.version = 2; }
		, value => { value.dispatch = "scalar-frame-v2"; }
		, value => { value.extra = true; }
		, value => { value.exports[0].parameters[0].extra = true; }
		, value => { value.exports[1].symbol = value.exports[0].symbol; }
		, value => { value.exports[0].parameters[0].arguments[0].constructor = "tuple"; }
	]){
		const changed = structuredClone(abi); mutate(changed);
		assert.throws(() => assertComponentCopiedBindings(changed, ir));
	}
});

const fixture = (failAllocation = Infinity) => {
	const live = new Set(), freed = [];
	let next = 64, allocations = 0, cleared = 0, poisoned = false;
	const memory = new WebAssembly.Memory({ initial: 1 });
	const module = {
		HEAP8: new Uint8Array(memory.buffer)
		, _malloc: bytes => {
			if(++allocations === failAllocation) return 0;
			const pointer = next; next += Math.ceil(bytes / 8) * 8;
			memory.grow(1); module.HEAP8 = new Uint8Array(memory.buffer);
			live.add(pointer); return pointer;
		}
		, _free: pointer => { assert.ok(live.delete(pointer)); freed.push(pointer); }
		, _bridge_copied_frame_clear: () => { cleared++; }
	};
	const signature = createComponentPrivateAbi(arrayReviewedIr()).exports.find(item => item.bindingId === "lean:Arrays.reverseString");
	return { module
		, signature
		, live
		, freed
		, view: () => new DataView(module.HEAP8.buffer)
		, poison: () => { poisoned = true; }, state: () => ({ cleared, poisoned }) };
};

test("partial copied inputs and allocation failures release every arena allocation", () => {
	for(const fail of [1, 2, 3, 4, 5, 6])
	{
		const f = fixture(fail);
		const call = compileComponentCopiedCall(f.module, () => assert.fail("invalid input entered Lean"), f.signature, f.poison);
		assert.throws(() => call([[["a", "b"], [null]]]), /allocation failed|Expected string/);
		assert.equal(f.live.size, 0);
		assert.equal(f.state().poisoned, false);
	}
});

test("copied budget failures recover, but traps and corrupt native output poison without traversal", () => {
	for(const status of [4, 5])
	{
		const f = fixture();
		const call = compileComponentCopiedCall(f.module, frame => { f.view().setUint32(frame + 8, status, true); return status; }, f.signature, f.poison);
		assert.throws(() => call([[["a"]]]), /budget exceeded|failed \(5\)/);
		assert.equal(f.live.size, 0);
		assert.deepEqual(f.state(), { cleared: 1, poisoned: false });
	}
	for(const operation of [
		() => { throw new WebAssembly.RuntimeError("trap"); }
		, (f, frame) => { f.view().setUint32(frame + 16, 35, true); return 0; }
		, (f, frame) => { f.view().setUint32(frame, 2, true); return 0; }
	]){
		const f = fixture();
		const call = compileComponentCopiedCall(f.module, frame => operation(f, frame), f.signature, f.poison);
		assert.throws(() => call([[["a"]]]));
		assert.deepEqual(f.state(), { cleared: 0, poisoned: true });
		assert.equal(f.freed.length, 0);
	}
});

test("old runtimes and mismatched copied ownership reject before component fetch", async t => {
	let reads = 0;
	t.mock.method(globalThis, "fetch", () => { reads++; assert.fail("rejected descriptor fetched code"); });
	for(const runtimeSupport of [false, true])
	{
		const module = { _bridge_lean_runtime_init: () => 1
			, FS: {}
			, _bridge_scalar_frame_clear: () => {}
			, ...(runtimeSupport ? { _bridge_copied_abi: () => 1, _bridge_copied_frame_clear: () => {} } : {}) };
		const runtime = await createComponentRuntime(async () => module, new URL("file:///main.wasm"));
		const bindingIr = arrayReviewedIr(), privateAbi = createComponentPrivateAbi(bindingIr);
		if(runtimeSupport) bindingIr.declarations[0].result.ownership = "borrow";
		await assert.rejects(runtime.loadComponent({ id: "arrays", sideModule: new URL("https://example.invalid/arrays.wasm"), bindingIr, privateAbi }), /copied ABI|ownership mismatch/);
	}
	assert.equal(reads, 0);
});

test("generated array validators reject getters and sparse arrays before reading an element", async () => {
	const files = generateJavaScriptPackage(arrayReviewedIr());
	const validators = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	let getters = 0;
	const row = Object.defineProperty([], 0, { enumerable: true, get: () => { getters++; return 42; } });
	assert.throws(() => validators.assertArrayOfArrayOfUint32([row], "rows"), /dense data array/);
	assert.equal(getters, 0);
	assert.throws(() => validators.assertArrayOfArrayOfUint32([new Array(1)], "rows"), /dense data array/);
	assert.throws(() => validators.assertArrayOfArrayOfUint32(new Array(0xffffffff), "rows"), /bounded array/);
});

test("array evidence binds both producer paths to installed packages in all three browser engines", async () => {
	const record = JSON.parse(await readFile("docs/evidence/npm-arrays-20260920.json", "utf8"));
	assert.deepEqual(record.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.runs)
	{
		assert.equal(run.sourceSha256, sha256(await readFile("tests/fixtures/onboarding/npm-arrays/Arrays.lean")));
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/array-consumers/npm.mjs")));
		assert.equal(run.offlineInstall, true);
		assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRelocatedBeforeInstallation, true);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		assert.deepEqual(run.result, { checks: 1278, primitives: 19 });
		assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox", "webkit"]);
		for(const browser of run.browsers)
			for(const profile of ["page", "react", "worker"]) assert.deepEqual(browser.result[profile], run.result);
		for(const artifact of [run.receipt.package, run.receipt.runtime]) assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
	}
	assert.equal(record.runs[0].receipt.runtime.sha256, record.runs[1].receipt.runtime.sha256);
	assert.equal(record.runs[0].receipt.componentArtifactSha256, record.runs[1].receipt.componentArtifactSha256);
});
