/**
 * Preserve the installed-Perl callback evidence argument repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlCallbackModuleArgumentRepairHistoryPath
	= "docs/evidence/perl-callback-module-argument-repair-source-history-20261031.json";
export const perlCallbackModuleArgumentRepairPredecessor
	= "766fd12a6297fe52fe3eeccc77105aacb2f32903";
export const perlCallbackModuleArgumentRepairImplementation
	= "4b2f4b73ad64e765d9f1c941ebc66c8e381100c5";
export const perlCallbackModuleArgumentRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/owned-perl-callback-result-package-evidence.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-evidence.mjs"
	]);
export const perlCallbackModuleArgumentRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const perlCallbackModuleArgumentRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-perl-callback-module-argument-repair-source-history.mjs"
		, "tests/helpers/perl-callback-module-argument-repair-source-history-tests.mjs"
		, "tests/helpers/perl-callback-module-argument-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + perlCallbackModuleArgumentRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const perlCallbackModuleArgumentRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: perlCallbackModuleArgumentRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	perlCallbackModuleArgumentRepairImplementationPaths.includes(path)
	|| perlCallbackModuleArgumentRepairIntegrationPaths.includes(path);

/**
 * Require the exact installed-module argument in both evidence readers.
 *
 * @param {string} path - Repository-relative implementation path.
 * @param {string} source - Complete implementation source.
 */
export const assertPerlCallbackModuleArgumentRepair = (path, source) => {
	assert.ok(perlCallbackModuleArgumentRepairImplementationPaths
		.includes(path), path);
	assert.match(source
		, /join\((?:consumerRoot|consumer), "changed-native-file"\)[\s\S]{0,100}item[.]manifest[.]module[\s\S]{0,80}[.][.][.](?:assetPaths|paths)/u);
	return { installedModuleArgument: true };
};

/**
 * Reverse one authenticated installed-module argument repair transition.
 *
 * @param {string} source - Complete later source.
 * @param {object} update - Authenticated reversible transition.
 */
export const reversePerlCallbackModuleArgumentRepairUpdate = (
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
 * Remove only the authenticated installed-module argument repair.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping SHA-256.
 */
export const beforePerlCallbackModuleArgumentRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlCallbackModuleArgumentRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePerlCallbackModuleArgumentRepairUpdate(
				current, update);
	}
	return current;
};
