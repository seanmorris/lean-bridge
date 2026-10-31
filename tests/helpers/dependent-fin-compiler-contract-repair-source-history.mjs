/**
 * Preserve the dependent-Fin compiler-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentFinCompilerContractRepairHistoryPath
	= "docs/evidence/dependent-fin-compiler-contract-repair-source-history-20261031.json";
export const dependentFinCompilerContractRepairPredecessor
	= "7a9d47ae9f7e65bd2614fb8adfab5a7dd3735a99";
export const dependentFinCompilerContractRepairImplementation
	= "84bc4ac41cff09f2b90af05edbc5907666a20789";
export const dependentFinCompilerContractRepairImplementationPaths
	= Object.freeze([
		"tests/elaborated-metadata.test.mjs"
		, "tests/lake-wasm.test.mjs"
	]);
export const dependentFinCompilerContractRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentFinCompilerContractRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-dependent-fin-compiler-contract-repair-source-history.mjs"
		, "tests/helpers/dependent-fin-compiler-contract-repair-source-history-tests.mjs"
		, "tests/helpers/dependent-fin-compiler-contract-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + dependentFinCompilerContractRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const dependentFinCompilerContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: dependentFinCompilerContractRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => dependentFinCompilerContractRepairImplementationPaths
	.includes(path) || dependentFinCompilerContractRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one exact dependent-Fin compiler-contract transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated reversible transition.
 */
export const reverseDependentFinCompilerContractRepairUpdate = (
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
 * Remove only the authenticated dependent-Fin compiler-contract repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentFinCompilerContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentFinCompilerContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentFinCompilerContractRepairUpdate(
				current, update);
	}
	return current;
};
