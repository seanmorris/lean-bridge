/**
 * Broken native and JavaScript lifetime implementations fail executed checks.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { rejectOwnedJavaScriptReceiverMutants } from "./helpers/owned-javascript-receiver-mutants.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`receiver lifetime checks reject compiled semantic mutants (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_RECEIVER_TEST !== "1", timeout: 600000
}, async t => {
	const f = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, transferredInputs: true, anchoredResults: true
		, receiverExports: true
		, fixtureOptions: { sourceSuffix: ownedRustReceiverSource
			, configuration: await ownedRustReceiverConfiguration()
			, evidenceName: `javascript-receiver-mutants-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedRustReceiverReviewedIr() } : {}
	});
	const result = await rejectOwnedJavaScriptReceiverMutants(f);
	await saveLakeFile("build/owned-javascript-receivers", `${mode}-mutants.json`, canonicalJson({
		schemaVersion: 1, profile: "owned-javascript-receiver-mutants", mode
		, input: f.evidence.input, privateAbi: f.evidence.privateAbi
		, ...result
		, sourceSha256: sha256(await readFile(join(f.evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(f.evidence.directory, "probe.wasm")))
	}));
});
