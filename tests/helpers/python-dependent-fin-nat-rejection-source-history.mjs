/**
 * Preserve the Python dependent-Fin Nat-rejection repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const pythonDependentFinNatRejectionHistoryPath
	= "docs/evidence/python-dependent-fin-nat-rejection-source-history-20261031.json";
export const pythonDependentFinNatRejectionPredecessor
	= "b2cadff2c026590258c37d94cc2e7256e96bd3dc";
export const pythonDependentFinNatRejectionImplementation
	= "d51b919c6e8fd054a065013987ed2d1adc273eaa";
export const pythonDependentFinNatRejectionImplementationPaths
	= Object.freeze([
		"tests/fixtures/dependent-fin-consumers/python.py"
		, "tests/managed-dependent-fin.test.mjs"
	]);
export const pythonDependentFinNatRejectionIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const pythonDependentFinNatRejectionHistoryAdditions
	= Object.freeze([
		"scripts/update-python-dependent-fin-nat-rejection-source-history.mjs"
		, "tests/helpers/python-dependent-fin-nat-rejection-source-history-tests.mjs"
		, "tests/helpers/python-dependent-fin-nat-rejection-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + pythonDependentFinNatRejectionHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const pythonDependentFinNatRejectionNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: pythonDependentFinNatRejectionImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => pythonDependentFinNatRejectionImplementationPaths
	.includes(path) || pythonDependentFinNatRejectionIntegrationPaths
	.includes(path);

/**
 * Reverse one exact Python dependent-Fin Nat-rejection transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated reversible transition.
 */
export const reversePythonDependentFinNatRejectionUpdate = (
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
 * Remove only the authenticated Python dependent-Fin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePythonDependentFinNatRejectionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !pythonDependentFinNatRejectionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePythonDependentFinNatRejectionUpdate(current, update);
	}
	return current;
};
