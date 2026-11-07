/**
 * Preserve the evidence-precise complete-Perl budget explanation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlXsBudgetTimingClarificationHistoryPath
	= "docs/evidence/perl-xs-budget-timing-clarification-source-history-20261107.json";
export const perlXsBudgetTimingClarificationPredecessor
	= "f85aa8bd4337c62559bfb1ae0d4c720cce866aa8";
export const perlXsBudgetTimingClarificationImplementation
	= "3e478ac826c9e532cc7de01cc279d914159f116b";
export const perlXsBudgetTimingClarificationImplementationPaths
	= Object.freeze([".github/workflows/perl-consumer.yml"]);
export const perlXsBudgetTimingClarificationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const perlXsBudgetTimingClarificationHistoryAdditions = Object.freeze([
	"scripts/update-perl-xs-budget-timing-clarification-source-history.mjs"
	, "tests/helpers/perl-xs-budget-timing-clarification-source-history-tests.mjs"
	, "tests/helpers/perl-xs-budget-timing-clarification-source-history.mjs"
]);
export const perlXsBudgetTimingClarificationBehavior = Object.freeze({
	timeoutMinutes: 240, minutesFromJobStartToFinalStep: 122
	, setupSeconds: 1100, compareSeconds: 6198
	, partialFinalVerificationSeconds: 3514
	, refreshedPins: 13, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL("../../"
	+ perlXsBudgetTimingClarificationHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const perlXsBudgetTimingClarificationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: perlXsBudgetTimingClarificationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...perlXsBudgetTimingClarificationImplementationPaths
	, ...perlXsBudgetTimingClarificationIntegrationPaths
].includes(path);

/**
 * Require the precise live timeout explanation without changing the lane.
 *
 * @param {string} workflow - Complete live Perl workflow source.
 */
export const assertPerlXsBudgetTimingClarification = workflow => {
	assert.equal(typeof workflow, "string");
	const job = workflow.match(/^ {2}perl:\n([^]*?)(?=^ {2}[a-z][a-z-]*:)/mu)?.[0];
	assert.ok(job);
	assert.match(job, /^ {4}timeout-minutes: 240$/mu);
	assert.match(job
		, /^ {4}# 122 minutes after job start and exhausted the 180-minute job cap\.$/mu);
	assert.doesNotMatch(job, /122 minutes of Compare\/Verify work/u);
	for(const step of [
		"Compare installed Perl corpus packages with fresh Lean results"
		, "Verify owned Perl values and installed CPAN archives"
	]) assert.equal(job.split(`      - name: ${step}\n`).length - 1, 1, step);
	return { ...perlXsBudgetTimingClarificationBehavior };
};

/**
 * Reverse one authenticated wording transition.
 *
 * @param {string} source - Complete later source.
 * @param {{path:string,currentSha256:string,previousSha256:string,edits:Array}} update - Authenticated transition.
 */
export const reversePerlXsBudgetTimingClarificationUpdate = (
	source, update
) => {
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
 * Remove only authenticated budget-timing clarification transitions.
 *
 * @param {string} path - Repository-relative path.
 * @param {string|Buffer} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping digest.
 */
export const beforePerlXsBudgetTimingClarificationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlXsBudgetTimingClarificationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePerlXsBudgetTimingClarificationUpdate(current, update);
	}
	return current;
};
