/**
 * Regression checks for verified-byte loading, concurrency, and scalar validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { callComponentScalar, createComponentRuntime } from "../src/release/component-runtime.mjs";
import { assertComponentSignature, validateComponentScalar } from "../src/abi/component-scalars.mjs";
import { publicRepositoryIdentity } from "../src/release/source-identity.mjs";

const payload = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const integrity = createHash("sha256").update(payload).digest("hex");
const descriptor = () => ({
	id: "test@1.0.0"
	, buildHash: "1".repeat(64)
	, integrity
	, initializer: "initialize_test"
	, sideModule: new URL("https://example.invalid/side.wasm")
	, bindingIr: { declarations: [] }
	, privateAbi: { version: 2, dispatch: "scalar-frame-v2", exports: [] }
});

const fixture = async () => {
	const files = new Map();
	let links = 0;
	let initializations = 0;
	const module = {
		HEAP8: new Uint8Array(1024), _malloc: () => 64, _free: () => {}
		, _bridge_lean_runtime_init: () => 1, _bridge_scalar_frame_clear: () => {}
		, _bridge_lean_component_initialize: () => { initializations += 1; return 1; }
		, _bridge_lean_component_last_error: () => 0
		, FS: { writeFile: (name, bytes) => files.set(name, bytes.slice()), unlink: name => files.delete(name) }
		, loadDynamicLibrary: async name => {
			links += 1;
			assert.deepEqual(files.get(name), payload);
			await Promise.resolve();
		}
	};
	const runtime = await createComponentRuntime(async () => module, new URL("file:///main.wasm"));
	return { runtime, module, files, counts: () => ({ links, initializations }) };
};

test("concurrent identical loads share one fetch and one initialization of verified bytes", async t => {
	let reads = 0;
	t.mock.method(globalThis, "fetch", async () => { reads += 1; return new Response(reads === 1 ? payload : new Uint8Array([99])); });
	const value = await fixture();
	const first = value.runtime.loadComponent(descriptor());
	const second = value.runtime.loadComponent(descriptor());
	assert.equal(first, second);
	assert.equal(await first, await second);
	assert.equal(reads, 1);
	assert.deepEqual(value.counts(), { links: 1, initializations: 1 });
	assert.equal(value.files.size, 0);
});

test("a pending identity cannot be replaced, even before bytes arrive", async t => {
	t.mock.method(globalThis, "fetch", async () => new Response(payload));
	const { runtime } = await fixture();
	const first = runtime.loadComponent(descriptor());
	await assert.rejects(runtime.loadComponent({ ...descriptor(), buildHash: "2".repeat(64) }), /identity conflict/);
	await first;
});

test("descriptor mutations after loading starts cannot replace verified inputs", async t => {
	t.mock.method(globalThis, "fetch", async url => { assert.equal(String(url), "https://example.invalid/side.wasm"); return new Response(payload); });
	const value = await fixture();
	const input = descriptor();
	const pending = value.runtime.loadComponent(input);
	input.sideModule.pathname = "/replacement.wasm";
	input.integrity = "0".repeat(64);
	input.privateAbi.version = 999;
	input.initializer = "initialize_replacement";
	await pending;
	assert.deepEqual(value.counts(), { links: 1, initializations: 1 });
});

test("pre-load failures can retry, but partial initialization failures remain failed", async t => {
	let valid = false;
	t.mock.method(globalThis, "fetch", async () => new Response(valid ? payload : new Uint8Array([99])));
	const value = await fixture();
	await assert.rejects(value.runtime.loadComponent(descriptor()), /integrity mismatch/);
	assert.equal(value.counts().links, 0);
	valid = true;
	value.module._bridge_lean_component_initialize = () => 0;
	const failed = value.runtime.loadComponent(descriptor());
	await assert.rejects(failed, /initialization failed/);
	assert.equal(value.runtime.loadComponent(descriptor()), failed);
	await assert.rejects(failed);
	assert.equal(value.counts().links, 1);
	assert.equal(value.files.size, 0);
});

test("primitive validation preserves big integers and rejects fixed-width overflow and async calls", () => {
	assert.equal(validateComponentScalar("nat", 1n << 4096n), 1n << 4096n);
	assert.equal(validateComponentScalar("int", -(1n << 4096n)), -(1n << 4096n));
	for(const [type, values] of [["uint64", [-1n, 1n << 64n]], ["int64", [-(1n << 63n) - 1n, 1n << 63n]]])
		for(const value of values) assert.throws(() => validateComponentScalar(type, value), RangeError);
	assert.throws(() => assertComponentSignature({ id: "io", resultMode: "promise", parameters: [], result: { kind: "primitive", name: "nat" } }), /asynchronous result/);
});

test("failed scalar calls free their arena and never invoke a function twice", () => {
	const live = new Set();
	let next = 64;
	let calls = 0;
	let cleared = 0;
	const module = {
		HEAP8: new Uint8Array(4096)
		, _malloc: size => { const address = next; next += size; live.add(address); return address; }
		, _free: address => { assert.ok(live.delete(address)); }
		, _bridge_scalar_frame_clear: () => { cleared++; }
	};
	const signature = { resultMode: "value", parameters: [{ kind: "primitive", name: "string" }, { kind: "primitive", name: "nat" }], result: { kind: "primitive", name: "bool" } };
	assert.throws(() => callComponentScalar(module, () => { calls++; }, signature, ["already copied", -1n]), TypeError);
	assert.equal(calls, 0);
	assert.equal(live.size, 0);
	assert.throws(() => callComponentScalar(module, frame => {
		calls++;
		const view = new DataView(module.HEAP8.buffer);
		view.setUint32(frame + 16, 1, true);
		view.setBigUint64(frame + 24, 2n, true);
		return 0;
	}, signature, ["copied", 1n]), /boolean representation/);
	assert.equal(calls, 1);
	assert.equal(live.size, 0);
	assert.equal(cleared, 2);
});

test("source identities never retain remote access credentials or local machine paths", () => {
	assert.equal(publicRepositoryIdentity("https://user:FAKE_TOKEN@example.invalid/repo.git?token=SECRET#fragment"), "https://example.invalid/repo.git");
	assert.equal(publicRepositoryIdentity("git@example.invalid:owner/repo.git"), "ssh://example.invalid/owner/repo.git");
	assert.equal(publicRepositoryIdentity("/private/developer/repository"), "local");
	assert.equal(publicRepositoryIdentity("file:///private/repository"), "local");
});
