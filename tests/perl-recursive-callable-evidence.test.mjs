/**
 * Prevent recursive Perl support claims from exceeding installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPerlRecursiveCallableExecution, assertPerlRecursiveCallableIntegration, perlRecursiveCallableExecutionPath } from "./helpers/perl-recursive-callable-evidence.mjs";
import { beforePerlRecursiveCallables, perlRecursiveCallableHistoryPath, reversePerlRecursiveCallableUpdate } from "./helpers/perl-recursive-callable-source-history.mjs";
import { beforeDotnetRecursiveCallables } from "./helpers/dotnet-recursive-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("recursive Perl acceptance adds exactly four cells and preserves authenticated history", async () => {
	await assertPerlRecursiveCallableIntegration(await json(perlRecursiveCallableHistoryPath));
});

test("recursive Perl receipts reject missing ABIs, modes, faults, ownership and examples", async () => {
	const original = await json(perlRecursiveCallableExecutionPath);
	await assertPerlRecursiveCallableExecution(original);
	for(const change of [
		record => { record.reports.pop(); }
		, record => { record.reports[0].mode = "build-xs"; }
		, record => { record.reports[0].documentation.compiled = false; }
		, record => { record.reports[0].documentation.executed = false; }
		, record => { record.reports[0].packages[0].target = "c"; }
		, record => { record.reports[0].checks--; }
		, record => { record.reports[0].acyclic.checks--; }
		, record => { record.reports[0].producerRemoved = false; }
		, record => { record.reports[0].handoffRemoved = false; }
		, record => { record.reports[0].compilerFreeExecution = false; }
		, record => { record.reports[0].installedFilesUnchanged = false; }
		, record => { record.reports[0].probes.isolatedXsCopy = false; }
		, record => { record.reports[0].probes.faults.observations.pop(); }
		, record => { record.reports[0].probes.faults.observations[0].counts["3"]--; }
		, record => { record.reports[0].probes.faults.failures--; }
		, record => { record.reports[0].probes.ownership.ownershipChecks--; }
		, record => { record.reports[0].probes.ownership.checkedBeforeDecode = false; }
		, record => { record.reports[0].probes.poison.retired = 0; }
		, record => { record.reports[0].probes.counterfactuals.pop(); }
		, record => { record.reports[0].probes.counterfactuals[0].exitCode = null; }
		, record => { record.reports[0].probes.counterfactuals[0].stderr = ""; }
		, record => { record.reports[0].probes.sources.ownership = "0".repeat(64); }
		, record => { record.reports[0].lifetimes.finalized = false; }
		, record => { record.reports[0].lifetimes.childFinalizationIsolated = false; }
		, record => { record.reports[0].lifetimes.staleRejected = false; }
		, record => { record.installed.exitCode = 1; }
		, record => { record.regressions.structured.reports.pop(); }
		, record => { record.regressions.primitive.pop(); }
	]) {
		const altered = structuredClone(original); change(altered);
		await assert.rejects(() => assertPerlRecursiveCallableExecution(altered));
	}
});

test("recursive Perl source transitions reject unknown bytes and substituted predecessors", async () => {
	for(const update of (await json(perlRecursiveCallableHistoryPath)).updates)
	{
		const source = beforeDotnetRecursiveCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePerlRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePerlRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforePerlRecursiveCallables(update.path, source, update.currentSha256), source);
		const unrelated = source + "\n/* unrelated */\n";
		assert.equal(beforePerlRecursiveCallables(update.path, unrelated), unrelated);
		assert.throws(() => reversePerlRecursiveCallableUpdate(unrelated, update));
		assert.throws(() => reversePerlRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
