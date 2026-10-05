/**
 * Fresh Lean/Wasm execution of synchronous JS callbacks, typed recovery,
 * resource borrows, higher-order calls and exact rollback after injected faults.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_JS_WASM_TEST === "1";

for(const reviewed of [false, true]) test(`owned JavaScript host callbacks execute fresh Lean (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: !enabled, timeout: 600000
}, async t => {
	let attempts = 0, failAt = 0;
	const hostFailure = new Error("Injected JavaScript ownership allocation failure");
	const f = await compileOwnedJavaScriptWasmFixture(t, "owned-dotnet-callables", {
		hostCallbacks: true
		, ...reviewed ? { reviewedIr: ownedDotnetCallbacksReviewedIr() } : {}
		, registry: { checkpoint: () => { if(++attempts === failAt) throw hostFailure; } }
	});
	const { call, module, close, withRecovery, callbackCount } = f;
	const first = call("newTicket", 42n, "first"), second = call("newTicket", 51n, "second");
	const bundle = { primary: first, spare: { tag: "some", value: second }
		, peers: [first, second, first], history: [second, first]
		, payload: { count: -(1n << 100n), bytes: new Uint8Array([0, 128, 255]) } };
	const snapshot = () => [module._owned_results(), module._owned_live(), module._owned_identities(), callbackCount()];
	const baseline = snapshot(); let borrowed, retained;
	assert.deepEqual(call("callbackRecord", bundle, value => {
		assert.equal(module._owned_close(), 8, "Native close rejects an active callback without draining its owners");
		borrowed = value.primary; assert.notEqual(borrowed, first);
		assert.equal(call("serial", borrowed), 42n); assert.equal(value.peers[0], borrowed);
		retained = borrowed.retain(); return value;
	}), bundle);
	assert.equal(borrowed.disposed, true); assert.throws(() => call("serial", borrowed), /disposed|expired/);
	assert.equal(call("serial", retained), 42n); retained.dispose(); assert.deepEqual(snapshot(), baseline);
	let returnedIdentity;
	const changed = call("callbackRecord", bundle, value => {
		returnedIdentity = call("newTicket", 333n, "reply pin");
		return { ...value, primary: returnedIdentity
			, payload: new Proxy(value.payload, {
				ownKeys: target => { returnedIdentity.dispose(); return Reflect.ownKeys(target); }
			})
		};
	});
	assert.equal(returnedIdentity.disposed, true); assert.equal(call("serial", changed.primary), 333n);
	changed.primary.dispose(); assert.deepEqual(snapshot(), baseline);
	const tree = { kind: "branch", children: [{ kind: "leaf", ticket: first }, { kind: "branch", children: [] }] };
	assert.deepEqual(call("callbackRecursive", tree, value => value), tree);
	assert.deepEqual(call("twice", bundle, value => value), bundle);
	let invoked = 0;
	assert.deepEqual(call("repeatedly", bundle, value => { invoked++; return value; }, 100n), bundle);
	assert.equal(invoked, 100); assert.deepEqual(snapshot(), baseline);
	for(const [name, value] of [
		["Unit", undefined], ["Bool", true], ["Char", "💠"]
		, ["Nat", 1n << 200n], ["Int", -(1n << 201n)]
		, ["U8", 255], ["U16", 65535], ["U32", 4294967295]
		, ["U64", 18446744073709551615n]
		, ["I8", -128], ["I16", -32768], ["I32", -2147483648]
		, ["I64", -9223372036854775808n]
		, ["Usize", 4294967295], ["Isize", -2147483648]
		, ["F32", Math.fround(1 / 3)], ["F64", -0]
		, ["String", "\ufeffA\0💠"], ["Bytes", new Uint8Array([0, 255, 128])]
	]) {
		assert.deepEqual(call(`via${name}`, actual => { assert.deepEqual(actual, value); return actual; }, value), value);
		assert.deepEqual(snapshot(), baseline, name);
	}
	let escapedFunction, retainedFunction;
	assert.deepEqual(call("withFunction", bundle, (callback, value) => {
		escapedFunction = callback; retainedFunction = callback.retain(); return callback(value);
	}), bundle);
	assert.equal(escapedFunction.disposed, true); assert.throws(() => escapedFunction(bundle), /disposed|expired/);
	assert.deepEqual(retainedFunction(bundle), bundle); retainedFunction.dispose();
	const dispatch = call("dispatch", bundle); assert.deepEqual(dispatch(value => value), bundle); dispatch.dispose();
	let escapedCalls = 0;
	const escaped = call("retainCallback", value => { escapedCalls++; return value; });
	assert.throws(() => escaped(bundle), error => error.status === 10); assert.equal(escapedCalls, 0); escaped.dispose();
	assert.deepEqual(snapshot(), baseline);
	assert.throws(() => call("factory", () => first), error => error.status === 1);
	assert.equal(call("factory", withRecovery(value => { assert.equal(value, undefined); return first; }, first)), first);
	for(const failure of [new Error("callback failed"), { reason: "application" }, undefined, null, 0])
	{
		let count = 0;
		assert.throws(() => call("twice", bundle, () => { count++; throw failure; }), error => error === failure);
		assert.equal(count, 1); assert.deepEqual(snapshot(), baseline);
		assert.throws(() => call("factory", withRecovery(() => { throw failure; }, first)), error => error === failure);
		assert.deepEqual(call("callbackRecord", bundle, value => value), bundle);
	}
	for(const callback of [
		() => undefined, value => ({ ...value, primary: {} })
		, value => Promise.resolve(value)
		, value => ({ ...value, peers: new Array(1) })
	]) {
		assert.throws(() => call("callbackRecord", bundle, callback), TypeError);
		assert.deepEqual(snapshot(), baseline);
	}
	const cycle = { kind: "branch", children: [] }; cycle.children.push(cycle);
	assert.throws(() => call("callbackRecursive", tree, () => cycle), /cyclic/);
	let depth = 0;
	const reenter = value => { depth++; return call("callbackRecord", value, reenter); };
	assert.throws(() => call("callbackRecord", bundle, reenter), error => error.status === 2);
	// The native 64-scope bound leaves one scope for converting callback arguments.
	assert.equal(depth, 63); assert.deepEqual(snapshot(), baseline);
	assert.throws(() => call("repeatedly", bundle, value => value, 10000n), /budget exceeded/);
	assert.deepEqual(snapshot(), baseline);
	let nativeFaults = 0;
	for(let checkpoint = 1; checkpoint <= 500; ++checkpoint)
	{
		module._owned_fail_after(checkpoint); let failed = false;
		try
		{ assert.deepEqual(call("callbackRecord", bundle, value => value), bundle); }
		catch(error)
		{ assert.equal(error.status, 3); failed = true; nativeFaults++; }
		finally
		{ module._owned_fail_after(0); }
		assert.deepEqual(snapshot(), baseline, `Native allocation ${checkpoint}`);
		if(!failed) break;
		assert.ok(checkpoint < 500, "The fault sweep must reach a successful call");
	}
	assert.ok(nativeFaults > 20);
	let hostFaults = 0;
	for(let checkpoint = 1; checkpoint <= 150; ++checkpoint)
	{
		failAt = attempts + checkpoint; let failed = false;
		try
		{ assert.deepEqual(call("callbackRecord", bundle, value => value), bundle); }
		catch(error)
		{ assert.equal(error, hostFailure); failed = true; hostFaults++; }
		finally
		{ failAt = 0; }
		assert.deepEqual(snapshot(), baseline, `Host allocation ${checkpoint}`);
		if(!failed) break;
		assert.ok(checkpoint < 150, "The host fault sweep must reach a successful call");
	}
	assert.ok(hostFaults > 10);
	assert.deepEqual(call("callbackRecord", bundle, value => value), bundle); assert.deepEqual(snapshot(), baseline);
	assert.throws(() => call("callbackRecord", bundle, value => { close(); return value; }), /closed/);
	assert.deepEqual(snapshot(), [0, 0, 0, 0]); assert.equal(module._owned_initializations(), 1);
	t.diagnostic(JSON.stringify({ source: reviewed ? "reviewed" : "ordinary"
		, primitiveCallbacks: 19, reentries: depth, nativeFaults, hostFaults
		, live: snapshot(), initializations: module._owned_initializations() }));
});
