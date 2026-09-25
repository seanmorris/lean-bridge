/**
 * Reject incomplete WIT acceptance, incorrect ownership claims and source drift.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertWitStructuredCallableExecution, assertWitStructuredCallableIntegration, witStructuredCallableExecutionPath } from "./helpers/wit-structured-callable-evidence.mjs";
import { beforeWitStructuredCallables, witStructuredCallableHistoryPath, reverseWitStructuredCallableUpdate } from "./helpers/wit-structured-callable-source-history.mjs";
import { beforeNativeRecursiveCallables } from "./helpers/native-recursive-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("WIT structured acceptance preserves prior archives and promotes exactly thirty-two cells", async () => {
	await assertWitStructuredCallableIntegration(await json(witStructuredCallableHistoryPath));
});

test("WIT structured acceptance rejects missing source paths, ownership checks and executable documentation", async () => {
	const original = await json(witStructuredCallableExecutionPath);
	await assertWitStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("c"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.report.reports.pop(); }
		, record => { record.report.reports[0].bindingIr.declarations.pop(); }
		, record => { record.report.reports[0].signatures.pop(); }
		, record => { record.report.reports[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.report.reports[0].handoffRemovedBeforeRepeatedExecution = false; }
		, record => { record.report.reports[0].installedFilesUnchanged = false; }
		, record => { record.report.reports[0].consumerSha256 = "0".repeat(64); }
		, record => { record.report.reports[0].libraries["libstructured_wasmtime.so"].sha256 = "0".repeat(64); }
		, record => { record.report.reports[0].result.rejected--; }
		, record => { record.report.reports[0].repeatedExecution.callbacks--; }
		, record => { record.aliases.reports.pop(); }
		, record => { record.aliases.reports[0].result.finalized--; }
		, record => { record.aliases.reports[0].handoffRemovedBeforeRepeatedExecution = false; }
		, record => { record.faults.normal.live++; }
		, record => { record.faults.sanitized.injected--; }
		, record => { record.faults.sourceSha256 = "0".repeat(64); }
		, record => { record.faults.missingReferenceRejected = false; }
		, record => { record.faults.retainedConstructionReferenceRejected = false; }
		, record => { record.documentation.reports.pop(); }
		, record => { record.documentation.reports[0].publisherSourceSha256 = "0".repeat(64); }
		, record => { record.documentation.reports[0].compilerFreeExecution = false; }
		, record => { record.documentation.reports[0].repeatedExecutions--; }
		, record => { record.primitiveRegression.report.reports.pop(); }
		, record => { record.primitiveRegression.report.reports[0].signatures.pop(); }
		, record => { record.boundInterface.exitCode = 1; }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertWitStructuredCallableExecution(altered));
	}
});

test("WIT structured source history rejects unrelated edits and changed predecessor hashes", async () => {
	const record = await json(witStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforeNativeRecursiveCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseWitStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeWitStructuredCallables(update.path, source)), update.previousSha256);
		const altered = source + "\n// unrelated\n";
		assert.equal(beforeWitStructuredCallables(update.path, altered), altered);
		assert.throws(() => reverseWitStructuredCallableUpdate(altered, update));
		assert.throws(() => reverseWitStructuredCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
