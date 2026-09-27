/**
 * Authenticate owned callback packages without claiming unfinished projections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedHostExecution, assertOwnedHostIntegration } from "./helpers/owned-host-evidence.mjs";
import { beforeOwnedHost, reverseOwnedHostUpdate, ownedHostHistoryPath, ownedHostExecutionPath } from "./helpers/owned-host-source-history.mjs";
import { beforeOwnedCi, reverseOwnedCiUpdate, ownedCiBaseline, ownedCiChangedPaths, ownedCiHistoricalBytes, ownedCiHistoryPath } from "./helpers/owned-ci-source-history.mjs";
import { beforeOwnedCpp } from "./helpers/owned-cpp-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("owned callback packages retain fault checks, installed execution and source history", async () => {
	await assertOwnedHostIntegration(await json(ownedHostHistoryPath));
});

test("owned callback evidence rejects altered runs, recovery, lifetimes and coverage", async () => {
	const original = await json(ownedHostExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("cpp"); }
		, record => { record.scope.hostCallbackLifetime = "retained"; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.runs.core.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.packageRegressions.text += "changed"; }
		, record => { record.runs.nixBoundary.exitCode = 1; }
		, record => { delete record.sources["src/backends/c/owned-callbacks.mjs"]; }
		, record => { record.core.ordinary.result.failures--; }
		, record => { record.core.reviewed.result.identities++; }
		, record => { record.core.reviewed.noLeanGlobalCopyRelocation = false; }
		, record => { record.core.reviewed.startupLeakBaseline = "suppression"; }
		, record => { record.core.reviewed.hostCallbacks[0].automaticRecovery = !record.core.reviewed.hostCallbacks[0].automaticRecovery; }
		, record => { record.packages.ordinary.checks.pkgConfig--; }
		, record => { record.packages.reviewed.sourceFreeInstallation = false; }
		, record => { record.packages.reviewed.forgedCapabilityRejected = false; }
		, record => { record.packages.reviewed.forgedTrampolineRejected = false; }
		, record => { record.packages.reviewed.adapterReceipt.ownedValues.hostCallbacks.lifetime = "retained"; }
		, record => { record.packages.reviewed.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.manifest.schemaVersion = 2; }
		, record => { record.packageRegressions.reviewed.packageSetReceipt.packages[0].target = "cpp"; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedHostExecution(changed), change.toString());
	}
});

test("owned callback source history rejects unknown text and overlapping edits", async () => {
	for(const update of (await json(ownedHostHistoryPath)).updates)
	{
		const source = beforeOwnedCi(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseOwnedHostUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedHost(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedHost(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedHost(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedHostUpdate(unknown, update));
		assert.throws(() => reverseOwnedHostUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedHostUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("owned CI repairs retain exact predecessors and passing contract executions", async () => {
	const record = await json(ownedCiHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-ci-contract-repair"); assert.equal(record.baselineRevision, ownedCiBaseline);
	assert.deepEqual(record.scope, { productionChanges: false, promotedCells: 0 });
	assert.deepEqual(record.updates.map(update => update.path).sort(), ownedCiChangedPaths);
	assert.equal(record.previous.path, ownedHostHistoryPath);
	assert.equal(sha256(await readFile(record.previous.path)), record.previous.sha256);
	const helper = "tests/helpers/owned-ci-source-history.mjs";
	assert.deepEqual(Object.keys(record.additions), [helper]);
	assert.equal(record.additions[helper], sha256(beforeOwnedCpp(helper, await readFile(helper, "utf8"))));
	for(const update of record.updates)
	{
		const source = beforeOwnedCpp(update.path, await readFile(update.path, "utf8")), previous = reverseOwnedCiUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeOwnedCi(update.path, source), previous);
		assert.equal(beforeOwnedCi(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedCi(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedCiUpdate(unknown, update));
		assert.throws(() => reverseOwnedCiUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedCiUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const bytes = Buffer.from([255, 0, 128, 192]);
	assert.equal(ownedCiHistoricalBytes("unrecorded.bin", bytes), bytes);
	assert.equal(record.run.command, "node --test tests/current-source-evidence.test.mjs tests/php-wasm-callable-contract.test.mjs tests/perl-contract.test.mjs tests/toolchain-preflight.test.mjs");
	assert.equal(record.run.exitCode, 0); assert.equal(sha256(record.run.text), record.run.sha256);
	for(const [name, value] of Object.entries({ tests: 71, pass: 71, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(record.run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
});
