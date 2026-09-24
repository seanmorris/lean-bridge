/**
 * Require original installed wheels and exact historical source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPythonStructuredCallableExecution, assertPythonStructuredCallableIntegration, pythonStructuredCallableExecutionPath } from "./helpers/python-structured-callable-evidence.mjs";
import { beforePythonStructuredCallables, pythonStructuredCallableHistoryPath, reversePythonStructuredCallableUpdate } from "./helpers/python-structured-callable-source-history.mjs";
import { beforeRubyStructuredCallables } from "./helpers/ruby-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Python structured acceptance binds original wheels and preserves predecessor receipts", async () => {
	await assertPythonStructuredCallableIntegration(await json(pythonStructuredCallableHistoryPath));
});

test("Python structured execution rejects missing paths, runtimes, failures and typed documentation", async () => {
	const original = await json(pythonStructuredCallableExecutionPath);
	await assertPythonStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("rust"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].installations.pop(); }
		, record => { record.reports[0].installations[0].faults.shapes.pop(); }
		, record => { record.reports[0].installations[0].faults.shapes[0].faults = 0; }
		, record => { record.reports[0].installations[0].strictTypecheck.rejected.pop(); }
		, record => { record.reports[0].installations[0].producerHandoffRemoved = false; }
		, record => { record.reports[0].installations[0].documentation.executed = false; }
		, record => { record.reports[0].installations[0].documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.primitiveReports.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertPythonStructuredCallableExecution(altered));
	}
});

test("Python structured integration rejects changed history or extra promoted cells", async () => {
	const original = await json(pythonStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.codegen.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/python/copied-model.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertPythonStructuredCallableIntegration(altered));
	}
});

test("Python structured source history preserves unrelated source drift", async () => {
	const record = await json(pythonStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforeRubyStructuredCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePythonStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePythonStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforePythonStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reversePythonStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
