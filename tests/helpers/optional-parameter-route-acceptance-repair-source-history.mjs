/**
 * Preserve the exact optional-parameter route acceptance repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterRouteAcceptanceRepairHistoryPath
	= "docs/evidence/optional-parameter-route-acceptance-repair-source-history-20261029.json";
export const optionalParameterRouteAcceptanceRepairPredecessor
	= "f84fe638f97b47829774ddb1ed1835e95bf37464";
export const optionalParameterRouteAcceptanceRepairImplementation
	= "cdda9e12eb6ae04b2c836d84456577915d8384f3";
export const optionalParameterRouteAcceptanceRepairImplementationPaths
	= Object.freeze([
		"tests/fixtures/optional-parameter-consumers/php.php"
		, "tests/helpers/optional-parameter-installed-contract.mjs"
		, "tests/helpers/optional-parameter-npm-report.mjs"
		, "tests/helpers/optional-parameter-php-report.mjs"
		, "tests/optional-parameter-installed-contract.test.mjs"
		, "tests/optional-parameter-npm-installed.test.mjs"
		, "tests/optional-parameter-php-installed.test.mjs"
	]);
export const optionalParameterRouteAcceptanceRepairIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const optionalParameterRouteAcceptanceRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-route-acceptance-repair-source-history.mjs"
		, "tests/helpers/optional-parameter-route-acceptance-repair-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-route-acceptance-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterRouteAcceptanceRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterRouteAcceptanceRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: optionalParameterRouteAcceptanceRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => optionalParameterRouteAcceptanceRepairImplementationPaths
	.includes(path) || optionalParameterRouteAcceptanceRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one exact route-acceptance transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterRouteAcceptanceRepairUpdate = (
	source, update
) => {
	assert.ok(allowed(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const pieces = [];
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
		pieces.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	pieces.push(source.slice(cursor));
	const previous = pieces.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the repair from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterRouteAcceptanceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterRouteAcceptanceRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseOptionalParameterRouteAcceptanceRepairUpdate(
			current, update);
	}
	return current;
};
