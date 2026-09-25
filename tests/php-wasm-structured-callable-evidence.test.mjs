/**
 * Reject incomplete PHP-Wasm acceptance and any unrecorded source drift.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpWasmStructuredCallableExecution, assertPhpWasmStructuredCallableIntegration, phpWasmStructuredCallableExecutionPath } from "./helpers/php-wasm-structured-callable-evidence.mjs";
import { beforePhpWasmStructuredCallables, phpWasmStructuredCallableHistoryPath, reversePhpWasmStructuredCallableUpdate } from "./helpers/php-wasm-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("PHP-Wasm structured acceptance preserves original receipts and promotes exactly thirty-two cells", async () => {
	await assertPhpWasmStructuredCallableIntegration(await json(phpWasmStructuredCallableHistoryPath));
});

test("PHP-Wasm structured acceptance rejects missing loading modes, buffer ownership and recovery execution", async () => {
	const original = await json(phpWasmStructuredCallableExecutionPath);
	await assertPhpWasmStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("php-native"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.report.reports.pop(); }
		, record => { record.report.reports[0].signatures.pop(); }
		, record => { record.report.reports[0].executions.pop(); }
		, record => { record.report.reports[0].executions[0].bailoutRecovery = false; }
		, record => { record.report.reports[0].executions[0].libraryNames[0] = "missing.so"; }
		, record => { record.report.reports[0].executions[0].documentationExecuted = false; }
		, record => { record.report.reports[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.report.reports[0].handoffRemovedBeforeExecution = false; }
		, record => { record.report.reports[0].unchangedDeployment = false; }
		, record => { record.report.reports[0].checks--; }
		, record => { record.report.reports[0].documentationSha256 = "0".repeat(64); }
		, record => { record.report.reports[0].publisherDocumentation.compiled = false; }
		, record => { record.faults.executions[0].paths.pop(); }
		, record => { record.faults.executions[0].ownedBuffers--; }
		, record => { record.faults.executions[0].bailoutRecovery--; }
		, record => { record.faults.executions[0].wireRejections--; }
		, record => { record.faults.providerSha256 = "0".repeat(64); }
		, record => { record.faults.unownedReplyRejected = false; }
		, record => { record.primitiveRegression.report.reports.pop(); }
		, record => { record.primitiveRegression.report.reports[0].signatures.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertPhpWasmStructuredCallableExecution(altered));
	}
});

test("PHP-Wasm structured source history rejects unrelated edits and changed predecessor hashes", async () => {
	const record = await json(phpWasmStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reversePhpWasmStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpWasmStructuredCallables(update.path, source)), update.previousSha256);
		const altered = source + "\n// unrelated\n";
		assert.equal(beforePhpWasmStructuredCallables(update.path, altered), altered);
		assert.throws(() => reversePhpWasmStructuredCallableUpdate(altered, update));
		assert.throws(() => reversePhpWasmStructuredCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
