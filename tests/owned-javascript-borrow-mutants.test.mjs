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
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { rejectOwnedJavaScriptBorrowMutants } from "./helpers/owned-javascript-borrow-mutants.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`borrow lifetime checks reject compiled semantic mutants (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_BORROW_TEST !== "1", timeout: 600000
}, async t => {
	const f = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, transferredInputs: true, anchoredResults: true
		, fixtureOptions: { sourceSuffix: ownedRustBorrowSource
			, configuration: await ownedRustBorrowConfiguration()
			, evidenceName: `javascript-borrow-mutants-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedRustBorrowReviewedIr() } : {}
	});
	const result = await rejectOwnedJavaScriptBorrowMutants(f);
	await saveLakeFile("build/owned-javascript-borrows", `${mode}-mutants.json`, canonicalJson({
		schemaVersion: 1, profile: "owned-javascript-borrow-mutants", mode
		, input: f.evidence.input, privateAbi: f.evidence.privateAbi
		, ...result
		, sourceSha256: sha256(await readFile(join(f.evidence.directory, "probe.c")))
		, binarySha256: sha256(await readFile(join(f.evidence.directory, "probe.wasm")))
	}));
});
