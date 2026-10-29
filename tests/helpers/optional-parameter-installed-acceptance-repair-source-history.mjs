/**
 * Preserve the optional-parameter installed-acceptance repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterInstalledAcceptanceRepairHistoryPath
	= "docs/evidence/optional-parameter-installed-acceptance-repair-source-history-20261029.json";
export const optionalParameterInstalledAcceptanceRepairPredecessor
	= "147e49e0f3a69769fedcdf0e6f2f022d1cd5c44d";
export const optionalParameterInstalledAcceptanceRepairImplementationCommits
	= Object.freeze([
		"47b5a1fc524664d6f6619415528a84524b8d6ec8"
		, "891de40598ff94769283ff00bc84ffc01c1d3a34"
		, "14a8a77ba49e15e167f693124a7ba4015e4d08ba"
	]);
export const optionalParameterInstalledAcceptanceRepairImplementation
	= optionalParameterInstalledAcceptanceRepairImplementationCommits.at(-1);
export const optionalParameterInstalledAcceptanceRepairImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "src/backends/c/gmp-projection.mjs"
		, "tests/fixtures/optional-parameter-consumers/c.c"
		, "tests/helpers/optional-parameter-language-report.mjs"
		, "tests/optional-native-contract.test.mjs"
		, "tests/optional-parameter-language-installed.test.mjs"
		, "tests/optional-parameter-managed-installed.test.mjs"
		, "tests/optional-parameter-wit-installed.test.mjs"
	]);
export const optionalParameterInstalledAcceptanceRepairImplementationAdditions
	= Object.freeze([
		"scripts/refresh-optional-parameter-installed-acceptance-repair-pins.mjs"
		, "tests/helpers/optional-parameter-installed-contract.mjs"
		, "tests/optional-parameter-installed-contract.test.mjs"
	]);
export const optionalParameterInstalledAcceptanceRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/npm-runtime-module-graph-closure-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-native-evidence-repair-source-history-tests.mjs"
	]);
export const optionalParameterInstalledAcceptanceRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-installed-acceptance-repair-source-history.mjs"
		, "tests/helpers/optional-parameter-installed-acceptance-repair-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-installed-acceptance-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterInstalledAcceptanceRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterInstalledAcceptanceRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterInstalledAcceptanceRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	optionalParameterInstalledAcceptanceRepairImplementationPaths.includes(path)
	|| optionalParameterInstalledAcceptanceRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact installed-acceptance repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterInstalledAcceptanceRepairUpdate = (
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
 * Remove the exact optional installed-acceptance repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterInstalledAcceptanceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterInstalledAcceptanceRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterInstalledAcceptanceRepairUpdate(
				current, update);
	}
	return current;
};
