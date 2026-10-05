/**
 * Callback-local anchors compose with consuming receivers and other borrows.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reviewedOwnedSourceSelection, validateReviewedOwnedSource } from "../src/analyze/reviewed-owned-source.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedCallbackResultCombinedConfiguration, ownedCallbackResultCombinedReviewedIr, ownedCallbackResultCombinedSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("combined callback capabilities preserve independent receiver and local-anchor decisions", async () => {
	const ir = ownedCallbackResultCombinedReviewedIr(), source = canonicalJson(ir);
	const review = { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source)
		, semanticSha256: sha256(canonicalizeJsonValue(ir)) };
	validateReviewedOwnedSource(review);
	assert.deepEqual(reviewedOwnedSourceSelection(review).contracts, (await ownedCallbackResultCombinedConfiguration()).contracts);
	const capabilities = { callbackResultAnchors: true, anchoredResults: true
		, transferredInputs: true, receiverExports: true };
	const layout = compileOwnedJavaScriptWasmLayout(ir, capabilities);
	assert.equal(layout.native.callbacks.filter(item => item.anchor !== undefined).length, 4);
	assert.equal(layout.native.functions.filter(item => item.receiver === 0).length, 4);
	assert.deepEqual(layout.native.functions.find(item => item.name === "moveRecord").transfers, [0]);
	assert.equal(layout.native.functions.find(item => item.name === "borrowRecord").anchor, 0);
	for(const name of Object.keys(capabilities)) assert.throws(() => compileOwnedJavaScriptWasmLayout(ir, { ...capabilities, [name]: false }), undefined, name);
});

for(const mode of ["ordinary", "reviewed"]) test(`callback-result lifetimes compose with receiver transfers (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
	, timeout: 600000
}, async t => {
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, callbackResultAnchors: true, anchoredResults: true
		, transferredInputs: true, receiverExports: true
		, fixtureOptions: { configuration: await ownedCallbackResultCombinedConfiguration()
			, sourceSuffix: ownedCallbackResultCombinedSource
			, evidenceName: `callback-result-combinations-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedCallbackResultCombinedReviewedIr() } : {}
	});
	const { call, module } = fixture, roots = [];
	const own = value => { roots.push(value); return value; };
	const expired = value => { assert.equal(value.disposed, true); assert.throws(() => value.get(), /expired|disposed/u); };
	const ticket = own(call("newTicket", 42n, "receiver"));
	const root = own(call("echoRecord", { primary: ticket.get()
		, spare: { tag: "none" }, peers: [], history: []
		, payload: { count: 7n, bytes: new Uint8Array([42]) } }));
	const alias = own(root.share()), closure = own(root.makeRecord());
	const view = own(closure.get()(false, root)), nested = own(view.borrowRecord());
	const retained = own(nested.retain());
	root.dispose(); assert.equal(call("serial", nested.get().primary), 42n);
	assert.throws(() => view.moveRecord(value => value), /borrowed|transfer/u);
	assert.equal(call("serial", alias.get().primary), 42n);
	let escaped, callbacks = 0;
	const moved = own(alias.moveRecord(value => {
		callbacks++; expired(root); expired(alias); expired(view); expired(nested);
		escaped = value.primary; assert.equal(call("serial", escaped), 42n);
		return value;
	}));
	assert.equal(callbacks, 1); assert.equal(escaped.disposed, true);
	assert.throws(() => call("serial", escaped), /expired|disposed/u);
	assert.equal(call("serial", moved.get().primary), 42n);
	assert.equal(call("serial", retained.get().primary), 42n);
	const capturedAfterMove = own(closure.get()(true, moved));
	assert.equal(call("serial", capturedAfterMove.get().primary), 42n);
	moved.dispose(); expired(capturedAfterMove);
	const failure = new Error("consuming callback failed");
	const second = own(retained.retain()), secondClosure = own(second.makeRecord());
	const secondView = own(secondClosure.get()(false, second));
	assert.throws(() => second.moveRecord(() => { throw failure; }), error => error === failure);
	expired(second); expired(secondView);
	assert.equal(call("serial", retained.get().primary), 42n);
	for(const value of roots.reverse()) value.dispose();
	const live = [module._owned_results(), module._owned_live(), module._owned_identities(), fixture.callbackCount()];
	assert.deepEqual(live, [0, 0, 0, 0]);
	await saveLakeFile("build/owned-callback-results", `wasm-${mode}-combinations.json`, canonicalJson({
		mode, input: fixture.evidence.input, privateAbi: fixture.evidence.privateAbi
		, methods: 4, callbackAnchors: 4, callbackCalls: callbacks, live
		, transferredReceiver: true, nestedExpiration: true
		, failedTransferConsumesOwner: true, borrowedTransferRejected: true
	}));
	t.diagnostic(`${mode}: callback, receiver, export-anchor and transfer capabilities execute together; zero live owners`);
});
