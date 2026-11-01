/**
 * Preserve the retained Scalar Fin suite registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const scalarFinSuiteRegistrationHistoryPath
	= "docs/evidence/scalar-fin-suite-registration-source-history-20261101.json";
export const scalarFinSuiteRegistrationPredecessor
	= "989f01eac8c85b7d2c2c1286061b943de8491a89";
export const scalarFinSuiteRegistrationImplementation
	= "7d9e69c54a5167c77ed3d149eb8393ba3853ec21";
export const scalarFinSuiteRegistrationImplementationPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
]);
export const scalarFinSuiteRegistrationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/core-final-audit-registration-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const scalarFinSuiteRegistrationHistoryAdditions = Object.freeze([
	"scripts/update-scalar-fin-suite-registration-source-history.mjs"
	, "tests/helpers/scalar-fin-suite-registration-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-suite-registration-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${scalarFinSuiteRegistrationHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const scalarFinSuiteRegistrationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: scalarFinSuiteRegistrationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...scalarFinSuiteRegistrationImplementationPaths
	, ...scalarFinSuiteRegistrationIntegrationPaths
].includes(path);

/**
 * Assert that the retained suite has one explicit Core contract profile.
 *
 * @param source - Complete test-profile manifest source.
 */
export const assertScalarFinSuiteRegistration = source => {
	assert.equal(typeof source, "string");
	assert.match(source
		, /, "scalar-fin-rejection"\s*\n\s*, "scalar-fin-source-entry"/u);
	assert.equal(source.split('"scalar-fin-source-entry"').length - 1, 1);
};

/**
 * Reverse one authenticated Scalar Fin suite registration transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseScalarFinSuiteRegistrationUpdate = (source, update) => {
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
 * Remove only authenticated Scalar Fin registration transitions.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeScalarFinSuiteRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !scalarFinSuiteRegistrationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseScalarFinSuiteRegistrationUpdate(current, update);
	}
	return current;
};
