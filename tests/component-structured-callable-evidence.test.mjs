/**
 * Reject missing npm callback contexts, altered receipts and source drift.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertNpmStructuredCallableExecution, assertNpmStructuredCallableIntegration, npmStructuredCallableExecutionPath } from "./helpers/npm-structured-callable-evidence.mjs";
import { beforeNpmStructuredCallables, npmStructuredCallableHistoryPath, reverseNpmStructuredCallableUpdate } from "./helpers/npm-structured-callable-source-history.mjs";
import { beforePhpStructuredCallables } from "./helpers/php-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("npm structured acceptance retains original archives, exact source history and 180 installed cells", async () => {
	await assertNpmStructuredCallableIntegration(await json(npmStructuredCallableHistoryPath));
});

test("npm structured execution rejects missing source paths, browser contexts, documentation and cleanup evidence", async () => {
	const original = await json(npmStructuredCallableExecutionPath);
	await assertNpmStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("php-wasm"); }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.report.runs.pop(); }
		, record => { record.report.runs[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.report.runs[0].producerBuildsRemovedBeforeInstallation = false; }
		, record => { record.report.runs[0].packagesRelocatedBeforeInstallation = false; }
		, record => { record.report.runs[0].result.shapes--; }
		, record => { record.report.runs[0].browsers.pop(); }
		, record => { delete record.report.runs[0].browsers[0].result.worker; }
		, record => { record.report.runs[0].browsers[1].result.react.checks--; }
		, record => { record.report.runs[0].typescript.executed = false; }
		, record => { record.report.runs[0].documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.report.runs[0].documentation.installedPublicApi = false; }
		, record => { record.report.runs[1].receipt.runtime.sha256 = "0".repeat(64); }
		, record => { record.regressions.pop(); }
		, record => { record.regressions[0].report.runs[0].result.primitives--; }
		, record => { record.transport.report.scenarios.pop(); }
		, record => { record.transport.report.nativeFaults--; }
		, record => { record.transport.report.ownership.jsAllocationsAfterRecoverableFailures++; }
		, record => { record.transport.report.ownership.allLeanHeapAllocationsTracked = true; }
		, record => { record.transport.report.poisonCases[0].hostCalls++; }
		, record => { record.transport.report.poisonCases[0].unsafeFrees++; }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertNpmStructuredCallableExecution(changed));
	}
});

test("npm structured source history rejects unrelated edits and altered predecessor hashes", async () => {
	const record = await json(npmStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforePhpStructuredCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNpmStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNpmStructuredCallables(update.path, source)), update.previousSha256);
		const changed = source + "\n// unrelated\n";
		assert.equal(beforeNpmStructuredCallables(update.path, changed), changed);
		assert.throws(() => reverseNpmStructuredCallableUpdate(changed, update));
		assert.throws(() => reverseNpmStructuredCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
