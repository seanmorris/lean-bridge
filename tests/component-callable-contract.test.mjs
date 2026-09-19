/**
 * Admission and loader checks for compiled npm callables.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertComponentCallableBindings } from "../src/abi/component-callables.mjs";
import { createComponentPrivateAbi, generateComponentCallableAdapters } from "../src/build/component-callable-adapters.mjs";
import { generateCompilerAdapters, validateCompilerAdapterPlan } from "../src/build/compiler-adapters.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const source = () => callableReviewedIr();
const plan = ir => generateCompilerAdapters({ analysis: {
	bindingIr: { origin: "lean-elaborated", document: ir, semanticSha256: "1".repeat(64) }
	, exportCandidates: ir.declarations.map(item => ({ declaration: item.source.declaration, sourceModule: "Callables", status: "exportable" }))
}
, componentPlan: { sha256: "2".repeat(64), document: { bindingIr: { semanticSha256: "1".repeat(64) } } } });

test("callable compiler plans and schemas agree on carriers and closed signatures", async () => {
	const generated = plan(source());
	validateCompilerAdapterPlan(generated.plan);
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	assert.equal(generated.plan.privateAbi.callbacks.length, 38);
	assert.match(generated.files["LeanBridgeGenerated.lean"], /structure ClosureCarry[0-9a-f]{40} where/);
	assert.match(generated.files["LeanBridgeGenerated.lean"], /: ClosureCarry[0-9a-f]{40} :=\n {2}⟨_root_\.Callables\.make/);
	const c = generateComponentCallableAdapters(generated.plan.privateAbi);
	assert.match(c, /bridge_callable_store\(result, "[0-9a-f]{40}", lean_bridge_/);
	assert.match(c, /bridge_callable_frame_clear\(frame\)/);
	assert.match(c, /if \(status\) \{ lean_dec\(closure\); return status; \}/);
});

test("callable admission rejects changed lifetime, ownership, effects and compound signatures", () => {
	const ir = source(), abi = createComponentPrivateAbi(ir);
	assertComponentCallableBindings(abi, ir);
	for(const mutate of [
		value => { value.types[0].callable.resultMode = "promise"; }
		, value => { value.types[0].callable.parameters[0].ownership = "borrow"; }
		, value => { value.types[0].callable.selfDisposal = "reject"; }
		, value => { value.types[0].callable.reentry = "disallowed"; }
		, value => { value.declarations[0].parameters[1].lifetime.scope = "runtime"; }
		, value => { value.declarations[0].parameters[1].ownership = "lease"; }
		, value => { value.declarations[0].effects = []; }
		, value => { value.declarations[2].result.ownership = "borrow"; }
		, value => { value.declarations[0].parameters[0].optional = true; }
	]) {
		const changed = structuredClone(ir); mutate(changed);
		assert.throws(() => assertComponentCallableBindings(abi, changed), { code: "invalid-component-callable-abi" });
	}
	const compound = source();
	compound.types[0].callable.result.type = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint32" }] };
	assert.throws(() => createComponentPrivateAbi(compound), { code: "invalid-component-callable-abi" });
});

const fixture = async (callable = true) => {
	let links = 0;
	const module = {
		HEAP8: new Uint8Array(4096), _malloc: () => 512, _free: () => {}
		, _bridge_lean_runtime_init: () => 1, _bridge_scalar_frame_clear: () => {}
		, _bridge_scalar_frame_validate: () => 0
		, _bridge_lean_component_initialize: () => 1
		, _bridge_lean_component_last_error: () => 0
		, FS: { writeFile: () => {}, unlink: () => {} }
		, loadDynamicLibrary: async () => { links++; }
		, ...(callable ? { _bridge_callable_abi: () => 1, _bridge_callable_invoke: () => 0, _bridge_callable_release: () => 1 } : {})
	};
	const payload = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
	const bindingIr = source(), privateAbi = createComponentPrivateAbi(bindingIr);
	const descriptor = { id: "callables@1.0.0", buildHash: "1".repeat(64)
		, integrity: sha256(payload), initializer: "initialize_callables"
		, sideModule: new URL("https://example.invalid/side.wasm")
		, privateAbi, bindingIr };
	const runtime = await createComponentRuntime(async () => module, new URL("file:///main.wasm"));
	return { runtime, module, descriptor, payload, links: () => links };
};

test("the loader rejects wrong signature keys and ownership before fetching or linking", async t => {
	let fetches = 0;
	t.mock.method(globalThis, "fetch", () => { fetches++; throw new Error("unexpected fetch"); });
	for(const mutate of [value => { value.privateAbi.callbacks[0].key = "f".repeat(40); }, value => { value.bindingIr.declarations[0].parameters[1].ownership = "lease"; }])
	{
		const f = await fixture(); mutate(f.descriptor);
		await assert.rejects(f.runtime.loadComponent(f.descriptor), /signature key mismatch|ownership/);
		assert.equal(f.links(), 0);
	}
	assert.equal(fetches, 0);
});

test("old scalar runtimes reject callable modules before linking", async () => {
	const f = await fixture(false);
	await assert.rejects(f.runtime.loadComponent(f.descriptor), /lacks the component callable ABI/);
	assert.equal(f.links(), 0);
});

test("a scalar trap poisons callback calls and future component loading in the same heap", async t => {
	const f = await fixture();
	t.mock.method(globalThis, "fetch", async () => new Response(f.payload));
	const calls = await f.runtime.loadComponent(f.descriptor);
	const scalar = { ...f.descriptor };
	scalar.id = "scalar@1.0.0"; scalar.privateAbi = { version: 2, dispatch: "scalar-frame-v2", exports: [f.descriptor.privateAbi.exports.at(-1)] };
	scalar.bindingIr = { declarations: [f.descriptor.bindingIr.declarations.at(-1)] };
	const copied = await f.runtime.loadComponent(scalar);
	const trap = new WebAssembly.RuntimeError("trap");
	f.module._bridge_scalar_call = () => { throw trap; };
	assert.throws(() => copied.call(scalar.privateAbi.exports[0].bindingId, []), error => error === trap);
	assert.throws(() => calls.call(f.descriptor.privateAbi.exports.at(-1).bindingId, []), /poisoned/);
	assert.throws(() => f.runtime.loadComponent(scalar), /poisoned/);
});

test("npm callable evidence binds both producer paths to installed real Lean execution", async () => {
	const record = JSON.parse(await readFile("docs/evidence/npm-callables-20260919.json"));
	assert.deepEqual(record.runs.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const source = `${await readFile("tests/fixtures/onboarding/callables/Callables.lean", "utf8")}\n${await readFile("tests/fixtures/callable-consumers/Npm.lean", "utf8")}`;
	for(const run of record.runs)
	{
		assert.equal(run.sourceSha256, sha256(source));
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/npm.mjs")));
		assert.equal(run.offlineInstall, true);
		assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRelocatedBeforeInstallation, true);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		assert.deepEqual(run.result, { checks: 8084, primitives: 19, wordBits: 32 });
		assert.deepEqual(run.browsers.map(browser => browser.engine), ["chromium", "firefox"]);
		for(const browser of run.browsers)
			for(const profile of ["page", "react", "worker"]) assert.deepEqual(browser.result[profile], run.result);
		for(const artifact of [run.receipt.package, run.receipt.runtime]) assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.equal(record.runs[0].receipt.runtime.sha256, record.runs[1].receipt.runtime.sha256);
	assert.equal(record.runs[0].receipt.componentArtifactSha256, record.runs[1].receipt.componentArtifactSha256);
});
