/**
 * Preserve the split between current reviewed-Subtype reports and the frozen
 * 2026-10-10 producer contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedSubtypeLiveExpectationHistoryPath
	= "docs/evidence/reviewed-subtype-live-expectation-source-history-20261107.json";
export const reviewedSubtypeLiveExpectationPredecessor
	= "9be38cfab7402a03be96e34be38befd2385bdd50";
export const reviewedSubtypeLiveExpectationImplementation
	= "ae3cc4d0ec8d4a79f2aeabe90525d62aa3d6a25a";
export const reviewedSubtypeLiveExpectationImplementationPaths = Object.freeze([
	"scripts/archive-reviewed-subtype-python-hosts.mjs"
	, "scripts/archive-reviewed-subtype-remaining-hosts.mjs"
	, "scripts/archive-reviewed-subtype-ruby-jvm-hosts.mjs"
	, "scripts/run-reviewed-subtype-host-ci.sh"
	, "tests/helpers/reviewed-subtype-host-ci-report-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-shell-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-report.mjs"
	, "tests/helpers/reviewed-subtype-python-archive-tests.mjs"
	, "tests/helpers/reviewed-subtype-python-archive.mjs"
	, "tests/helpers/reviewed-subtype-remaining-archive-tests.mjs"
	, "tests/helpers/reviewed-subtype-remaining-archive.mjs"
	, "tests/helpers/reviewed-subtype-ruby-jvm-archive-tests.mjs"
	, "tests/helpers/reviewed-subtype-ruby-jvm-archive.mjs"
]);
export const reviewedSubtypeLiveExpectationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const reviewedSubtypeLiveExpectationHistoryAdditions = Object.freeze([
	"scripts/update-reviewed-subtype-live-expectation-source-history.mjs"
	, "tests/helpers/reviewed-subtype-live-expectation-source-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-live-expectation-source-history.mjs"
]);
export const reviewedSubtypeLiveExpectationBehavior = Object.freeze({
	producerContracts: Object.freeze({ current: "current", archived: "2026-10-10" })
	, declarations: 12, currentSelectedContracts: 10
	, archivedSelectedContracts: 12, archivedLanes: 12
	, changedSupportCells: 0, runtimeSemanticChanges: 0
});

const historyUrl = new URL(
	"../../" + reviewedSubtypeLiveExpectationHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const reviewedSubtypeLiveExpectationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: reviewedSubtypeLiveExpectationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...reviewedSubtypeLiveExpectationImplementationPaths
	, ...reviewedSubtypeLiveExpectationIntegrationPaths
].includes(path);
const count = (source, needle) => source.split(needle).length - 1;

/**
 * Bind the closed current/archive selector and every caller's declared epoch.
 *
 * @param sources - Implementation paths mapped to complete source text.
 */
export const assertReviewedSubtypeLiveExpectationRepair = sources => {
	assert.deepEqual(Object.keys(sources).sort()
		, [...reviewedSubtypeLiveExpectationImplementationPaths].sort());
	const report = sources["tests/helpers/reviewed-subtype-host-report.mjs"];
	for(const marker of [
		"async ({ profiles, read, python, expectation })"
		, "[\"current\", \"2026-10-10\"].includes(expectation)"
		, "expectation === \"current\" ? reviewedSubtypeHostIr() : reviewedSubtypeHistoricalHostIr()"
		, "? reviewedSourceSelection(identity.reviewedBindingIr)"
		, ": historicalReviewedSelection(identity.reviewedBindingIr, review)"
	]) assert.equal(count(report, marker), 1, marker);
	const ci = sources["tests/helpers/reviewed-subtype-host-ci-report.mjs"];
	assert.equal(count(ci, "--expectation current|2026-10-10"), 1);
	assert.equal(count(ci, "[\"current\", \"2026-10-10\"].includes(parsed.expectation)"), 1);
	assert.equal(count(ci, "\"--expectation\", options.expectation"), 1);
	const runner = sources["scripts/run-reviewed-subtype-host-ci.sh"];
	assert.equal(count(runner, "--expectation current"), 1);
	const historical = reviewedSubtypeLiveExpectationImplementationPaths
		.filter(path => path.includes("archive-reviewed-subtype-")
			|| path.includes("reviewed-subtype-") && path.includes("-archive"))
		.map(path => count(sources[path], "expectation: \"2026-10-10\""))
		.reduce((total, value) => total + value, 0);
	assert.equal(historical, 12);
	const tests = sources["tests/helpers/reviewed-subtype-host-ci-report-tests.mjs"];
	assert.equal(count(tests
		, "current and frozen reviewed Subtype producer contracts are never interchangeable"), 1);
	assert.equal(count(tests, "expectation: \"current\""), 1);
	return { ...reviewedSubtypeLiveExpectationBehavior };
};

/**
 * Reverse one authenticated implementation or integration transition.
 *
 * @param source Current source text.
 * @param update Authenticated source-history transition.
 */
export const reverseReviewedSubtypeLiveExpectationUpdate = (source, update) => {
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
 * Remove only authenticated live-expectation transitions.
 *
 * @param path Repository-relative source path.
 * @param source Current source text.
 * @param expected Optional digest at which reversal should stop.
 */
export const beforeReviewedSubtypeLiveExpectationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !reviewedSubtypeLiveExpectationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseReviewedSubtypeLiveExpectationUpdate(current, update);
	}
	return current;
};
