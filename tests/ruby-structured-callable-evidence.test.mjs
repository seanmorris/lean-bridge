/**
 * Require original installed gems and exact historical source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertRubyStructuredCallableExecution, assertRubyStructuredCallableIntegration, rubyStructuredCallableExecutionPath } from "./helpers/ruby-structured-callable-evidence.mjs";
import { beforeRubyStructuredCallables, rubyStructuredCallableHistoryPath, reverseRubyStructuredCallableUpdate } from "./helpers/ruby-structured-callable-source-history.mjs";
import { beforeDotnetStructuredCallables } from "./helpers/dotnet-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Ruby structured acceptance binds original gems and preserves predecessor receipts", async () => {
	await assertRubyStructuredCallableIntegration(await json(rubyStructuredCallableHistoryPath));
});

test("Ruby structured execution rejects missing paths, runtimes, failures and documentation", async () => {
	const original = await json(rubyStructuredCallableExecutionPath);
	await assertRubyStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("python"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].installation.ruby = "unverified runtime"; }
		, record => { record.reports[0].installation.faults.shapes.pop(); }
		, record => { record.reports[0].installation.faults.shapes[0].faults = 0; }
		, record => { record.reports[0].installation.producerHandoffRemoved = false; }
		, record => { record.reports[0].installation.gemCacheRemoved = false; }
		, record => { record.reports[0].installation.documentation.executed = false; }
		, record => { record.reports[0].installation.documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.primitiveReports.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertRubyStructuredCallableExecution(altered));
	}
});

test("Ruby structured integration rejects changed history or extra promoted cells", async () => {
	const original = await json(rubyStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.codegen.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/ruby/copied-model.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertRubyStructuredCallableIntegration(altered));
	}
});

test("Ruby structured source history preserves unrelated source drift", async () => {
	const record = await json(rubyStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforeDotnetStructuredCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRubyStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRubyStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforeRubyStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reverseRubyStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
