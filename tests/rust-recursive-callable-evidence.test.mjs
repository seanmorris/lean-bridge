/**
 * Prevent recursive Rust support claims from exceeding installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCallableRustGraphPackageModel } from "../src/backends/rust/callable-graph-model.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { rustRecursiveOwnershipTests } from "./helpers/rust-recursive-callable-probes.mjs";
import { assertRustRecursiveCallableExecution, assertRustRecursiveCallableIntegration, rustRecursiveCallableExecutionPath } from "./helpers/rust-recursive-callable-evidence.mjs";
import { beforeRustRecursiveCallables, rustRecursiveCallableHistoryPath, reverseRustRecursiveCallableUpdate } from "./helpers/rust-recursive-callable-source-history.mjs";
import { beforeRubyRecursiveCallables } from "./helpers/ruby-recursive-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("recursive Rust acceptance adds exactly four cells and preserves authenticated history", async () => {
	await assertRustRecursiveCallableIntegration(await json(rustRecursiveCallableHistoryPath));
});

test("recursive Rust receipts reject missing paths, faults, ownership and typed examples", async () => {
	const original = await json(rustRecursiveCallableExecutionPath);
	await assertRustRecursiveCallableExecution(original);
	const fixtureOrder = sha256(rustRecursiveOwnershipTests(compileCallableRustGraphPackageModel(nativeRecursiveCallableReviewedIr())));
	assert.notEqual(fixtureOrder, original.reports[0].safety.ownershipSourceSha256);
	for(const change of [
		record => { record.reports.pop(); }
		, record => { record.reports[0].publisher.compiled = false; }
		, record => { record.reports[0].packages[0].target = "c"; }
		, record => { record.reports[0].installation.checks--; }
		, record => { record.reports[0].installation.linkOnly = false; }
		, record => { record.reports[0].installation.rejectedLinkInputs.pop(); }
		, record => { record.reports[0].installation.emptyCargoHome = false; }
		, record => { record.reports[0].installation.verifiedDependencyFiles--; }
		, record => { record.reports[0].sourcesAndArchivesRemovedBeforeExecution = false; }
		, record => { record.reports[0].safety.documentation.executed = false; }
		, record => { record.reports[0].safety.faults.pop(); }
		, record => { record.reports[0].safety.faults[0].failures--; }
		, record => { record.reports[0].safety.ownershipTests--; }
		, record => { record.reports[0].safety.ownershipSourceSha256 = fixtureOrder; }
		, record => { record.reports[0].safety.ownershipSourceSha256 = "0".repeat(64); }
		, record => { record.reports[0].safety.poisonSourceSha256 = "0".repeat(64); }
		, record => { record.reports[0].safety.missingCallbackOwnerRejected = false; }
		, record => { record.reports[0].safety.missingRetirementRejected = false; }
		, record => { record.reports[0].safety.malformedOutputRetiresRuntime = false; }
		, record => { record.reports[0].safety.installedFilesUnchanged = false; }
		, record => { record.reports[0].safety.rejected.pop(); }
		, record => { record.reports[0].safety.rejected[0].code = "E0000"; }
		, record => { record.installed.exitCode = 1; }
		, record => { record.regressions.structured.reports.pop(); }
	]) {
		const altered = structuredClone(original); change(altered);
		await assert.rejects(() => assertRustRecursiveCallableExecution(altered));
	}
});

test("recursive Rust source transitions reject unknown bytes and substituted predecessors", async () => {
	for(const update of (await json(rustRecursiveCallableHistoryPath)).updates)
	{
		const source = beforeRubyRecursiveCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRustRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRustRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforeRustRecursiveCallables(update.path, source, update.currentSha256), source);
		const unrelated = source + "\n/* unrelated */\n";
		assert.equal(beforeRustRecursiveCallables(update.path, unrelated), unrelated);
		assert.throws(() => reverseRustRecursiveCallableUpdate(unrelated, update));
		assert.throws(() => reverseRustRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
