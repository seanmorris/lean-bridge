/**
 * Preserve the dependent-Fin expected-model lint repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentFinLintRepairHistoryPath
	= "docs/evidence/dependent-fin-lint-repair-source-history-20261031.json";
export const dependentFinLintRepairPredecessor
	= "71b83890269dc1cf62b4deef2680e3e32603705d";
export const dependentFinLintRepairImplementation
	= "99f762d4a90cd98a5a6b0a89fbfdbf48b9e1ced3";
export const dependentFinLintRepairImplementationPaths = Object.freeze([
	"tests/elaborated-metadata.test.mjs"
]);
export const dependentFinLintRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const dependentFinLintRepairHistoryAdditions = Object.freeze([
	"scripts/update-dependent-fin-lint-repair-source-history.mjs"
	, "tests/helpers/dependent-fin-lint-repair-source-history-tests.mjs"
	, "tests/helpers/dependent-fin-lint-repair-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + dependentFinLintRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const dependentFinLintRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: dependentFinLintRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => dependentFinLintRepairImplementationPaths
	.includes(path) || dependentFinLintRepairIntegrationPaths.includes(path);

/**
 * Reverse one exact dependent-Fin lint transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated reversible transition.
 */
export const reverseDependentFinLintRepairUpdate = (source, update) => {
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
 * Remove only the authenticated dependent-Fin lint repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentFinLintRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !dependentFinLintRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentFinLintRepairUpdate(current, update);
	}
	return current;
};
