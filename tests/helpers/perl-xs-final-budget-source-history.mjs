/**
 * Preserve the final complete-Perl consumer job budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlXsFinalBudgetHistoryPath
	= "docs/evidence/perl-xs-final-budget-source-history-20261107.json";
export const perlXsFinalBudgetPredecessor
	= "d6a4044154d4e998d31b7ad24ad245d5e5b93347";
export const perlXsFinalBudgetImplementation
	= "f3cf52d5940662fbf1909d4bc0e6786e189cb820";
export const perlXsFinalBudgetImplementationPaths = Object.freeze([
	".github/workflows/perl-consumer.yml"
	, "tests/documentation.test.mjs"
	, "tests/dotnet-recursive-callable-evidence.test.mjs"
]);
export const perlXsFinalBudgetIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const perlXsFinalBudgetHistoryAdditions = Object.freeze([
	"scripts/update-perl-xs-final-budget-source-history.mjs"
	, "tests/helpers/perl-xs-final-budget-source-history-tests.mjs"
	, "tests/helpers/perl-xs-final-budget-source-history.mjs"
]);
export const perlXsFinalBudgetBehavior = Object.freeze({
	previousTimeoutMinutes: 180, currentTimeoutMinutes: 240
	, compareVerifyMinutesBeforeFinalStep: 122
	, livePinRefreshes: Object.freeze({
		".github/workflows/perl-consumer.yml": 13
		, "tests/documentation.test.mjs": 25
		, "tests/dotnet-recursive-callable-evidence.test.mjs": 2
	})
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../" + perlXsFinalBudgetHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const perlXsFinalBudgetNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: perlXsFinalBudgetImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...perlXsFinalBudgetImplementationPaths
	, ...perlXsFinalBudgetIntegrationPaths
].includes(path);

/**
 * Require the complete Perl XS lane and its measured final job budget.
 *
 * @param {Record<string, string>} sources - Implementation sources by path.
 */
export const assertPerlXsFinalBudget = sources => {
	for(const path of perlXsFinalBudgetImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const workflow = sources[".github/workflows/perl-consumer.yml"];
	const job = workflow.match(/^ {2}perl:\n([^]*?)(?=^ {2}[a-z][a-z-]*:)/mu)?.[0];
	assert.ok(job);
	assert.match(job, /^ {4}name: Perl XS \(\$\{\{ matrix\.configuration \}\}\)$/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 240$/mu);
	assert.match(job, /^ {4}# 122 minutes of Compare\/Verify work and exhausted the 180-minute job cap\.$/mu);
	assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	for(const step of [
		"Compare installed Perl corpus packages with fresh Lean results"
		, "Verify owned Perl values and installed CPAN archives"
	]) assert.equal(job.split(`      - name: ${step}\n`).length - 1, 1, step);
	assert.equal(sources["tests/documentation.test.mjs"].split(
		"assert.match(livePerlJob, /^ {4}timeout-minutes: 240$/m);"
	).length - 1, 1);
	assert.equal(sources["tests/documentation.test.mjs"].split(
		"assert.match(perlJob, /^ {4}timeout-minutes: 180$/m);"
	).length - 1, 1);
	assert.equal(sources["tests/dotnet-recursive-callable-evidence.test.mjs"].split(
		"assert.match(perl, /^ {4}timeout-minutes: 240$/mu);"
	).length - 1, 1);
	return {
		...perlXsFinalBudgetBehavior
		, livePinRefreshes: { ...perlXsFinalBudgetBehavior.livePinRefreshes }
	};
};

/**
 * Reverse one authenticated final-budget transition.
 *
 * @param {string} source - Complete later source.
 * @param {{path:string,currentSha256:string,previousSha256:string,edits:Array}} update - Authenticated transition.
 */
export const reversePerlXsFinalBudgetUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only authenticated final Perl XS budget transitions.
 *
 * @param {string} path - Repository-relative path.
 * @param {string|Buffer} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforePerlXsFinalBudgetSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !perlXsFinalBudgetNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePerlXsFinalBudgetUpdate(current, update);
	}
	return current;
};
