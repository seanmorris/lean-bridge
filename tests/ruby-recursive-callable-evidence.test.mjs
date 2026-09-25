/**
 * Prevent recursive Ruby support claims from exceeding installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertRubyRecursiveCallableExecution, assertRubyRecursiveCallableIntegration, rubyRecursiveCallableExecutionPath } from "./helpers/ruby-recursive-callable-evidence.mjs";
import { beforeRubyRecursiveCallables, rubyRecursiveCallableHistoryPath, reverseRubyRecursiveCallableUpdate } from "./helpers/ruby-recursive-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("recursive Ruby acceptance adds exactly four cells and preserves authenticated history", async () => {
	await assertRubyRecursiveCallableIntegration(await json(rubyRecursiveCallableHistoryPath));
});

test("recursive Ruby receipts reject missing paths, faults, ownership and examples", async () => {
	const original = await json(rubyRecursiveCallableExecutionPath);
	await assertRubyRecursiveCallableExecution(original);
	for(const change of [
		record => { record.reports.pop(); }
		, record => { record.reports[0].publisher.compiled = false; }
		, record => { record.reports[0].packages[0].target = "c"; }
		, record => { record.reports[0].installation.public.checks--; }
		, record => { record.reports[0].installation.offlineInstall = false; }
		, record => { record.reports[0].installation.compilerFreeExecution = false; }
		, record => { record.reports[0].installation.installedFilesUnchanged = false; }
		, record => { record.reports[0].installation.isolatedInMemoryFaultProbe = false; }
		, record => { record.reports[0].installation.documentation.executed = false; }
		, record => { record.reports[0].installation.faults.shapes.pop(); }
		, record => { record.reports[0].installation.faults.faults--; }
		, record => { record.reports[0].installation.ownershipChecks--; }
		, record => { record.reports[0].installation.malformedOutputRetiresRuntime = false; }
		, record => { record.reports[0].installation.counterfactuals.pop(); }
		, record => { record.reports[0].installation.counterfactuals[0].rejected = false; }
		, record => { record.reports[0].installation.sourceHashes["ruby-recursive-ownership.rb"] = "0".repeat(64); }
		, record => { record.reports[0].installation.lifetimes.creator_exit_rejections--; }
		, record => { record.reports[0].installation.lifetimes.finalization_released = false; }
		, record => { record.reports[0].installation.lifetimes.recycled_thread_ids = -1; }
		, record => { record.installed.exitCode = 1; }
		, record => { record.regressions.structured.reports.pop(); }
	]) {
		const altered = structuredClone(original); change(altered);
		await assert.rejects(() => assertRubyRecursiveCallableExecution(altered));
	}
});

test("recursive Ruby source transitions reject unknown bytes and substituted predecessors", async () => {
	for(const update of (await json(rubyRecursiveCallableHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseRubyRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRubyRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforeRubyRecursiveCallables(update.path, source, update.currentSha256), source);
		const unrelated = source + "\n/* unrelated */\n";
		assert.equal(beforeRubyRecursiveCallables(update.path, unrelated), unrelated);
		assert.throws(() => reverseRubyRecursiveCallableUpdate(unrelated, update));
		assert.throws(() => reverseRubyRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
