/**
 * Keep structured callback acceptance scoped to its installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertCStructuredCallableExecution, assertCStructuredCallableIntegration, cStructuredCallableExecutionPath } from "./helpers/c-structured-callable-evidence.mjs";
import { beforeCStructuredCallables, cStructuredCallableHistoryPath, reverseCStructuredCallableUpdate } from "./helpers/c-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("C structured callable acceptance binds installed packages and preserves earlier receipts", async () => {
	await assertCStructuredCallableIntegration(await json(cStructuredCallableHistoryPath));
});

test("C structured callable evidence rejects missing ownership, source paths and sanitizers", async () => {
	const original = await json(cStructuredCallableExecutionPath);
	assertCStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("cpp"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.reports[0].relocatedBeforeInstallation = false; }
		, record => { record.reports[0].allocationFailures.trackedLiveAllocationsAfterEveryFailure = 1; }
		, record => { record.reports[0].allocationFailures.startupLeakBaseline.unchangedAfterConversions = false; }
		, record => { record.reports[0].allocationFailures.sanitizers.pop(); }
		, record => { record.primitiveRegression.text = record.primitiveRegression.text.replace("# skipped 0", "# skipped 1"); record.primitiveRegression.sha256 = sha256(record.primitiveRegression.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		assert.throws(() => assertCStructuredCallableExecution(altered));
	}
});

test("C structured callable integration rejects source drift and extra promoted cells", async () => {
	const original = await json(cStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.execution.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/c/native-callables.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertCStructuredCallableIntegration(altered));
	}
});

test("C structured callable history reverses literal edits while preserving unrelated drift", async () => {
	const record = await json(cStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseCStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforeCStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reverseCStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
