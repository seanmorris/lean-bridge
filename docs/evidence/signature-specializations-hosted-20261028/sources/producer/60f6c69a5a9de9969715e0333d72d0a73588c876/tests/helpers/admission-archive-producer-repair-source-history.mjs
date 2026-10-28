/**
 * Reverse the explicit Feature and archive producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const admissionArchiveProducerRepairHistoryPath
	= "docs/evidence/admission-archive-producer-repair-source-history-20261024.json";
export const admissionArchiveProducerRepairPredecessor
	= "618580a8fbee793b648fe72d6f06679611124583";
export const admissionArchiveProducerRepairImplementation
	= "b70f755f38f12513d36cb9c83457f104481f1c07";
export const admissionArchiveProducerRepairIntegrationBase
	= "b70f755f38f12513d36cb9c83457f104481f1c07";
export const admissionArchiveProducerRepairCommits = Object.freeze([
	"194938a0d9d63a34c50c8564e55b2170d562b4d8"
	, "babb307d40fcf8f7c50c2acac706f11472581c66"
	, "b70f755f38f12513d36cb9c83457f104481f1c07"
]);
export const admissionArchiveProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-rust-transfer-evidence.mjs"
	, "tests/helpers/zero-payload-checked-record-php-ci-report.mjs"
	, "tests/owned-javascript-borrow-package.test.mjs"
	, "tests/owned-php-wasm-borrows.test.mjs"
	, "tests/wit-owned-callback-results.test.mjs"
]);
export const admissionArchiveProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const admissionArchiveProducerRepairNormalizationPaths = Object.freeze([
	...admissionArchiveProducerRepairChangedPaths
	, ...admissionArchiveProducerRepairIntegrationPaths
]);
export const admissionArchiveProducerRepairAddedPaths = Object.freeze([
	"scripts/update-admission-archive-producer-repair-source-history.mjs"
	, "tests/helpers/admission-archive-producer-repair-source-history-tests.mjs"
	, "tests/helpers/admission-archive-producer-repair-source-history.mjs"
	, "tests/helpers/feature-admission-producer-binding-tests.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	admissionArchiveProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseAdmissionArchiveProducerRepairUpdate = (
	source, update
) => {
	assert.ok(admissionArchiveProducerRepairNormalizationPaths
		.includes(update.path));
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact Feature and archive producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeAdmissionArchiveProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !admissionArchiveProducerRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseAdmissionArchiveProducerRepairUpdate(current, update);
	}
	return current;
};

