/**
 * Callback-result owners coexist with legacy components in the production heap.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const alphaFirst of [false, true])
	test(`callback result owners share the production heap (${mode}, ${alphaFirst ? "copied" : "owned"} first)`, {
		skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
		, timeout: 600000
	}, async t => {
		const preparedRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike");
		const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
			hostCallbacks: true, callbackResultAnchors: true
			, sharedRuntime: true, publicLoader: true, preparedRoot, alphaFirst
			, fixtureOptions: {
				configuration: await ownedCallbackResultConfiguration()
				, sourceSuffix: ownedCallbackResultSource
				, evidenceName: `callback-result-coexistence-${mode}-${alphaFirst}-inputs.json`
			}
			, ...mode === "reviewed" ? { reviewedIr: ownedCallbackResultReviewedIr() } : {}
		});
		const api = fixture.shared.publicApi, { module } = fixture;
		const legacy = await fixture.shared.loadLegacy(), box = new legacy.Box(83);
		assert.equal(module._bridge_lean_runtime_init_runs(), 1);
		assert.equal(module._bridge_lean_library_init_runs(), 2);
		assert.equal(module._bridge_owned_runtime_components(), 1);
		const ticket = api.newTicket(42n, "shared callback");
		const input = api.copyValue({ primary: ticket.get(), spare: { tag: "none" }
			, peers: [], history: []
			, payload: { count: -99n, bytes: new Uint8Array([0, 255]) }
		}, { resultOf: "echoRecord" });
		const closure = api.makeRecord(input), result = closure.get()(false, input);
		const descendant = closure.get()(false, result), retained = descendant.retain();
		closure.dispose(); input.dispose();
		assert.equal(result.disposed, true); assert.equal(descendant.disposed, true);
		assert.throws(() => result.get(), /expired|disposed/u);
		assert.equal(api.serial(retained.get().primary), 42n);
		let escaped;
		const returned = api.callbackRecord(retained, value => {
			escaped = value.primary; assert.equal(box.read(), 83);
			assert.equal(module._bridge_lean_runtime_shutdown(), 0); return value;
		});
		assert.equal(escaped.disposed, true); assert.equal(api.serial(returned.get().primary), 42n);
		for(const value of [result, descendant, retained, returned, ticket]) value.dispose();
		assert.equal(module._bridge_owned_runtime_identities(), 0);
		assert.equal(api.close(), true); assert.equal(api.close(), false);
		assert.equal(module._bridge_owned_runtime_components(), 0);
		assert.equal(box.read(), 83); assert.equal(module._bridge_lean_runtime_shutdown(), 0);
		box.dispose(); assert.equal(module._bridge_lean_live_handles(), 0);
		assert.equal(module._bridge_lean_runtime_shutdown(), 1);
		assert.throws(() => fixture.shared.runtime.loadComponent(fixture.shared.descriptor), /retired/u);
		await saveLakeFile("build/owned-callback-results", `coexistence-${mode}-${alphaFirst}.json`, canonicalJson({
			mode, alphaFirst, input: fixture.evidence.input
			, privateAbi: fixture.evidence.privateAbi
			, componentSha256: sha256(await readFile(join(fixture.evidence.directory, "owned.so.wasm")))
			, runtimeSha256: sha256(await readFile(join(preparedRoot, "lazy/main.wasm")))
			, alphaSha256: sha256(await readFile(join(preparedRoot, "lazy/alpha.so.wasm")))
			, runtimeInitializations: module._bridge_lean_runtime_init_runs()
			, libraryInitializations: module._bridge_lean_library_init_runs()
			, liveComponents: module._bridge_owned_runtime_components()
			, liveIdentities: module._bridge_owned_runtime_identities()
			, liveLegacyHandles: module._bridge_lean_live_handles()
		}));
	});
