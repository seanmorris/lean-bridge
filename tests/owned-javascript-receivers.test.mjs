/**
 * Receiver methods execute compiled Lean in the JavaScript wasm32 heap.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { runBorrows } from "./fixtures/structured-types/owned-installed-javascript-borrows.mjs";
import { runReceiverMembers } from "./fixtures/structured-types/owned-installed-javascript-receivers.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkOwnedJavaScriptReceiverFaults } from "./helpers/owned-javascript-receiver-faults.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_JS_RECEIVER_TEST === "1";
const publicApi = fixture => ({
	...Object.fromEntries(fixture.layout.native.functions.map(fn => [fn.name, (...args) => fixture.call(fn.name, ...args)]))
	, copyValue: (value, selector) => fixture.copyValue(fixture.layout.native.functions.find(fn => fn.name === selector.resultOf).result, value)
});
const drained = fixture => {
	assert.equal(fixture.module._owned_results(), 0); assert.equal(fixture.module._owned_live(), 0);
	assert.equal(fixture.module._owned_identities(), 0); assert.equal(fixture.callbackCount(), 0);
};

for(const mode of ["ordinary", "reviewed"]) test(`JavaScript receiver members preserve original owners (${mode})`, { skip: !enabled, timeout: 900000 }, async t => {
	const faults = { failAt: 0, attempt: 0, projection: false, failure: null };
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, transferredInputs: true, anchoredResults: true
		, receiverExports: true
		, afterProjection: () => { if(faults.projection) throw faults.failure; }
		, registry: { checkpoint: () => { if(++faults.attempt === faults.failAt) throw faults.failure; } }
		, fixtureOptions: { sourceSuffix: ownedRustReceiverSource
			, configuration: await ownedRustReceiverConfiguration()
			, evidenceName: `javascript-receivers-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedRustReceiverReviewedIr() } : {}
	});
	const api = publicApi(fixture), members = runReceiverMembers(api); drained(fixture);
	const borrows = runBorrows(api); drained(fixture);
	const failureCleanup = checkOwnedJavaScriptReceiverFaults(fixture, faults); drained(fixture);
	await saveLakeFile("build/owned-javascript-receivers", `${mode}.json`, canonicalJson({
		schemaVersion: 1, profile: "owned-javascript-receivers", mode
		, input: fixture.evidence.input
		, privateAbi: fixture.evidence.privateAbi, members, borrows, failureCleanup
		, sourceSha256: sha256(await readFile(join(fixture.evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(fixture.evidence.directory, "probe.wasm")))
		, compiledLean: true, installedPackage: false
		, owners: fixture.module._owned_results()
		, allocations: fixture.module._owned_live()
		, identities: fixture.module._owned_identities()
		, callbacks: fixture.callbackCount()
	}));
	t.diagnostic(JSON.stringify({ members, borrows, failureCleanup }));
});

for(const mode of ["ordinary", "reviewed"]) for(const consuming of [false, true]) test(`JavaScript resource-only receiver members (${mode}, consuming=${consuming})`, { skip: !enabled, timeout: 900000 }, async t => {
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		receiverExports: true, transferredInputs: consuming, hostCallbacks: false
		, anchoredResults: false
		, fixtureOptions: { sourceSuffix: ownedJvmPlainReceiverSource
			, configuration: await ownedJvmPlainReceiverConfiguration(consuming, false)
			, evidenceName: `javascript-receivers-${mode}-plain-${consuming}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedJvmPlainReceiverReviewedIr(consuming) } : {}
	});
	const root = fixture.call("newTicket", 42n, "plain"), shared = root.share(), raw = root.get();
	const kept = root.retainTicket(), fromRaw = raw.retainTicket(), retained = root.retain();
	assert.equal(root.serial, 42n); assert.equal(raw.serial, 42n); assert.equal(root.pingTicket, undefined);
	assert.equal(raw.pingTicket, undefined); root.dispose(); assert.equal(shared.serial, 42n);
	assert.throws(() => root.serial); shared.dispose(); assert.throws(() => raw.serial);
	assert.equal(kept.serial, 42n); assert.equal(fromRaw.serial, 42n);
	if(consuming)
	{
		const alias = kept.share(), moved = kept.transferTicket();
		assert.equal(kept.disposed, true); assert.equal(alias.disposed, true);
		assert.equal(moved.serial, 42n); moved.dispose(); alias.dispose();
	}
	assert.equal(retained.serial, 42n);
	for(const value of [root, shared, kept, fromRaw, retained]) value.dispose(); drained(fixture);
	assert.equal(fixture.evidence.privateAbi.callbackKey, null);
	assert.equal(fixture.evidence.privateAbi.resultAnchors, undefined);
	await saveLakeFile("build/owned-javascript-receivers", `${mode}-plain-${consuming}.json`, canonicalJson({
		schemaVersion: 1, profile: "owned-javascript-resource-receivers"
		, mode, consuming
		, input: fixture.evidence.input, privateAbi: fixture.evidence.privateAbi
		, sourceSha256: sha256(await readFile(join(fixture.evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(fixture.evidence.directory, "probe.wasm")))
		, compiledLean: true, installedPackage: false
		, owners: fixture.module._owned_results()
		, allocations: fixture.module._owned_live()
		, identities: fixture.module._owned_identities()
		, callbacks: fixture.callbackCount()
	}));
});
