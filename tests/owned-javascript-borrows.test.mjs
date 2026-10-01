/**
 * Original-owner result lifetimes execute in actual JavaScript wasm32 heaps.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../src/build/javascript-wasm-owned-sources.mjs";
import { assertComponentOwnedWasmBindings } from "../src/abi/component-owned-wasm.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";
import { runBorrows } from "./fixtures/structured-types/owned-installed-javascript-borrows.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertOwnedJavaScriptBorrowCi } from "./helpers/owned-javascript-borrow-ci.mjs";

test("JavaScript result anchors require whole-owner capability and exact ABI metadata", async () => {
	const ir = ownedRustBorrowReviewedIr();
	assert.throws(() => compileOwnedJavaScriptWasmLayout(ir, { transferredInputs: true }), /explicit output leases/u);
	const layout = compileOwnedJavaScriptWasmLayout(ir, { transferredInputs: true, anchoredResults: true });
	assert.equal(layout.native.functions.length, 26);
	assert.equal(layout.native.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.equal(layout.native.functions.filter(fn => fn.transfers?.length).length, 4);
	const receipt = JSON.parse(await readFile("docs/evidence/owned-php-wasm-borrows-20261001.json", "utf8"));
	for(const { input } of receipt.runtime)
	{
		assert.throws(() => createOwnedJavaScriptWasmModel({ ...input, anchoredResults: false }), /owner-anchored result/u);
		const model = createOwnedJavaScriptWasmModel({ ...input, anchoredResults: true });
		assert.equal(model.schemaVersion, 9); assert.equal(model.ownedGraph.schemaVersion, 4);
		const adapters = generateOwnedJavaScriptWasmLeanAdapters(model);
		const generated = generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters);
		assert.equal(generated.privateAbi.version, 12); assert.equal(generated.receipt.schemaVersion, 3);
		assert.deepEqual(generated.receipt.resultAnchors, model.ownedGraph.resultAnchors);
		assert.equal(generated.privateAbi.resultAnchors.exports.length, 19);
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, value]) => [path, sha256(value)])));
		for(const mutate of [
			value => { value.version = 11; }
			, value => { delete value.resultAnchors; }
			, value => { value.resultAnchors.anchor = "snapshot"; }
			, value => { value.resultAnchors.exports.pop(); }
			, value => { value.resultAnchors.exports[0].parameter++; }
			, value => { value.resultAnchors.maximumDepth++; }
		]) {
			const changed = structuredClone(generated.privateAbi); mutate(changed);
			assert.throws(() => assertComponentOwnedWasmBindings(changed, model.bindingIr));
		}
		assert.equal(canonicalJson(generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters)), canonicalJson(generated));
	}
});

test("CI requires borrowed-result execution and every installed and runtime report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.equal(assertOwnedJavaScriptBorrowCi(workflow, manifest).tests, 25);
	for(const [before, after] of [
		["npm run test:owned-javascript-borrows", "true"]
		, ["      - name: Verify owner-anchored JavaScript results\n", "      - name: Verify owner-anchored JavaScript results\n        if: false\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/borrows.log\n", ""]
		, ["          rg '^# cancelled 0$' build/owned-javascript-wasm/borrows.log\n", ""]
		, ["            build/owned-javascript-borrows/ordinary-mutants.json\n", ""]
		, ["            build/owned-javascript-borrows/reviewed-copied-first.json\n", ""]
	]) {
		const changed = workflow.replace(before, after); assert.notEqual(changed, workflow);
		assert.throws(() => assertOwnedJavaScriptBorrowCi(changed, manifest));
	}
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-javascript-borrows"] = changed.scripts["test:owned-javascript-borrows"].replace("_TEST=1", "_TEST=0");
	assert.throws(() => assertOwnedJavaScriptBorrowCi(workflow, changed));
});

for(const mode of ["ordinary", "reviewed"]) test(`JavaScript whole owners preserve borrowed lifetimes (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	let failProjection = false, hostAttempt = 0, hostFailureAt = 0;
	const failure = { message: "Unpublished owner" };
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, transferredInputs: true, anchoredResults: true
		, afterProjection: () => { if(failProjection) throw failure; }
		, registry: { checkpoint: () => { if(++hostAttempt === hostFailureAt) throw failure; } }
		, fixtureOptions: {
			sourceSuffix: ownedRustBorrowSource
			, configuration: await ownedRustBorrowConfiguration()
			, evidenceName: `javascript-borrows-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedRustBorrowReviewedIr() } : {}
	});
	const { call, module, layout, copyValue } = fixture;
	const copy = (name, payload) => copyValue(layout.native.functions.find(fn => fn.name === name).result, payload);
	const fresh = (serial = 42n) => call("newTicket", serial, "borrowed\0💠");
	const expired = value => { assert.equal(value.disposed, true); assert.throws(() => value.get(), /disposed|expired/u); };
	const drained = () => {
		assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0); assert.equal(module._owned_identities(), 0);
	};
	const ticket = fresh(), raw = ticket.get(), shared = ticket.share(), borrowed = call("retainTicket", ticket);
	assert.equal(call("serial", ticket), 42n); assert.equal(call("serial", raw), 42n);
	assert.equal(raw.equals(borrowed.get()), true); assert.notEqual(raw, borrowed.get());
	const child = call("retainTicket", borrowed), retained = borrowed.retain();
	ticket.dispose(); assert.equal(call("serial", borrowed), 42n);
	shared.dispose(); expired(borrowed); expired(child); assert.equal(raw.disposed, true);
	assert.equal(call("serial", retained), 42n);
	for(const value of [borrowed, child, retained]) value.dispose(); drained();
	for(const [name, payload] of [["echoArray", []], ["echoList", []], ["echoOption", { tag: "none" }], ["echoNested", [[], [{ tag: "none" }]]]])
	{
		const root = copy(name, payload), alias = root.share(), result = call(name, root), independent = result.retain();
		assert.deepEqual(result.get(), payload); root.dispose(); assert.deepEqual(result.get(), payload);
		alias.dispose(); expired(result); assert.deepEqual(independent.get(), payload);
		result.dispose(); independent.dispose(); drained();
	}
	const moving = fresh(), dependent = call("retainTicket", moving), moveShared = moving.share();
	const moved = call("transferTicket", moving); expired(moving); expired(moveShared); expired(dependent);
	assert.equal(call("serial", moved), 42n);
	for(const value of [moving, moveShared, dependent, moved]) value.dispose(); drained();
	const empty = copy("echoArray", []), emptyChild = call("echoArray", empty);
	const emptyMoved = call("moveArray", empty); expired(empty); expired(emptyChild);
	assert.deepEqual(emptyMoved.get(), []); emptyChild.dispose(); emptyMoved.dispose(); drained();
	const origin = fresh(), originBorrow = call("retainTicket", origin);
	assert.throws(() => call("transferTicket", originBorrow), /borrowed/u);
	assert.throws(() => call("mixedTicket", origin, origin), /invalid argument/u);
	assert.equal(call("serial", origin), 42n);
	originBorrow.dispose(); origin.dispose(); drained();
	const base = fresh(), payload = { count: -(1n << 160n), bytes: new Uint8Array([0, 128, 255]) };
	const record = copy("echoRecord", { primary: base.get(), spare: { tag: "some", value: base.get() }, peers: [base.get()], history: [base.get()], payload });
	base.dispose(); let cached;
	const echoed = call("callbackRecord", record, value => { cached = value; return value; });
	assert.equal(call("serial", echoed.get().primary), 42n); assert.equal(cached.primary.disposed, true);
	const closure = call("makeRecord", record), fromClosure = closure.get()(true, record.get());
	assert.equal(call("serial", fromClosure.get().primary), 42n); fromClosure.dispose(); closure.dispose(); echoed.dispose();
	assert.throws(() => call("callbackRecord", record, value => { record.dispose(); return value; }), /invalid argument/u);
	expired(record); drained();
	const faultOwner = fresh();
	for(let index = 1; index <= 16; index++)
	{
		module._owned_fail_after(index); let result;
		try
{ result = call("retainTicket", faultOwner); }
		catch(error)
{ assert.match(error.message, /allocation/u); }
		finally
{ module._owned_fail_after(0); result?.dispose(); }
		assert.equal(call("serial", faultOwner), 42n);
	}
	failProjection = true;
	assert.throws(() => call("retainTicket", faultOwner), error => error === failure);
	failProjection = false; assert.equal(call("serial", faultOwner), 42n); faultOwner.dispose(); drained();
	const chain = [copy("echoArray", [])];
	for(let depth = 0; depth < 128; depth++) chain.push(call("echoArray", chain.at(-1)));
	assert.throws(() => call("echoArray", chain.at(-1)), error => error.status === 2);
	assert.deepEqual(chain.at(-1).get(), []); chain[0].dispose();
	for(const root of chain.slice(1))
	{ expired(root); root.dispose(); }
	drained();
	const capacity = fresh(), aliases = [];
	for(let index = 0; index < 4094; index++) aliases.push(capacity.share());
	assert.throws(() => capacity.share(), /registry is full/u);
	assert.throws(() => capacity.retain(), /registry is full/u);
	assert.equal(call("serial", capacity), 42n);
	for(const root of aliases) root.dispose(); capacity.dispose(); drained();
	const api = Object.fromEntries(layout.native.functions.map(fn => [fn.name, (...args) => call(fn.name, ...args)]));
	api.copyValue = (value, selector) => {
		const fn = layout.native.functions.find(fn => fn.name === selector?.resultOf);
		if(!fn) throw new TypeError("Unknown result selector");
		return copyValue(fn.result, value);
	};
	const observed = runBorrows(api); assert.equal(observed.exports, 26); assert.ok(observed.checks >= 200); drained();
	const faultCounts = {};
	for(const domain of ["native", "host"]) for(const kind of ["borrow", "copy", "move", "mixed"])
	{
		const counts = { before: 0, after: 0 }; let complete = false;
		for(let index = 1; index <= 512; index++)
		{
			const base = fresh(), consumed = fresh(0n);
			const record = copy("echoRecord", { primary: base.get()
				, spare: { tag: "some", value: base.get() }
				, peers: [base.get(), base.get()], history: [base.get()], payload });
			const child = call("primary", record), shared = record.share();
			let result, caught, rejected = false;
			if(domain === "native") module._owned_fail_after(index);
			else hostFailureAt = hostAttempt + index;
			try
			{
				result = kind === "borrow" ? call("echoRecord", record)
					: kind === "copy" ? record.retain()
						: kind === "move" ? call("moveRecord", record, value => value)
							: call("mixedTicket", base, consumed);
			}
			catch(error)
			{ caught = error; rejected = true; }
			finally
			{ module._owned_fail_after(0); hostFailureAt = 0; }
			const moved = kind === "move" ? record.disposed : kind === "mixed" ? consumed.disposed : false;
			if(rejected)
			{
				if(domain === "host") assert.equal(caught, failure, `${kind} host checkpoint ${index}`);
				else assert.ok([3, 10].includes(caught.status), `${kind} native checkpoint ${index}: ${caught.stack}`);
				counts[moved ? "after" : "before"]++;
			}
			if(kind === "move")
			{
				assert.equal(shared.disposed, moved); assert.equal(child.disposed, moved);
				if(!moved) assert.equal(call("serial", child), 42n);
			}
			assert.equal(call("serial", base), 42n);
			result?.dispose();
			for(const owner of [child, shared, record, consumed, base]) owner.dispose();
			drained();
			if(!rejected)
			{ complete = true; break; }
		}
		assert.ok(complete, `${domain} ${kind} fault sweep must terminate`);
		assert.ok(counts.before > 0, `${domain} ${kind} pre-handoff failures`);
		if(["move", "mixed"].includes(kind)) assert.ok(counts.after > 0, `${domain} ${kind} post-handoff failures`);
		faultCounts[`${domain}:${kind}`] = counts;
	}
	const evidence = fixture.evidence;
	const report = { schemaVersion: 1, profile: "owned-javascript-borrows", mode
		, input: evidence.input, privateAbi: evidence.privateAbi
		, observed, faultCounts, limits: { borrowDepth: 128, hostWrappers: 4096 }
		, sourceSha256: sha256(await readFile(join(evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(evidence.directory, "probe.wasm")))
		, liveAllocations: module._owned_live()
		, liveOwners: module._owned_results()
		, liveIdentities: module._owned_identities() };
	await saveLakeFile("build/owned-javascript-borrows", `${mode}.json`, canonicalJson(report));
	t.diagnostic(JSON.stringify({ observed, faultCounts }));
});

for(const mode of ["ordinary", "reviewed"]) test(`JavaScript keeps empty borrowed owners without consuming exports (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, anchoredResults: true
		, fixtureOptions: { configuration: await ownedBorrowConfiguration(), evidenceName: `javascript-borrow-only-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedBorrowReviewedIr() } : {}
	});
	for(const [name, payload] of [["echoArray", []], ["echoList", []], ["echoOption", { tag: "none" }], ["echoNested", [[]]]])
	{
		const type = fixture.layout.native.functions.find(fn => fn.name === name).result;
		const root = fixture.copyValue(type, payload), borrow = fixture.call(name, root), retained = borrow.retain();
		root.dispose(); assert.throws(() => borrow.get(), /expired/u); assert.deepEqual(retained.get(), payload);
		borrow.dispose(); retained.dispose();
	}
	assert.equal(fixture.module._owned_results(), 0); assert.equal(fixture.module._owned_live(), 0);
	assert.equal(fixture.module._owned_identities(), 0);
	const { evidence, layout } = fixture;
	assert.equal(layout.native.functions.length, 22);
	assert.equal(layout.native.functions.filter(fn => fn.anchor !== undefined).length, 18);
	assert.equal(layout.native.functions.filter(fn => fn.transfers?.length).length, 0);
	await saveLakeFile("build/owned-javascript-borrows", `${mode}-borrow-only.json`, canonicalJson({
		schemaVersion: 1, profile: "owned-javascript-borrow-only", mode
		, input: evidence.input, privateAbi: evidence.privateAbi, emptyShapes: 4
		, sourceSha256: sha256(await readFile(join(evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(evidence.directory, "probe.wasm")))
		, liveAllocations: fixture.module._owned_live()
		, liveOwners: fixture.module._owned_results()
		, liveIdentities: fixture.module._owned_identities()
	}));
});
