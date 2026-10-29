/**
 * Preserve the focused dependent-signature hosted archive contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureFocusedArchiveHistoryPath
	= "docs/evidence/dependent-signature-focused-archive-source-history-20261029.json";
export const dependentSignatureFocusedArchivePredecessor
	= "b27603fed9401f5b614e532faa53b8188660a51c";
export const dependentSignatureFocusedArchiveImplementation
	= "8163ddc41b7f1257ee89e96047ad6eef3224d6a5";
export const dependentSignatureFocusedArchiveCommits = Object.freeze([
	"346e91f05555f93cd75f212399739e91c2b06143"
	, dependentSignatureFocusedArchiveImplementation
]);
export const dependentSignatureFocusedArchiveChangedPaths = Object.freeze([
	".github/workflows/dependent-signature-complete.yml"
	, "scripts/archive-dependent-signature-hosted.mjs"
	, "scripts/download-dependent-signature-hosted-inputs.mjs"
	, "tests/helpers/dependent-signature-complete-promotion-tests.mjs"
	, "tests/helpers/dependent-signature-complete-promotion.mjs"
	, "tests/helpers/dependent-signature-hosted-archive.mjs"
	, "tests/helpers/dependent-signature-hosted-evidence.mjs"
	, "tests/helpers/dependent-signature-hosted-tests.mjs"
]);
export const dependentSignatureFocusedArchiveImplementationAdditions
	= Object.freeze([
		"tests/dependent-signature-complete-hosted-evidence.test.mjs"
		, "tests/dependent-signature-complete-promotion.test.mjs"
	]);
export const dependentSignatureFocusedArchiveIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const dependentSignatureFocusedArchiveHistoryAdditions = Object.freeze([
	"scripts/update-dependent-signature-focused-archive-source-history.mjs"
	, "tests/helpers/dependent-signature-focused-archive-source-history-tests.mjs"
	, "tests/helpers/dependent-signature-focused-archive-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${dependentSignatureFocusedArchiveHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const dependentSignatureFocusedArchiveNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: dependentSignatureFocusedArchiveChangedPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => dependentSignatureFocusedArchiveChangedPaths
	.includes(path) || dependentSignatureFocusedArchiveIntegrationPaths
	.includes(path);

/**
 * Reverse one authenticated archive-contract transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseDependentSignatureFocusedArchiveUpdate = (
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
 * Remove every matching focused archive transition, newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentSignatureFocusedArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentSignatureFocusedArchiveNormalizationPaths.includes(path))
		return source;
	let current = source;
	const updates = [
		...record().integrationUpdates, ...record().updates
	];
	while(true)
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDependentSignatureFocusedArchiveUpdate(current, update);
	}
};
