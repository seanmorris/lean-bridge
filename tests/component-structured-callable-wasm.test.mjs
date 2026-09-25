/**
 * Real compiled structured callback failure, ownership and shared-runtime checks.
 * Probe instrumentation is isolated from installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileStructuredCallableWasm } from "./helpers/npm-structured-callable-wasm.mjs";

const rows = [{ tag: "some", value: "\uFEFF🌱\0" }, { tag: "none" }, { tag: "some", value: "" }];
const payload = { text: "copied\0🌱", rows, count: (1n << 129n) + 7n, nested: { tag: "some", value: { ok: [(1n << 64n) - 1n, undefined] } } };
const leaf = { kind: "leaf", value: (1n << 200n) + 9n };
const cases = {
	Array: [rows, []]
	, List: [[{ ok: [42, "\uFEFF🌱"] }, { error: "failure\0" }], []]
	, Option: [{ tag: "none" }, { tag: "some", value: { tag: "none" } }, { tag: "some", value: { tag: "some", value: undefined } }]
	, Result: [{ error: ["one", "", "🌱"] }, { ok: { tag: "none" } }, { ok: { tag: "some", value: 0xffffffff } }, { error: [] }]
	, Tuple: [["tuple", [Uint8Array.of(0, 128, 255), 1n << 128n]], ["", [new Uint8Array(), 0n]]]
	, Record: [payload, { ...payload, nested: { tag: "none" } }, { ...payload, nested: { tag: "some", value: { error: "err🌱" } } }]
	, Alias: [payload]
	, Variant: [{ kind: "counts", positive: 1n << 128n, negative: -(1n << 129n) }, { kind: "empty" }, { kind: "payload", label: "packet", rows }]
	, Recursive: [{ kind: "branch", children: [leaf, { kind: "branch", children: [leaf, { kind: "branch", children: [] }] }] }, leaf, { kind: "branch", children: [] }]
};

test("compiled structured callables recover every injected copied-allocation failure and share scalar lifecycle limits", {
	timeout: 600_000
	, skip: process.env.LEAN_BRIDGE_STRUCTURED_CALLABLE_WASM_TEST !== "1"
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structured-callable-wasm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const compiled = await compileStructuredCallableWasm(directory);
	const f = await compiled.instantiate(), scenarios = [];
	let nativeFaults = 0, jsFaults = 0;
	for(const [shape, values] of Object.entries(cases))
	{
		for(const [branch, value] of values.entries())
		{
			const closure = f.call(`make${shape}`, value);
			const operations = [
				["call", () => f.call(`call${shape}`, value, copied => { assert.deepEqual(copied, value); assert.notEqual(copied, value); return copied; })]
				, ["twice", () => f.call(`twice${shape}`, value, copied => copied)]
				, ["captured", () => closure(true, value)]
				, ["argument", () => closure(false, value)]
				, ["make", () => { const lease = f.call(`make${shape}`, value); lease.dispose(); return value; }]
			];
			for(const [operation, invoke] of operations)
			{
				f.command("recursive_test_configure");
				assert.deepEqual(invoke(), value); f.clean();
				const nativeAttempts = f.command("recursive_test_attempts");
				for(let index = 1; index <= nativeAttempts; index++)
				{
					f.command("recursive_test_configure", index);
					assert.throws(invoke, /failed \(5\)/, `${shape}/${branch}/${operation}/native/${index}`);
					nativeFaults++; f.clean();
					f.command("recursive_test_configure");
					assert.deepEqual(invoke(), value); f.clean();
				}
				f.command("recursive_test_configure", 0, 0);
				const allocate = f.module._malloc;
				let attempted = 0, failAt = 0;
				f.module._malloc = size => (++attempted === failAt ? 0 : allocate(size));
				assert.deepEqual(invoke(), value);
				const jsAttempts = attempted; f.clean();
				// Disposal needs a native key allocation. Its failure retires a heap,
				// so the make operation's disposal is tested separately below.
				const recoverableAttempts = jsAttempts - (operation === "make" ? 1 : 0);
				for(let index = 1; index <= recoverableAttempts; index++)
				{
					attempted = 0; failAt = index;
					assert.throws(invoke, undefined, `${shape}/${branch}/${operation}/JS/${index}`);
					failAt = 0; jsFaults++; f.clean();
					assert.deepEqual(invoke(), value); f.clean();
				}
				f.module._malloc = allocate;
				scenarios.push({ shape, branch, operation, nativeFaults: nativeAttempts, jsFaults: recoverableAttempts });
			}
			closure.dispose(); f.clean();
		}
		t.diagnostic(`${shape}: all constructors, call/twice/make and both closure branches passed allocation-failure recovery`);
	}
	for(const original of [new Error("original"), undefined, null, 0, { failure: "original" }])
	{
		for(const action of ["twiceRecord", "afterFailure"])
		{
			let count = 0;
			assert.throws(() => f.call(action, payload, () => { count++; throw original; }), error => error === original);
			assert.equal(count, 1); f.clean();
		}
	}
	const expired = f.call("retainRecord", value => value);
	assert.throws(() => expired(payload), /Expired/); expired.dispose(); f.clean();
	for(const invalid of [false, true])
	{
		const closure = f.call("makeRecord", payload);
		let disposed = false;
		const input = new Proxy(payload, { getOwnPropertyDescriptor: (target, key) => {
			if(!disposed)
			{ disposed = true; assert.equal(closure.dispose(), true); }
			return invalid && key === "count" ? { value: -1n, configurable: true, enumerable: true } : Reflect.getOwnPropertyDescriptor(target, key);
		} });
		if(invalid) assert.throws(() => closure(false, input), /nat/);
		else assert.deepEqual(closure(false, input), payload);
		assert.equal(closure.disposed, true); assert.equal(closure.dispose(), false); f.clean();
	}
	const recursive = depth => f.call("callRecord", payload, value => depth ? scalar(depth - 1) && value : value);
	const scalar = depth => f.scalar("callUInt32", 42, value => depth ? (recursive(depth - 1), value) : value);
	assert.deepEqual(recursive(63), payload); f.clean();
	assert.throws(() => recursive(64), /reentry limit/); f.clean();
	assert.equal(scalar(63), 42); f.clean();
	const leases = Array.from({ length: 1024 }, (_, index) => index % 2 ? f.call("makeRecord", payload) : f.scalar("makeUInt32", 42));
	assert.throws(() => f.call("makeRecord", payload), /failed \(9\)/);
	assert.throws(() => f.scalar("makeUInt32", 42), /failed \(9\)/); f.clean();
	for(const lease of leases) assert.equal(lease.dispose(), true);
	const retry = f.call("makeRecord", payload); assert.deepEqual(retry(false, payload), payload); retry.dispose(); f.clean();

	// Each poisoning check gets its own heap. A retired heap intentionally skips
	// allocator traversal and cannot be used to assert zero live allocations.
	const poisonCases = [];
	for(const mode of ["reply", "receipt", "result", "status", "cleanup", "cleanup-after-error", "release"])
	{
		const p = await compiled.instantiate(), original = new Error("original callback"), failure = new WebAssembly.RuntimeError("cleanup trap");
		const stale = p.scalar("makeUInt32", 42);
		let hosts = 0, unsafeFrees = 0;
		const free = p.module._free;
		p.module._free = pointer => {
			try
			{ p.runtime.assertOpen(); }
			catch(error)
			{ unsafeFrees++; throw error; }
			return free(pointer);
		};
		let operation = () => p.call("callRecord", payload, value => { hosts++; return value; });
		if(mode === "reply") p.command("structured_test_reply", 1);
		if(mode === "receipt") p.module._bridge_recursive_receipt_count = () => 0xffffffff;
		if(mode === "result" || mode === "status")
		{
			const native = p.module._bridge_scalar_call;
			p.module._bridge_scalar_call = (name, frame) => {
				const status = native(name, frame);
				const data = new DataView(p.module.HEAP8.buffer);
				data.setUint32(frame + (mode === "result" ? 16 : 8), 0xffffffff, true);
				return status;
			};
		}
		if(mode.startsWith("cleanup"))
		{
			p.module._bridge_recursive_frame_clear = () => { throw failure; };
			operation = () => p.call("callRecord", payload, value => {
				hosts++; if(mode === "cleanup-after-error") throw original; return value;
			});
		}
		if(mode === "release")
		{
			const lease = p.call("makeRecord", payload);
			p.module._malloc = () => 0;
			operation = () => lease.dispose();
		}
		if(mode === "cleanup-after-error") assert.throws(operation, error => error === original);
		else if(mode === "cleanup") assert.throws(operation, error => error === failure);
		else assert.throws(operation);
		assert.throws(() => p.runtime.assertOpen(), /poisoned/);
		assert.throws(() => stale(false, 1), /poisoned/);
		assert.equal(stale.dispose(), true);
		if(mode === "reply")
		{ assert.equal(hosts, 1); assert.equal(p.command("structured_test_dispatches"), 2); }
		assert.equal(unsafeFrees, 0, mode);
		poisonCases.push({ mode, hostCalls: hosts, retired: true, unsafeFrees });
	}
	const report = { schemaVersion: 1, kind: "npm-structured-callable-wasm-probe"
		, sourceSha256: compiled.sourceSha256
		, generatedAdapterSha256: compiled.generatedAdapterSha256
		, binarySha256: compiled.binarySha256
		, runtimeSha256: compiled.runtimeSha256
		, shapes: Object.keys(cases).length
		, scenarios, nativeFaults, jsFaults, poisonCases
		, ownership: { nativeCopiedOutputOwnersAfterRecoverableFailures: 0
			, jsAllocationsAfterRecoverableFailures: 0
			, allLeanHeapAllocationsTracked: false
			, installedPackagesInstrumented: false }
		, sharedScalarAndStructured: { reentryDepth: 64, closureCapacity: 1024
			, recoveredAfterLimit: true } };
	await mkdir("build/structured-callables/npm-wasm", { recursive: true });
	await writeFile("build/structured-callables/npm-wasm/report.json", `${JSON.stringify(report, null, 2)}\n`);
	t.diagnostic(`${nativeFaults} native copied-output faults and ${jsFaults} JS allocation faults recovered; ${poisonCases.length} malformed/trapped heaps retired`);
});
