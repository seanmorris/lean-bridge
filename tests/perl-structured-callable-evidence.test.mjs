/**
 * Require original installed CPAN archives and exact source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPerlStructuredCallableExecution, assertPerlStructuredCallableIntegration, perlStructuredCallableExecutionPath } from "./helpers/perl-structured-callable-evidence.mjs";
import { beforePerlStructuredCallables, perlStructuredCallableHistoryPath, reversePerlStructuredCallableUpdate } from "./helpers/perl-structured-callable-source-history.mjs";
import { beforeNpmStructuredCallables } from "./helpers/npm-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Perl structured acceptance binds original CPAN archives and preserves predecessor receipts", async () => {
	await assertPerlStructuredCallableIntegration(await json(perlStructuredCallableHistoryPath));
});

test("Perl structured execution rejects missing ABIs, failures, values and documentation", async () => {
	const original = await json(perlStructuredCallableExecutionPath);
	await assertPerlStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("ruby"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.abis.pop(); }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].abiKey = "0".repeat(64); }
		, record => { record.reports[0].shapes.pop(); }
		, record => { record.reports[0].faults.scenarios.pop(); }
		, record => { record.reports[0].faults.liveOwners = 1; }
		, record => { record.reports[0].faults.errorModes.object--; }
		, record => { record.reports[0].faults.isolatedXsCopy = false; }
		, record => { record.reports[0].faults.deferredClose--; }
		, record => { record.reports[0].publicCallsUninstrumented = false; }
		, record => { record.reports[0].handoffRemovedBeforeExecution = false; }
		, record => { record.reports[0].documentation.installedPublicApi = false; }
		, record => { record.reports[0].documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.reports[0].installedFiles[record.reports[0].apiPath].bytes = -1; }
		, record => { record.reports[0].packages[1].requires = []; }
		, record => { record.primitiveRegressions.pop(); }
		, record => { record.primitiveRegressions[0].reports[0].result.primitives.pop(); }
		, record => { record.copiedRegressions.pop(); }
		, record => { record.copiedRegressions[0].reports.pop(); }
		, record => { record.copiedRegressions[0].reports[0].signatures.pop(); }
		, record => { record.copiedRegressions[3].reports[0].contract.types.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertPerlStructuredCallableExecution(altered));
	}
});

test("Perl structured integration rejects changed history or extra promoted cells", async () => {
	const original = await json(perlStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.codegen.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/perl/generate.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertPerlStructuredCallableIntegration(altered));
	}
});

test("Perl structured source history preserves unrelated source drift", async () => {
	const record = await json(perlStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforeNpmStructuredCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePerlStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePerlStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforePerlStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reversePerlStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
