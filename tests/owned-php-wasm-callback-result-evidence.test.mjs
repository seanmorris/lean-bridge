/**
 * Reject incomplete or forged PHP-Wasm callback-result acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPhpWasmCallbackResultEvidence, ownedPhpWasmCallbackResultEvidencePath,
	packOwnedPhpWasmCallbackResultReports,
	unpackOwnedPhpWasmCallbackResultReports } from "./helpers/owned-php-wasm-callback-result-evidence.mjs";
import "./helpers/php-wasm-callback-result-acceptance-history-tests.mjs";

const read = async () => JSON.parse(await readFile(ownedPhpWasmCallbackResultEvidencePath, "utf8"));

test("PHP-Wasm callback-result evidence reconstructs all installed packages and executions", async () => {
	await assertOwnedPhpWasmCallbackResultEvidence(await read());
});

test("PHP-Wasm callback-result evidence rejects partial runs and overstated guarantees", async () => {
	const record = await read(); await assertOwnedPhpWasmCallbackResultEvidence(record);
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.asynchronousCallbacks = true; }
		, value => { value.runtimeIdentity = "0".repeat(64); }
		, value => { value.sources["package.json"] = "0".repeat(64); }
		, value => { value.reports["host-packages.json"].sha256 = "0".repeat(64); }
		, value => { delete value.reports["combined-packages.json"]; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPhpWasmCallbackResultEvidence(changed));
	}
});

test("PHP-Wasm callback-result report payloads reject execution and ownership mutations", async () => {
	const record = await read(); const reports = unpackOwnedPhpWasmCallbackResultReports(record.reports);
	for(const mutate of [
		value => { value.observations[0].executions.pop(); }
		, value => { value.observations[1].executions[0].observed.checks--; }
		, value => { value.observations[0].browser.observations[0].executions[0].cleaned.liveIdentities++; }
		, value => { value.observations[0].model.ownedGraph.callbackResultAnchors.signatures.pop(); }
		, value => { value.observations[1].rejected.pop(); }
	]) {
		const changed = structuredClone(reports["combined-packages.json"]); mutate(changed);
		const replaced = structuredClone(record); const bytes = Buffer.from(JSON.stringify(changed));
		replaced.reports["combined-packages.json"] = packOwnedPhpWasmCallbackResultReports({ changed: bytes }).changed;
		await assert.rejects(() => assertOwnedPhpWasmCallbackResultEvidence(replaced));
	}
});
