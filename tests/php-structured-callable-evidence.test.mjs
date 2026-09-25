/**
 * Reject gaps in installed PHP coverage, altered archives and source drift.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpStructuredCallableExecution, assertPhpStructuredCallableIntegration, phpStructuredCallableExecutionPath } from "./helpers/php-structured-callable-evidence.mjs";
import { beforePhpStructuredCallables, phpStructuredCallableHistoryPath, reversePhpStructuredCallableUpdate } from "./helpers/php-structured-callable-source-history.mjs";
import { beforePhpWasmStructuredCallables } from "./helpers/php-wasm-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("native PHP structured acceptance preserves original archives and promotes exactly thirty-two cells", async () => {
	await assertPhpStructuredCallableIntegration(await json(phpStructuredCallableHistoryPath));
});

test("native PHP structured acceptance rejects missing modes, ownership checks and documentation", async () => {
	const original = await json(phpStructuredCallableExecutionPath);
	await assertPhpStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("php-wasm"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.report.reports.pop(); }
		, record => { record.report.reports[0].signatures.pop(); }
		, record => { record.report.reports[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.report.reports[0].handoffRemovedBeforeExecution = false; }
		, record => { record.report.reports[0].publicCallsUninstrumented = false; }
		, record => { record.report.reports[0].installation.php.executions.pop(); }
		, record => { record.report.reports[0].installation.php.compilerFreeExecution = false; }
		, record => { record.report.reports[0].installation.php.executions[0].observation.rejected--; }
		, record => { record.report.reports[0].installation.php.packageReceiptSha256 = "0".repeat(64); }
		, record => { record.report.reports[0].faults.shapes.pop(); }
		, record => { record.report.reports[0].faults.faults--; }
		, record => { record.report.reports[0].faults.conversionMethods--; }
		, record => { record.report.reports[0].faults.publicConsumersRepeatedAfterProbe = false; }
		, record => { record.report.reports[0].faults.documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.report.reports[0].publisherDocumentation.compiled = false; }
		, record => { record.primitiveRegression.report.reports.pop(); }
		, record => { record.primitiveRegression.report.reports[0].signatures.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertPhpStructuredCallableExecution(altered));
	}
});

test("native PHP structured source history rejects unrelated edits and changed predecessor hashes", async () => {
	const record = await json(phpStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforePhpWasmStructuredCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpStructuredCallables(update.path, source)), update.previousSha256);
		const altered = source + "\n// unrelated\n";
		assert.equal(beforePhpStructuredCallables(update.path, altered), altered);
		assert.throws(() => reversePhpStructuredCallableUpdate(altered, update));
		assert.throws(() => reversePhpStructuredCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
