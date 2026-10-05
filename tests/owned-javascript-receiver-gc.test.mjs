/**
 * Actual JavaScript garbage collection releases nominal native owners.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`JavaScript receiver owners are collectible (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_RECEIVER_TEST !== "1", timeout: 900000
}, async t => {
	assert.equal(typeof globalThis.gc, "function", "Receiver acceptance requires node --expose-gc");
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, transferredInputs: true
		, anchoredResults: true, receiverExports: true
		, fixtureOptions: { sourceSuffix: ownedRustReceiverSource
			, configuration: await ownedRustReceiverConfiguration()
			, evidenceName: `javascript-receiver-gc-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedRustReceiverReviewedIr() } : {}
	});
	let collections = 0;
	const collectUntil = async (predicate, label) => {
		for(let attempt = 0; attempt < 200; attempt++)
		{
			// A WeakRef dereference keeps its target until the next JS job.
			await setTimeout(5); globalThis.gc(); collections++; await setTimeout(5);
			if(predicate()) return;
		}
		assert.fail(label);
	};
	const fresh = () => fixture.call("newTicket", 42n, "collected receiver");
	const makeBorrowed = () => {
		const root = fresh(), borrowed = root.retainTicket(), raw = root.get();
		return { parent: new WeakRef(root), borrowed, raw, retained: borrowed.retain() };
	};
	const { parent, borrowed, raw, retained } = makeBorrowed();
	await collectUntil(() => !parent.deref() && borrowed.disposed, "Borrow or member closures retain the original owner");
	assert.throws(() => borrowed.serial, /expired|disposed/u);
	assert.throws(() => raw.serial, /expired|disposed/u);
	assert.equal(retained.serial, 42n); borrowed.dispose(); retained.dispose();
	await collectUntil(() => fixture.module._owned_results() === 0, "Collected parent retains native owners");
	const makeCycle = () => {
		const ticket = fresh();
		const type = fixture.layout.native.functions.find(fn => fn.name === "echoRecord").result;
		const record = fixture.copyValue(type, { primary: ticket.get()
			, spare: { tag: "none" }, peers: [], history: []
			, payload: { count: 0n, bytes: new Uint8Array() } });
		ticket.dispose();
		// Consumer-created cycles must not become finalizer holdings.
		record.get().consumerCycle = record;
		return new WeakRef(record);
	};
	const cycle = makeCycle();
	await collectUntil(() => !cycle.deref() && fixture.module._owned_results() === 0, "Nominal owner/payload cycle survives collection");
	const held = (() => { const root = fresh(); return { method: root.retainTicket, parent: new WeakRef(root) }; })();
	await setTimeout(5); globalThis.gc(); await setTimeout(5);
	assert.ok(held.parent.deref(), "A retained bound method keeps its receiver alive");
	const result = held.method(); assert.equal(result.serial, 42n);
	held.method = null;
	await collectUntil(() => !held.parent.deref() && result.disposed, "Released method retains its receiver");
	result.dispose();
	assert.equal(fixture.module._owned_results(), 0); assert.equal(fixture.module._owned_live(), 0);
	assert.equal(fixture.module._owned_identities(), 0); assert.equal(fixture.callbackCount(), 0);
	await saveLakeFile("build/owned-javascript-receivers", `${mode}-gc.json`, canonicalJson({
		schemaVersion: 1, profile: "owned-javascript-receiver-gc", mode
		, input: fixture.evidence.input, privateAbi: fixture.evidence.privateAbi
		, sourceSha256: sha256(await readFile(join(fixture.evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(fixture.evidence.directory, "probe.wasm")))
		, actualGc: true, collections, originalOwnerCollected: true
		, cycleCollected: true, retainedMethodPinsReceiver: true
		, owners: fixture.module._owned_results()
		, allocations: fixture.module._owned_live()
		, identities: fixture.module._owned_identities()
		, callbacks: fixture.callbackCount()
	}));
});
