/**
 * Keep the C++ milestone's claims tied to actual installed executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertCppStructuredCallableExecution, assertCppStructuredCallableIntegration, cppStructuredCallableExecutionPath } from "./helpers/cpp-structured-callable-evidence.mjs";
import { beforeCppStructuredCallables, cppStructuredCallableHistoryPath, reverseCppStructuredCallableUpdate } from "./helpers/cpp-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("C++ structured acceptance binds source-free packages and preserves prior receipts", async () => {
	await assertCppStructuredCallableIntegration(await json(cppStructuredCallableHistoryPath));
});

test("C++ structured execution rejects missing shapes, cleanup, compiler checks and regressions", async () => {
	const original = await json(cppStructuredCallableExecutionPath);
	await assertCppStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("rust"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].result.faults.pop(); }
		, record => { record.reports[0].result.faults[0].failures = 0; }
		, record => { record.reports[0].safety.rejected.pop(); }
		, record => { record.reports[0].safety.archivesRemoved = false; }
		, record => { record.reports[0].safety.startupLeakBaseline.unchangedAfterConversions = false; }
		, record => { record.primitiveReports.pop(); }
		, record => { record.primitiveRegression.text = record.primitiveRegression.text.replace("# skipped 0", "# skipped 1"); record.primitiveRegression.sha256 = sha256(record.primitiveRegression.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertCppStructuredCallableExecution(altered));
	}
});

test("C++ structured integration rejects altered old receipts and extra promoted cells", async () => {
	const original = await json(cppStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.codegen.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/cpp/callables.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertCppStructuredCallableIntegration(altered));
	}
});

test("C++ structured source history never discards unrelated edits", async () => {
	const record = await json(cppStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseCppStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCppStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforeCppStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reverseCppStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
