/**
 * Preserve the canonical dependent-Python receipt repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentPythonReceiptCanonicalHistoryPath
	= "docs/evidence/dependent-python-receipt-canonical-source-history-20261029.json";
export const dependentPythonReceiptCanonicalPredecessor
	= "23fd3a33fa1a8e3e19b33dea7a2b4b1f9b15c2b1";
export const dependentPythonReceiptCanonicalImplementation
	= "dcb4b292ce95a8596eaa7b4803c69cf35595a0a8";
export const dependentPythonReceiptCanonicalImplementationPaths
	= Object.freeze([
		"scripts/check-dependent-checked-record-python-ci.mjs"
		, "tests/helpers/dependent-checked-record-python-ci-report.mjs"
		, "tests/helpers/dependent-checked-record-python-tests.mjs"
	]);
export const dependentPythonReceiptCanonicalIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentPythonReceiptCanonicalHistoryAdditions
	= Object.freeze([
		"scripts/update-dependent-python-receipt-canonical-source-history.mjs"
		, "tests/helpers/dependent-python-receipt-canonical-source-history-tests.mjs"
		, "tests/helpers/dependent-python-receipt-canonical-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${dependentPythonReceiptCanonicalHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const dependentPythonReceiptCanonicalNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: dependentPythonReceiptCanonicalImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])
].sort());
const allowed = path => dependentPythonReceiptCanonicalImplementationPaths
	.includes(path) || dependentPythonReceiptCanonicalIntegrationPaths
	.includes(path);

/**
 * Reverse one authenticated canonical-receipt transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDependentPythonReceiptCanonicalUpdate = (
	source, update
) => {
	assert.ok(allowed(update.path), update.path);
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
 * Remove only the authenticated canonical-receipt repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeDependentPythonReceiptCanonicalSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentPythonReceiptCanonicalNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseDependentPythonReceiptCanonicalUpdate(
			current, update);
	}
	return current;
};
