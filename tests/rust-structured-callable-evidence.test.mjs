/**
 * Keep structured Rust claims tied to installed runs and exact source changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertRustStructuredCallableExecution, assertRustStructuredCallableIntegration, rustStructuredCallableExecutionPath } from "./helpers/rust-structured-callable-evidence.mjs";
import { beforeRustStructuredCallables, rustStructuredCallableHistoryPath, reverseRustStructuredCallableUpdate } from "./helpers/rust-structured-callable-source-history.mjs";
import { beforePythonStructuredCallables } from "./helpers/python-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Rust structured acceptance binds source-free packages and preserves previous receipts", async () => {
	await assertRustStructuredCallableIntegration(await json(rustStructuredCallableHistoryPath));
});

test("Rust structured execution rejects missing shapes, ownership checks and documentation execution", async () => {
	const original = await json(rustStructuredCallableExecutionPath);
	await assertRustStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("cpp"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].safety.faults.pop(); }
		, record => { record.reports[0].safety.faults[0].failures = 0; }
		, record => { record.reports[0].safety.rejected.pop(); }
		, record => { record.reports[0].safety.sourcesAndArchivesRemovedBeforeExecution = false; }
		, record => { record.reports[0].safety.documentedExampleExecuted = false; }
		, record => { record.reports[0].safety.documentedSourceSha256 = "0".repeat(64); }
		, record => { record.primitiveReports.pop(); }
		, record => { record.ownershipRegression.text = record.ownershipRegression.text.replace("# skipped 0", "# skipped 1"); record.ownershipRegression.sha256 = sha256(record.ownershipRegression.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertRustStructuredCallableExecution(altered));
	}
});

test("Rust structured integration rejects altered predecessors and extra promoted cells", async () => {
	const original = await json(rustStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.codegen.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/rust/callables.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertRustStructuredCallableIntegration(altered));
	}
});

test("Rust structured source history never erases unrelated source drift", async () => {
	const record = await json(rustStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforePythonStructuredCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRustStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRustStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforeRustStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reverseRustStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
