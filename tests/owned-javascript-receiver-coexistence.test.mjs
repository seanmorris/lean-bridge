/**
 * Receiver members and copied Alpha handles coexist in the public shared loader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { runReceiverMembers } from "./fixtures/structured-types/owned-installed-javascript-receivers.mjs";
import { runBorrows } from "./fixtures/structured-types/owned-installed-javascript-borrows.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const alphaFirst of [false, true])
	test(`receiver members coexist with copied Alpha (${mode}, ${alphaFirst ? "copied" : "owned"} first)`, {
		skip: process.env.LEAN_BRIDGE_OWNED_JS_RECEIVER_TEST !== "1", timeout: 900000
	}, async t => {
		const preparedRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike");
		const f = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
			hostCallbacks: true, transferredInputs: true
			, anchoredResults: true, receiverExports: true
			, sharedRuntime: true, publicLoader: true, preparedRoot, alphaFirst
			, fixtureOptions: { sourceSuffix: ownedRustReceiverSource
				, configuration: await ownedRustReceiverConfiguration()
				, evidenceName: `javascript-receiver-coexistence-${mode}-${alphaFirst}-inputs.json` }
			, ...mode === "reviewed" ? { reviewedIr: ownedRustReceiverReviewedIr() } : {}
		});
		const { module } = f, api = f.shared.publicApi;
		const legacy = await f.shared.loadLegacy(), box = new legacy.Box(83);
		assert.equal(module._bridge_lean_runtime_init_runs(), 1);
		assert.equal(module._bridge_lean_library_init_runs(), 2);
		assert.equal(module._bridge_owned_runtime_components(), 1);
		const members = runReceiverMembers(api), borrows = runBorrows(api);
		assert.equal(members.checks, 60); assert.equal(borrows.checks, 232);
		assert.equal(box.read(), 83); assert.equal(module._bridge_lean_live_handles(), 1);
		assert.equal(module._bridge_owned_runtime_identities(), 0);
		const ticket = api.newTicket(42n, "coexisting receiver"), record = api.copyValue({ primary: ticket.get()
			, spare: { tag: "none" }, peers: [], history: []
			, payload: { count: 0n, bytes: new Uint8Array() } }, { receiverOf: "callbackRecord" });
		let callbackView;
		const result = record.callbackRecord(value => {
			callbackView = value.primary; assert.equal(box.read(), 83);
			assert.equal(module._bridge_lean_runtime_shutdown(), 0); return value;
		});
		assert.equal(callbackView.disposed, true); assert.equal(result.get().primary.serial, 42n);
		const retained = result.retain(); record.dispose(); assert.equal(result.disposed, true);
		assert.equal(retained.get().primary.serial, 42n);
		for(const root of [result, retained, ticket]) root.dispose();
		assert.equal(module._bridge_owned_runtime_identities(), 0);
		const closing = api.newTicket(1n, "closed receiver"), captured = closing.retainTicket;
		assert.equal(api.close(), true); assert.equal(api.close(), false);
		assert.throws(() => closing.serial, /closed|disposed|retired/u);
		assert.throws(() => captured(), /closed|disposed|retired/u);
		assert.equal(module._bridge_owned_runtime_components(), 0);
		assert.equal(box.read(), 83); assert.equal(module._bridge_lean_runtime_shutdown(), 0);
		box.dispose(); assert.equal(module._bridge_lean_live_handles(), 0);
		assert.equal(module._bridge_lean_runtime_shutdown(), 1);
		assert.throws(() => f.shared.runtime.loadComponent(f.shared.descriptor), /retired/u);
		await saveLakeFile("build/owned-javascript-receivers", `${mode}-${alphaFirst ? "copied" : "owned"}-first.json`, canonicalJson({
			schemaVersion: 1, profile: "owned-javascript-receiver-coexistence"
			, mode, alphaFirst, input: f.evidence.input
			, privateAbi: f.evidence.privateAbi, members, borrows
			, componentSha256: sha256(await readFile(join(f.evidence.directory, "owned.so.wasm")))
			, runtimeSha256: sha256(await readFile(join(preparedRoot, "lazy/main.wasm")))
			, alphaSha256: sha256(await readFile(join(preparedRoot, "lazy/alpha.so.wasm")))
			, runtimeInitializations: module._bridge_lean_runtime_init_runs()
			, libraryInitializations: module._bridge_lean_library_init_runs()
			, components: module._bridge_owned_runtime_components()
			, identities: module._bridge_owned_runtime_identities()
			, legacyHandles: module._bridge_lean_live_handles()
			, state: module._bridge_lean_runtime_status()
		}));
	});
