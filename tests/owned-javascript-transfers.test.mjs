/**
 * Consuming JS inputs execute fresh Lean code in the real wasm32 heap.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../src/build/javascript-wasm-owned-sources.mjs";
import { assertComponentOwnedWasmBindings } from "../src/abi/component-owned-wasm.mjs";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertOwnedJavaScriptTransferCi } from "./helpers/owned-javascript-transfer-ci.mjs";

test("JavaScript consuming layouts require an explicit adapter capability", () => {
	const ir = ownedRustTransferReviewedIr();
	assert.throws(() => compileOwnedJavaScriptWasmLayout(ir), /call-scoped input borrows/u);
	const layout = compileOwnedJavaScriptWasmLayout(ir, { transferredInputs: true });
	assert.equal(layout.native.functions.length, 26);
	assert.equal(layout.native.functions.filter(fn => fn.transfers?.length).length, 20);
});

test("consuming JS components authenticate the input-transfer ABI and reject weakened receipts", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/owned-php-wasm-transfers-20260930.json", "utf8"));
	for(const { input } of receipt.runtime)
	{
		const model = createOwnedJavaScriptWasmModel(input), adapters = generateOwnedJavaScriptWasmLeanAdapters(model);
		assert.equal(model.schemaVersion, 8); assert.equal(model.ownedGraph.schemaVersion, 3);
		const generated = generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters);
		assert.equal(generated.privateAbi.version, 11); assert.equal(generated.receipt.schemaVersion, 2);
		assert.deepEqual(generated.receipt.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(generated.privateAbi.inputTransfers.exports.length, 20);
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, source]) => [path, sha256(source)])));
		for(const mutate of [
			value => { value.schemaVersion = 7; }
			, value => { value.ownedGraph.schemaVersion = 2; }
			, value => { delete value.ownedGraph.inputTransfers; }
			, value => { value.ownedGraph.inputTransfers.ownership = "one-wrapper"; }
			, value => { value.ownedGraph.inputTransfers.consumption = "after-lean-call"; }
			, value => { value.ownedGraph.inputTransfers.exports.pop(); }
			, value => { delete value.ownedGraph.hostCallbacks; }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => generateOwnedJavaScriptWasmLeanAdapters(changed));
			assert.throws(() => generateCompiledJavaScriptWasmOwned(changed, input.metadata, adapters));
		}
		for(const mutate of [
			value => { value.version = 10; }
			, value => { delete value.inputTransfers; }
			, value => { value.inputTransfers.consumedOffset = 0; }
			, value => { value.inputTransfers.exports.pop(); }
			, value => { value.inputTransfers.extra = true; }
		]) {
			const changed = structuredClone(generated.privateAbi); mutate(changed);
			assert.throws(() => assertComponentOwnedWasmBindings(changed, model.bindingIr));
		}
		assert.equal(canonicalJson(generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters)), canonicalJson(generated));
	}
});

test("CI executes consuming JavaScript packages and rejects skipped checks or missing reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.equal(assertOwnedJavaScriptTransferCi(workflow, manifest).reports, 3);
	for(const [before, after] of [
		["npm run test:owned-javascript-transfers", "true"]
		, ["      - name: Verify consuming JavaScript input ownership\n", "      - name: Verify consuming JavaScript input ownership\n        if: false\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/transfers.log\n", ""]
		, ["            build/owned-javascript-transfer-packaging/report.json\n", ""]
	]) {
		const changed = workflow.replace(before, after); assert.notEqual(changed, workflow);
		assert.throws(() => assertOwnedJavaScriptTransferCi(changed, manifest));
	}
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-javascript-transfers"] = changed.scripts["test:owned-javascript-transfers"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedJavaScriptTransferCi(workflow, changed));
});

for(const mode of ["ordinary", "reviewed"]) test(`JavaScript consumes original owners before Lean callback reentry (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_TRANSFER_TEST !== "1", timeout: 600000
}, async t => {
	let publicationFailure = false, checkpointFailure = 0, checkpoints = 0;
	const publicationError = { reason: "JS publication failure" };
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, transferredInputs: true
		, afterProjection: () => { if(publicationFailure) throw publicationError; }
		, registry: { checkpoint: () => { if(++checkpoints === checkpointFailure) throw publicationError; } }
		, fixtureOptions: { sourceSuffix: ownedRustTransferSource
			, configuration: await ownedRustTransferConfiguration()
			, evidenceName: `javascript-transfers-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedRustTransferReviewedIr() } : {}
	});
	const { call, module, close } = fixture, names = new Set();
	const run = (name, ...args) => { names.add(name); return call(name, ...args); };
	const fresh = (serial = 42n) => run("newTicket", serial, "transferred\0💠");
	const release = value => {
		if(value === null || value === undefined) return;
		if(typeof value.dispose === "function")
		{ value.dispose(); return; }
		if(typeof value === "object") for(const item of Object.values(value)) release(item);
	};
	const payload = { count: -(1n << 160n), bytes: new Uint8Array([0, 128, 255]) };
	const bundle = ticket => ({ primary: ticket, spare: { tag: "some", value: ticket }, peers: [ticket, ticket], history: [ticket], payload });
	const verify = (name, create) => {
		const ticket = fresh(), input = create(ticket), retained = ticket.retain();
		const output = run(name, input); assert.equal(ticket.disposed, true, name);
		assert.equal(run("serial", retained), 42n); assert.equal(run("label", retained), "transferred\0💠");
		assert.throws(() => run("serial", ticket), /disposed/); release(output); retained.dispose();
	};
	for(const [name, create] of [
		["retainTicket", value => value], ["echoArray", value => [value, value]]
		, ["echoList", value => [value]]
		, ["echoOption", value => ({ tag: "some", value })]
		, ["echoResult", value => ({ ok: bundle(value) })]
		, ["echoResult", error => ({ error })]
		, ["echoTuple", value => [value, [{ tag: "some", value }, payload]]]
		, ["echoRecord", bundle], ["echoAlias", bundle]
		, ["echoVariant", ticket => ({ kind: "one", ticket })]
		, ["echoVariant", ticket => ({ kind: "many", tickets: [ticket, ticket] })]
		, ["echoRow", value => [{ tag: "none" }, { tag: "some", value }]]
		, ["echoRecursive", ticket => ({ kind: "branch", children: [{ kind: "leaf", ticket }] })]
		, ["echoNested", value => [[{ tag: "some", value: { ok: bundle(value) } }], []]]
		, ["echoChain", ticket => ({ kind: "link", ticket, next: { tag: "some", value: { kind: "stop" } } })]
		, ["makeRecord", bundle]
		, ["makeRecursive", ticket => ({ kind: "leaf", ticket })]
		, ["echoMixed", ticket => ({ ticket
			, markers: [{ tag: "none" }, { tag: "some", value: { tag: "some", value: false } }]
			, unit: { tag: "some", value: undefined }, result: { error: ticket }
			, signed: -(1n << 200n), unsigned: 1n << 201n, scalar: "💠"
			, precise: -0, approximate: Math.fround(1 / 3)
			, bytes: new Uint8Array([0, 255])
			, words: [0n, 18446744073709551615n]
			, product: [ticket, [{ tag: "some", value: ticket }, payload]]
			, chain: { kind: "link", ticket, next: { tag: "none" } } })]
	]) verify(name, create);
	for(const [name, input] of [
		["echoArray", []], ["echoList", []], ["echoOption", { tag: "none" }]
		, ["echoVariant", { kind: "empty" }], ["echoChain", { kind: "stop" }]
	]) assert.deepEqual(run(name, input), input);
	{
		const first = fresh(), second = fresh(7n);
		const pair = run("echoVariant", { kind: "pair", first, second });
		assert.equal(first.disposed, true); assert.equal(second.disposed, true);
		const retained = pair.second.retain(), output = run("retainTicket", pair.first);
		assert.equal(pair.first.disposed, true); assert.equal(pair.second.disposed, true);
		assert.equal(run("serial", retained), 7n); release(output); retained.dispose();
	}
	{
		const first = fresh(), second = fresh(7n);
		assert.throws(() => run("bundle", first, { tag: "none" }, [first], [], payload), /multiple consuming/);
		assert.equal(first.disposed, false);
		const output = run("bundle", first, { tag: "some", value: second }, [second], [], payload);
		assert.equal(first.disposed, true); assert.equal(second.disposed, true);
		assert.equal(run("primary", output), output.primary); assert.deepEqual(run("payload", output), payload); release(output);
	}
	{
		const ticket = fresh(), input = bundle(ticket); let calls = 0, kept;
		const output = run("callbackRecord", input, argument => {
			calls++; assert.equal(ticket.disposed, true);
			assert.throws(() => run("serial", ticket), /disposed/);
			assert.throws(() => run("echoRecord", argument), /borrowed callback/);
			kept = argument.primary.retain(); return argument;
		});
		assert.equal(calls, 1); assert.equal(run("serial", kept), 42n); kept.dispose(); release(output);
		const failed = fresh(), sentinel = { failure: "after handoff" };
		assert.throws(() => run("callbackRecord", bundle(failed), () => { throw sentinel; }), error => error === sentinel);
		assert.equal(failed.disposed, true);
	}
	{
		const ticket = fresh(), output = run("callbackRecursive", { kind: "leaf", ticket }, tree => tree);
		assert.equal(ticket.disposed, true); release(output);
		const closure = run("newRecordCallback"), moved = run("transferCallback", closure);
		assert.equal(closure.disposed, true); assert.equal(moved.disposed, false);
		assert.throws(() => run("transferCallback", value => value), /foreign or wrong-type/);
		const argument = fresh(); release(moved(bundle(argument))); argument.dispose(); moved.dispose();
	}
	{
		const ticket = fresh(), input = bundle(ticket);
		assert.throws(() => run("echoRecord", { ...input, payload: { ...payload, count: "bad" } }));
		assert.throws(() => run("echoArray", Array.from({ length: 4097 }, () => ticket)), /retained budget/);
		const cyclic = { kind: "branch", children: [{ kind: "leaf", ticket }] }; cyclic.children.push(cyclic);
		assert.throws(() => run("echoRecursive", cyclic), /cyclic/);
		assert.equal(ticket.disposed, false); assert.equal(run("serial", ticket), 42n); ticket.dispose();
	}
	let hostBefore = 0, hostAfter = 0;
	{
		const ticket = fresh(); publicationFailure = true;
		assert.throws(() => run("echoRecord", bundle(ticket)), error => error === publicationError);
		publicationFailure = false; assert.equal(ticket.disposed, true);
		assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0);
		for(let offset = 1; offset <= 12; offset++)
		{
			const ticket = fresh(); checkpointFailure = checkpoints + offset;
			try
			{ release(run("echoRecord", bundle(ticket))); }
			catch(error)
			{ assert.equal(error, publicationError); if(ticket.disposed) hostAfter++; else hostBefore++; }
			finally
			{ checkpointFailure = 0; ticket.dispose(); }
			assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0);
		}
	}
	let before = 0, after = 0, successful = false;
	for(let allocation = 1; allocation <= 200; allocation++)
	{
		const ticket = fresh(); module._owned_fail_after(allocation);
		try
		{ const output = run("echoRecord", bundle(ticket)); release(output); successful = true; }
		catch(error)
		{
			assert.match(error.message, /native allocation failed/);
			if(ticket.disposed) after++; else before++;
		}
		finally
		{ module._owned_fail_after(0); ticket.dispose(); }
		assert.equal(module._owned_results(), 0, `Result owners after allocation ${allocation}`);
		assert.equal(module._owned_live(), 0, `Native allocations after allocation ${allocation}`);
		assert.equal(module._owned_identities(), 0, `Native identities after allocation ${allocation}`);
		if(successful) break;
	}
	assert.ok(before > 0 && after > 0 && successful);
	assert.ok(hostBefore > 0 && hostAfter > 0);
	assert.equal(names.size, 26);
	const report = { schemaVersion: 1, mode
		, profile: "owned-javascript-input-transfers"
		, input: fixture.evidence.input, privateAbi: fixture.evidence.privateAbi
		, binarySha256: sha256(await readFile(fixture.evidence.directory + "/probe.wasm"))
		, sourceSha256: sha256(await readFile(fixture.evidence.directory + "/probe.c"))
		, nativeFaults: { before, after }
		, hostFaults: { before: hostBefore, after: hostAfter }
		, exports: [...names].sort(), liveOwners: module._owned_results()
		, liveAllocations: module._owned_live()
		, liveIdentities: module._owned_identities()
		, runtimeInitializations: module._owned_initializations() };
	await saveLakeFile("build/owned-javascript-transfers", mode + ".json", canonicalJson(report));
	t.diagnostic(JSON.stringify({ before, after, hostBefore, hostAfter
		, exports: names.size }));
	close();
});
