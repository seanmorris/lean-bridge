/**
 * Prevent recursive Python support claims from exceeding installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPythonRecursiveCallableExecution, assertPythonRecursiveCallableIntegration, pythonRecursiveCallableExecutionPath } from "./helpers/python-recursive-callable-evidence.mjs";
import { beforePythonRecursiveCallables, pythonRecursiveCallableHistoryPath, reversePythonRecursiveCallableUpdate } from "./helpers/python-recursive-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("recursive Python acceptance adds exactly four cells and preserves authenticated history", async () => {
	await assertPythonRecursiveCallableIntegration(await json(pythonRecursiveCallableHistoryPath));
});

test("recursive Python receipts reject missing paths, faults, ownership and typed examples", async () => {
	const original = await json(pythonRecursiveCallableExecutionPath);
	await assertPythonRecursiveCallableExecution(original);
	for(const change of [
		record => { record.reports.pop(); }
		, record => { record.reports[0].installations.pop(); }
		, record => { record.reports[0].publisher.compiled = false; }
		, record => { record.reports[0].packages[0].target = "c"; }
		, record => { record.reports[0].installations[0].documentation.executed = false; }
		, record => { record.reports[0].installations[0].faults.shapes.pop(); }
		, record => { record.reports[0].installations[0].faults.clears--; }
		, record => { record.reports[0].installations[0].faults.identities = 1; }
		, record => { record.reports[0].installations[0].lifetimes.creatorExitRejections = 0; }
		, record => { record.reports[0].installations[0].lifetimes.overflowRejected = false; }
		, record => { record.reports[0].installations[0].typing.rejected.pop(); }
		, record => { record.reports[0].installations[0].sourceHashes["python-recursive.py"] = "0".repeat(64); }
		, record => { record.reports[0].installations[0].malformedOutputRetiresRuntime = false; }
		, record => { record.installed.exitCode = 1; }
		, record => { record.regressions.structured.reports.pop(); }
	]) {
		const altered = structuredClone(original); change(altered);
		await assert.rejects(() => assertPythonRecursiveCallableExecution(altered));
	}
});

test("recursive Python source transitions reject unknown bytes and substituted predecessors", async () => {
	for(const update of (await json(pythonRecursiveCallableHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reversePythonRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePythonRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforePythonRecursiveCallables(update.path, source, update.currentSha256), source);
		const unrelated = source + "\n/* unrelated */\n";
		assert.equal(beforePythonRecursiveCallables(update.path, unrelated), unrelated);
		assert.throws(() => reversePythonRecursiveCallableUpdate(unrelated, update));
		assert.throws(() => reversePythonRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
