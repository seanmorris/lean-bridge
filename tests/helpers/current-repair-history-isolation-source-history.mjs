/**
 * Preserve isolation of current repairs from the historical Fin hub.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const currentRepairHistoryIsolationHistoryPath
	= "docs/evidence/current-repair-history-isolation-source-history-20261029.json";
export const currentRepairHistoryIsolationPredecessor
	= "60f148548a236632f099fedb334ff21bb8380191";
export const currentRepairHistoryIsolationImplementation
	= "b3515cd8c962d2edf93b130fbedd8675a2d78994";
export const currentRepairHistoryIsolationImplementationPaths = Object.freeze([
	"tests/canonical-package-manifest.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/focused-producer-efficiency-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-package-checker-repair-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-wit-identity-repair-source-history-tests.mjs"
	, "tests/helpers/optional-repair-history-registration-source-history-tests.mjs"
	, "tests/optional-parameter-installed-contract.test.mjs"
]);
export const currentRepairHistoryIsolationIntegrationPaths = Object.freeze([
	"tests/canonical-package-manifest.test.mjs"
]);
export const currentRepairHistoryIsolationHistoryAdditions = Object.freeze([
	"scripts/update-current-repair-history-isolation-source-history.mjs"
	, "tests/helpers/current-repair-history-isolation-source-history-tests.mjs"
	, "tests/helpers/current-repair-history-isolation-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${currentRepairHistoryIsolationHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const currentRepairHistoryIsolationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: currentRepairHistoryIsolationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => currentRepairHistoryIsolationImplementationPaths
	.includes(path) || currentRepairHistoryIsolationIntegrationPaths
	.includes(path);

/**
 * Reverse one exact isolation transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseCurrentRepairHistoryIsolationUpdate = (source, update) => {
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
 * Remove the isolation transition from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeCurrentRepairHistoryIsolationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !currentRepairHistoryIsolationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseCurrentRepairHistoryIsolationUpdate(
			current, update);
	}
	return current;
};
