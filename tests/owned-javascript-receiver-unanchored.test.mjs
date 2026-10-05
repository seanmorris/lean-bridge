/**
 * Callback receiver methods work without output-borrow contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedJavaScriptReceiverConfiguration } from "./helpers/owned-javascript-receiver-configurations.mjs";
import { runUnanchoredReceivers } from "./fixtures/structured-types/owned-installed-javascript-resource-receivers.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`JavaScript callbacks and receivers without result anchors (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_RECEIVER_TEST !== "1", timeout: 900000
}, async t => {
	const { configuration, reviewedIr, sourceSuffix } = await ownedJavaScriptReceiverConfiguration(true, true);
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, transferredInputs: true
		, receiverExports: true, anchoredResults: false
		, fixtureOptions: { configuration, sourceSuffix
			, evidenceName: `javascript-unanchored-receivers-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr } : {}
	});
	const api = { ...Object.fromEntries(fixture.layout.native.functions.map(fn => [fn.name, (...args) => fixture.call(fn.name, ...args)]))
		, copyValue: (value, selector) => {
			const fn = fixture.layout.native.functions.find(fn => fn.name === selector.receiverOf);
			return fixture.copyValue(fn.parameters[0], value);
		}
	};
	const observed = runUnanchoredReceivers(api);
	assert.equal(observed.checks, 11); assert.equal(observed.resultAnchors, false);
	assert.equal(fixture.evidence.privateAbi.resultAnchors, undefined);
	assert.equal(fixture.evidence.privateAbi.version, 13);
	assert.equal(fixture.module._owned_results(), 0); assert.equal(fixture.module._owned_live(), 0);
	assert.equal(fixture.module._owned_identities(), 0); assert.equal(fixture.callbackCount(), 0);
	await saveLakeFile("build/owned-javascript-receivers", `${mode}-unanchored.json`, canonicalJson({
		schemaVersion: 1, profile: "owned-javascript-unanchored-receivers", mode
		, input: fixture.evidence.input, privateAbi: fixture.evidence.privateAbi
		, observed, compiledLean: true, installedPackage: false
		, sourceSha256: sha256(await readFile(join(fixture.evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(fixture.evidence.directory, "probe.wasm")))
		, owners: fixture.module._owned_results()
		, allocations: fixture.module._owned_live()
		, identities: fixture.module._owned_identities()
		, callbacks: fixture.callbackCount()
	}));
});
