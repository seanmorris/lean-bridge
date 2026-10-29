/**
 * Preserve the optional-parameter route-binder repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterRouteBinderRepairHistoryPath
	= "docs/evidence/optional-parameter-route-binder-repair-source-history-20261029.json";
export const optionalParameterRouteBinderRepairPredecessor
	= "aa7dc7b4480562aa87d2115e62a16ea7568af136";
export const optionalParameterRouteBinderRepairImplementationCommits
	= Object.freeze([
		"30e648fcba9587b00ca8b0824bcdfa371a5de062"
		, "5cab42efefa5ceb4477bb4430ada2625114073c1"
	]);
export const optionalParameterRouteBinderRepairImplementation
	= optionalParameterRouteBinderRepairImplementationCommits.at(-1);
export const optionalParameterRouteBinderRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/optional-parameter-fixture.mjs"
		, "tests/helpers/optional-parameter-installed-contract.mjs"
		, "tests/helpers/optional-parameter-npm-report.mjs"
		, "tests/helpers/optional-parameter-packages.mjs"
		, "tests/optional-parameter-foundation.test.mjs"
		, "tests/optional-parameter-installed-contract.test.mjs"
		, "tests/optional-parameter-npm-installed.test.mjs"
		, "tests/optional-parameter-php-installed.test.mjs"
	]);
export const optionalParameterRouteBinderRepairImplementationAdditions
	= Object.freeze([]);
export const optionalParameterRouteBinderRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/optional-parameter-perl-unicode-default-repair-source-history-tests.mjs"
	]);
export const optionalParameterRouteBinderRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-route-binder-repair-source-history.mjs"
		, "tests/helpers/optional-parameter-route-binder-repair-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-route-binder-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterRouteBinderRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterRouteBinderRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterRouteBinderRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	optionalParameterRouteBinderRepairImplementationPaths.includes(path)
	|| optionalParameterRouteBinderRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact route-binder repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterRouteBinderRepairUpdate = (
	source, update
) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
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
 * Remove the exact optional route-binder repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterRouteBinderRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterRouteBinderRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterRouteBinderRepairUpdate(
				current, update);
	}
	return current;
};
