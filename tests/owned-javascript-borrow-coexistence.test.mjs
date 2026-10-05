/**
 * Whole-value borrows and copied Alpha handles share one production runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { runBorrows } from "./fixtures/structured-types/owned-installed-javascript-borrows.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const alphaFirst of [false, true])
	test(`borrowed values coexist with copied Alpha (${mode}, ${alphaFirst ? "copied" : "owned"} first)`, {
		skip: process.env.LEAN_BRIDGE_OWNED_JS_BORROW_TEST !== "1", timeout: 600000
	}, async t => {
		const preparedRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike");
		const f = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
			hostCallbacks: true, transferredInputs: true, anchoredResults: true
			, sharedRuntime: true, publicLoader: true, preparedRoot, alphaFirst
			, fixtureOptions: { sourceSuffix: ownedRustBorrowSource
				, configuration: await ownedRustBorrowConfiguration()
				, evidenceName: `javascript-borrow-coexistence-${mode}-${alphaFirst}-inputs.json` }
			, ...mode === "reviewed" ? { reviewedIr: ownedRustBorrowReviewedIr() } : {}
		});
		const { module } = f, api = f.shared.publicApi;
		const legacy = await f.shared.loadLegacy(), box = new legacy.Box(83);
		assert.equal(module._bridge_lean_runtime_init_runs(), 1);
		assert.equal(module._bridge_lean_library_init_runs(), 2);
		assert.equal(module._bridge_owned_runtime_components(), 1);
		const observed = runBorrows(api);
		assert.equal(observed.checks, 232); assert.equal(observed.exports, 26);
		assert.equal(box.read(), 83); assert.equal(module._bridge_lean_live_handles(), 1);
		assert.equal(module._bridge_owned_runtime_identities(), 0);
		const ticket = api.newTicket(42n, "coexisting borrowed value");
		const record = api.copyValue({ primary: ticket.get()
			, spare: { tag: "none" }, peers: [], history: []
			, payload: { count: 0n, bytes: new Uint8Array() } }, { resultOf: "echoRecord" });
		let callbackView;
		const result = api.callbackRecord(record, value => {
			callbackView = value.primary; assert.equal(box.read(), 83);
			assert.equal(module._bridge_lean_runtime_shutdown(), 0); return value;
		});
		assert.equal(callbackView.disposed, true); assert.equal(api.serial(result.get().primary), 42n);
		const retained = result.retain(); record.dispose(); assert.equal(result.disposed, true);
		assert.equal(api.serial(retained.get().primary), 42n);
		for(const root of [result, retained, ticket]) root.dispose();
		assert.equal(module._bridge_owned_runtime_identities(), 0);
		assert.equal(api.close(), true); assert.equal(api.close(), false);
		assert.equal(module._bridge_owned_runtime_components(), 0);
		assert.equal(box.read(), 83); assert.equal(module._bridge_lean_runtime_shutdown(), 0);
		box.dispose(); assert.equal(module._bridge_lean_live_handles(), 0);
		assert.equal(module._bridge_lean_runtime_shutdown(), 1);
		assert.throws(() => f.shared.runtime.loadComponent(f.shared.descriptor), /retired/u);
		const report = { schemaVersion: 1
			, profile: "owned-javascript-borrow-coexistence", mode, alphaFirst
			, input: f.evidence.input, privateAbi: f.evidence.privateAbi, observed
			, componentSha256: sha256(await readFile(join(f.evidence.directory, "owned.so.wasm")))
			, runtimeSha256: sha256(await readFile(join(preparedRoot, "lazy/main.wasm")))
			, alphaSha256: sha256(await readFile(join(preparedRoot, "lazy/alpha.so.wasm")))
			, runtimeInitializations: module._bridge_lean_runtime_init_runs()
			, libraryInitializations: module._bridge_lean_library_init_runs()
			, components: module._bridge_owned_runtime_components()
			, identities: module._bridge_owned_runtime_identities()
			, legacyHandles: module._bridge_lean_live_handles()
			, state: module._bridge_lean_runtime_status() };
		await saveLakeFile("build/owned-javascript-borrows", `${mode}-${alphaFirst ? "copied" : "owned"}-first.json`, canonicalJson(report));
	});
