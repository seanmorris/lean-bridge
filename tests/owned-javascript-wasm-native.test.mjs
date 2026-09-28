/**
 * Fresh Lean compilation and actual Wasm execution of JavaScript owned values.
 * Package loading and shared-loader coexistence are separate gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_JS_WASM_TEST === "1";

test("JavaScript aggregates execute typed Lean carriers in the real wasm32 runtime", {
	skip: !enabled, timeout: 360000
}, async t => {
	const { call, close, module } = await compileOwnedJavaScriptWasmFixture(t);
	const first = call("newTicket", 1n << 100n, "first\0💠"), second = call("newTicket", 23n, "second");
	assert.equal(call("serial", first), 1n << 100n);
	assert.equal(call("label", first), "first\0💠");
	assert.equal(call("retainTicket", first), first);
	const payload = { count: -(1n << 160n), bytes: new Uint8Array([0, 128, 255]) };
	const bundle = { primary: first, spare: { tag: "some", value: second }
		, peers: [first, second, first], history: [second, first], payload };
	assert.deepEqual(call("bundle", first, bundle.spare, bundle.peers, bundle.history, payload), bundle);
	assert.equal(call("primary", bundle), first); assert.deepEqual(call("payload", bundle), payload);
	const leaf = ticket => ({ kind: "leaf", ticket }), branch = (...children) => ({ kind: "branch", children });
	const tree = branch(leaf(first), branch(), branch(leaf(second)));
	for(const [name, value] of [
		["echoArray", []], ["echoArray", [first, second, first]]
		, ["echoList", []], ["echoList", [second, first]]
		, ["echoOption", { tag: "none" }]
		, ["echoOption", { tag: "some", value: first }]
		, ["echoResult", { ok: bundle }], ["echoResult", { error: second }]
		, ["echoTuple", [first, [{ tag: "none" }, payload]]]
		, ["echoRecord", bundle], ["echoAlias", bundle]
		, ["echoVariant", { kind: "empty" }]
		, ["echoVariant", { kind: "one", ticket: first }]
		, ["echoVariant", { kind: "pair", first, second }]
		, ["echoVariant", { kind: "many", tickets: [first, second] }]
		, ["echoRow", [{ tag: "none" }, { tag: "some", value: first }]]
		, ["echoRecursive", tree]
		, ["echoNested", [[{ tag: "none" }, { tag: "some", value: { ok: bundle } }], [], [{ tag: "some", value: { error: first } }]]]
	]) assert.deepEqual(call(name, value), value, name);
	const supplied = { ...bundle, primary: second }, captured = call("makeRecord", bundle);
	assert.equal(typeof captured, "function");
	assert.deepEqual(captured(true, supplied), bundle); assert.deepEqual(captured(false, supplied), supplied);
	const treeClosure = call("makeRecursive", tree);
	assert.deepEqual(treeClosure(true, leaf(first)), tree);
	assert.deepEqual(treeClosure(false, leaf(first)), leaf(first));
	let deep = leaf(first);
	for(let index = 0; index < 63; ++index) deep = branch(deep);
	assert.deepEqual(call("echoRecursive", deep), deep);
	const live = module._owned_live();
	module._owned_fail_after(1);
	assert.throws(() => call("echoRecord", bundle), /Owned Lean call failed/);
	module._owned_fail_after(0);
	assert.equal(module._owned_live(), live, "The failed native conversion rolled back its allocations");
	assert.deepEqual(call("echoRecord", bundle), bundle);
	const owners = module._owned_results();
	for(let index = 0; index < 300; ++index) assert.equal(call("serial", first), 1n << 100n);
	assert.equal(module._owned_results(), owners, "Scalar calls release each result instead of accumulating probe owners");
	const retained = first.retain(); assert.notEqual(retained, first);
	assert.equal(call("serial", retained), 1n << 100n);
	captured.dispose(); treeClosure.dispose(); second.dispose(); first.dispose();
	assert.throws(() => call("serial", first), /disposed/);
	assert.throws(() => captured(true, supplied), /disposed/);
	assert.equal(call("label", retained), "first\0💠", "The independently retained native lease is still valid");
	retained.dispose(); assert.equal(retained.dispose(), false);
	assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0); assert.equal(module._owned_identities(), 0);
	close(); assert.throws(() => captured(true, supplied));
});

test("all nineteen JS scalar fields and nested Options agree with compiled Lean on wasm32", {
	skip: !enabled, timeout: 360000
}, async t => {
	const { call, close, module } = await compileOwnedJavaScriptWasmFixture(t, "owned-scalars");
	const ticket = call("newTicket", 42n, "scalars");
	const scalars = { unit: undefined, flag: true, char: "💠"
		, natural: 1n << 200n, integer: -(1n << 201n)
		, u8: 255, u16: 65535, u32: 4294967295, u64: 18446744073709551615n
		, i8: -128, i16: -32768, i32: -2147483648, i64: -9223372036854775808n
		, word: 4294967295, signedWord: -2147483648, f32: Math.fround(1 / 3), f64: -0
		, text: "\ufeffstart\0💠", bytes: new Uint8Array([0, 255, 128]) };
	const options = [{ tag: "none" }, { tag: "some", value: { tag: "none" } }
		, { tag: "some", value: { tag: "some", value: undefined } }];
	for(const optional of options)
	{
		const packet = { ticket, scalars, optional, empty: {} };
		assert.deepEqual(call("echo", packet), packet);
	}
	assert.deepEqual(call("units", [undefined, undefined]), [undefined, undefined]);
	for(const [f32, f64] of [[NaN, NaN], [Infinity, -Infinity], [-0, Number.MIN_VALUE]])
	{
		const packet = { ticket, scalars: { ...scalars, f32, f64 }, optional: { tag: "none" }, empty: {} };
		assert.deepEqual(call("echo", packet), packet);
	}
	ticket.dispose(); assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0);
	close();
});

test("real Wasm result owners roll back failed JavaScript publication and remain usable", {
	skip: !enabled, timeout: 360000
}, async t => {
	let fail = false, leaked, attempts = 0, failAt = 0;
	const failure = new Error("JavaScript publication rejected");
	const { call, close, module } = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		afterProjection: value => {
			if(fail)
			{ leaked = value; throw failure; }
		}
		, registry: { checkpoint: () => { if(++attempts === failAt) throw failure; } }
	});
	const ticket = call("newTicket", 7n, "existing");
	const baseline = [module._owned_results(), module._owned_live(), module._owned_identities()];
	fail = true;
	assert.throws(() => call("newTicket", 8n, "unpublished"), error => error === failure);
	assert.equal(leaked.disposed, true); fail = false;
	assert.throws(() => call("serial", leaked), /disposed/);
	assert.deepEqual([module._owned_results(), module._owned_live(), module._owned_identities()], baseline);
	for(let checkpoint = 1; checkpoint <= 7; checkpoint++)
	{
		failAt = attempts + checkpoint;
		assert.throws(() => call("newTicket", 9n, "host allocation fault"), error => error === failure);
		failAt = 0;
		assert.deepEqual([module._owned_results(), module._owned_live(), module._owned_identities()], baseline, `Host allocation ${checkpoint}`);
		assert.equal(call("serial", ticket), 7n);
	}
	const next = call("newTicket", 10n, "recovered"); assert.equal(call("serial", next), 10n);
	next.dispose(); ticket.dispose(); assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0);
	close();
});
