/**
 * Preserve the optional-parameter native evidence correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterNativeEvidenceRepairHistoryPath
	= "docs/evidence/optional-parameter-native-evidence-repair-source-history-20261029.json";
export const optionalParameterNativeEvidenceRepairPredecessor
	= "0c356ca0152263470297e0583fc26bf75f63427e";
export const optionalParameterNativeEvidenceRepairImplementation
	= "b73efe13172fe7bb922ffc83ecf1f8926b95ab24";
export const optionalParameterNativeEvidenceRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/optional-parameter-fixture.mjs"
		, "tests/helpers/optional-parameter-language-report.mjs"
		, "tests/helpers/optional-parameter-managed-report.mjs"
		, "tests/helpers/optional-parameter-native-report.mjs"
		, "tests/helpers/optional-parameter-packages.mjs"
		, "tests/helpers/optional-parameter-php-report.mjs"
		, "tests/helpers/optional-parameter-wit-report.mjs"
		, "tests/optional-parameter-foundation.test.mjs"
		, "tests/optional-parameter-language-installed.test.mjs"
		, "tests/optional-parameter-managed-installed.test.mjs"
		, "tests/optional-parameter-native-installed.test.mjs"
		, "tests/optional-parameter-php-installed.test.mjs"
		, "tests/optional-parameter-wit-installed.test.mjs"
	]);
export const optionalParameterNativeEvidenceRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const optionalParameterNativeEvidenceRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-optional-parameter-native-evidence-repair-source-history.mjs"
		, "tests/helpers/optional-parameter-native-evidence-repair-source-history-tests.mjs"
		, "tests/helpers/optional-parameter-native-evidence-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${optionalParameterNativeEvidenceRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const optionalParameterNativeEvidenceRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: optionalParameterNativeEvidenceRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => optionalParameterNativeEvidenceRepairImplementationPaths
	.includes(path) || optionalParameterNativeEvidenceRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one exact native-evidence repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseOptionalParameterNativeEvidenceRepairUpdate
	= (source, update) => {
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
 * Remove native-evidence integration and implementation transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeOptionalParameterNativeEvidenceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !optionalParameterNativeEvidenceRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOptionalParameterNativeEvidenceRepairUpdate(
				current, update);
	}
	return current;
};
