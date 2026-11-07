/**
 * Authenticate the final complete-Perl consumer job budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPerlXsFinalBudget
	, beforePerlXsFinalBudgetSource
	, perlXsFinalBudgetBehavior
	, perlXsFinalBudgetHistoryAdditions
	, perlXsFinalBudgetHistoryPath
	, perlXsFinalBudgetImplementation
	, perlXsFinalBudgetImplementationPaths
	, perlXsFinalBudgetIntegrationPaths
	, perlXsFinalBudgetNormalizationPaths
	, perlXsFinalBudgetPredecessor
	, reversePerlXsFinalBudgetUpdate
} from "./perl-xs-final-budget-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	perlXsFinalBudgetHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	perlXsFinalBudgetImplementationPaths.map(path => [
		path, blob(perlXsFinalBudgetImplementation, path)
	])
);

test("final Perl XS budget records the exact hosted cancellation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "perl-xs-final-budget-v1");
	assert.equal(value.predecessorCommit, perlXsFinalBudgetPredecessor);
	assert.equal(value.implementationCommit, perlXsFinalBudgetImplementation);
	assert.equal(git(["rev-parse", `${perlXsFinalBudgetImplementation}^`]).trim()
		, perlXsFinalBudgetPredecessor);
	assert.deepEqual(value.discovery, {
		run: 42344727501, job: 128323854103
		, candidate: perlXsFinalBudgetPredecessor
		, event: "workflow_dispatch"
		, startedAt: "2026-11-07T06:27:26Z"
		, cancelledAt: "2026-11-07T09:27:45Z"
		, terminalStep: "Verify owned Perl values and installed CPAN archives"
	});
	assert.deepEqual(value.behavior, {
		...perlXsFinalBudgetBehavior
		, livePinRefreshes: { ...perlXsFinalBudgetBehavior.livePinRefreshes }
	});
	assert.deepEqual(value.updates.map(update => update.path)
		, perlXsFinalBudgetImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, perlXsFinalBudgetIntegrationPaths);
});

test("final Perl XS budget binds the complete lane and both live assertions", () => {
	const sources = implementationSources();
	assert.deepEqual(assertPerlXsFinalBudget(sources), {
		...perlXsFinalBudgetBehavior
		, livePinRefreshes: { ...perlXsFinalBudgetBehavior.livePinRefreshes }
	});
	for(const [path, before, after] of [
		[".github/workflows/perl-consumer.yml"
			, "    timeout-minutes: 240\n", "    timeout-minutes: 180\n"]
		, ["tests/documentation.test.mjs"
			, "assert.match(livePerlJob, /^ {4}timeout-minutes: 240$/m);"
			, "assert.match(livePerlJob, /^ {4}timeout-minutes: 180$/m);"]
		, ["tests/dotnet-recursive-callable-evidence.test.mjs"
			, "assert.match(perl, /^ {4}timeout-minutes: 240$/mu);"
			, "assert.match(perl, /^ {4}timeout-minutes: 180$/mu);"]
	]) {
		const changed = { ...sources, [path]: sources[path].replace(before, after) };
		assert.notEqual(changed[path], sources[path], path);
		assert.throws(() => assertPerlXsFinalBudget(changed)
			, { name: "AssertionError" }, path);
	}
});

test("final Perl XS budget reverses implementation and integration", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = blob(perlXsFinalBudgetImplementation, update.path);
		const previous = blob(perlXsFinalBudgetPredecessor, update.path);
		assert.equal(reversePerlXsFinalBudgetUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePerlXsFinalBudgetSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(perlXsFinalBudgetImplementation, update.path);
		assert.equal(reversePerlXsFinalBudgetUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of perlXsFinalBudgetNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("final Perl XS budget refreshes exactly forty live pins", async () => {
	const value = await record();
	assert.deepEqual(value.refreshed, {
		".github/workflows/perl-consumer.yml": {
			count: 13
			, previous: "0fee0ff4d337cc71f649b6fb7dcc2d76b4b95ca5ceb021b0caeae8613252043c"
			, current: "3b4727d0f18f5642ec457ba4765627bb8ab258e2e5d7b6649b4d32080134dbaa"
		}
		, "tests/documentation.test.mjs": {
			count: 25
			, previous: "5f76105a1c9d8b55fba2d75d47fdf4384c3ee926dc687a96be7de2593eafce1e"
			, current: "34075acfb8e3b3876f91a22c8a01e55cd123fe8618c6694d3b42e7b0d9b65e95"
		}
		, "tests/dotnet-recursive-callable-evidence.test.mjs": {
			count: 2
			, previous: "2e038edcbcbf765e51f27ddd8c9bdd937efcb8e5f0b1c544f00e7f6351e96d50"
			, current: "2189634c9444fd662f5e929edf15549135208501a045f441f03cad75840c1a18"
		}
	});
	assert.equal(Object.values(value.refreshed)
		.reduce((sum, item) => sum + item.count, 0), 40);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
});

test("final Perl XS budget authenticates additions and forgeries", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, perlXsFinalBudgetHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = value.updates[0];
	const current = blob(perlXsFinalBudgetImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reversePerlXsFinalBudgetUpdate(current, forged));
	assert.equal(beforePerlXsFinalBudgetSource("unknown.mjs", current), current);
	const copy = spawnSync(process.execPath, [
		"scripts/update-perl-xs-final-budget-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /History already exists|Expected values to be strictly equal/u);
});
