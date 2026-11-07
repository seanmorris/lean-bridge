/**
 * Authenticate the evidence-precise complete-Perl budget explanation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPerlXsBudgetTimingClarification
	, beforePerlXsBudgetTimingClarificationSource
	, perlXsBudgetTimingClarificationBehavior
	, perlXsBudgetTimingClarificationHistoryAdditions
	, perlXsBudgetTimingClarificationHistoryPath
	, perlXsBudgetTimingClarificationImplementation
	, perlXsBudgetTimingClarificationImplementationPaths
	, perlXsBudgetTimingClarificationIntegrationPaths
	, perlXsBudgetTimingClarificationNormalizationPaths
	, perlXsBudgetTimingClarificationPredecessor
	, reversePerlXsBudgetTimingClarificationUpdate
} from "./perl-xs-budget-timing-clarification-source-history.mjs";
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
	perlXsBudgetTimingClarificationHistoryPath, "utf8"));

test("Perl XS budget clarification records the exact hosted timing", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "perl-xs-budget-timing-clarification-v1");
	assert.equal(value.predecessorCommit
		, perlXsBudgetTimingClarificationPredecessor);
	assert.equal(value.implementationCommit
		, perlXsBudgetTimingClarificationImplementation);
	assert.equal(git(["rev-parse"
		, `${perlXsBudgetTimingClarificationImplementation}^`]).trim()
	, perlXsBudgetTimingClarificationPredecessor);
	assert.deepEqual(value.discovery, {
		run: 42344727501, job: 128323854103
		, candidate: "d6a4044154d4e998d31b7ad24ad245d5e5b93347"
		, jobStartedAt: "2026-11-07T06:27:26Z"
		, compareStartedAt: "2026-11-07T06:45:46Z"
		, compareCompletedAt: "2026-11-07T08:29:04Z"
		, finalVerificationStartedAt: "2026-11-07T08:29:04Z"
		, finalVerificationCancelledAt: "2026-11-07T09:27:38Z"
		, jobCancelledAt: "2026-11-07T09:27:45Z"
	});
	assert.deepEqual(value.behavior
		, { ...perlXsBudgetTimingClarificationBehavior });
	assert.deepEqual(value.updates.map(update => update.path)
		, perlXsBudgetTimingClarificationImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, perlXsBudgetTimingClarificationIntegrationPaths);
});

test("Perl XS budget clarification binds live wording and unchanged lane", async () => {
	const current = blob(perlXsBudgetTimingClarificationImplementation
		, perlXsBudgetTimingClarificationImplementationPaths[0]);
	assert.deepEqual(assertPerlXsBudgetTimingClarification(current)
		, { ...perlXsBudgetTimingClarificationBehavior });
	const previous = blob(perlXsBudgetTimingClarificationPredecessor
		, perlXsBudgetTimingClarificationImplementationPaths[0]);
	assert.throws(() => assertPerlXsBudgetTimingClarification(previous)
		, { name: "AssertionError" });
	const value = await record();
	assert.equal(reversePerlXsBudgetTimingClarificationUpdate(
		current, value.updates[0]), previous);
});

test("Perl XS budget clarification reverses implementation and integration", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = blob(perlXsBudgetTimingClarificationImplementation
			, update.path);
		const previous = blob(perlXsBudgetTimingClarificationPredecessor
			, update.path);
		assert.equal(beforePerlXsBudgetTimingClarificationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(perlXsBudgetTimingClarificationImplementation
			, update.path);
		assert.equal(reversePerlXsBudgetTimingClarificationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of perlXsBudgetTimingClarificationNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("Perl XS budget clarification refreshes only thirteen live pins", async () => {
	const value = await record();
	assert.deepEqual(value.refreshed, {
		path: ".github/workflows/perl-consumer.yml", count: 13
		, previous: "3b4727d0f18f5642ec457ba4765627bb8ab258e2e5d7b6649b4d32080134dbaa"
		, current: "bf209445a99582425f5df222dc202a967ffc0452ddbfa3e4c3156e3b3041b048"
	});
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
});

test("Perl XS budget clarification authenticates additions and forgeries", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, perlXsBudgetTimingClarificationHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = value.updates[0];
	const current = blob(perlXsBudgetTimingClarificationImplementation
		, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reversePerlXsBudgetTimingClarificationUpdate(
		current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-perl-xs-budget-timing-clarification-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /History already exists|Expected values to be strictly equal/u);
});
