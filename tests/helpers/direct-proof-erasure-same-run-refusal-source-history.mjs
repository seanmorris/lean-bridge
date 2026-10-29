/**
 * Preserve the same-run fresh-Lean proof-refusal gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureSameRunRefusalHistoryPath
	= "docs/evidence/direct-proof-erasure-same-run-refusal-source-history-20261029.json";
export const directProofErasureSameRunRefusalPredecessor
	= "f2b00d4e54d547054b412580a0ce2c759abc2b4b";
export const directProofErasureSameRunRefusalImplementation
	= "0555265d6b4362b6aa67862faa43606dcfd50505";
export const directProofErasureSameRunRefusalImplementationPaths
	= Object.freeze([
		".github/workflows/direct-proof-erasure-complete.yml"
		, "scripts/archive-direct-proof-erasure-hosted.mjs"
		, "scripts/download-direct-proof-erasure-hosted-inputs.mjs"
		, "tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"
		, "tests/helpers/direct-proof-erasure-hosted-archive-tests.mjs"
		, "tests/helpers/direct-proof-erasure-hosted-archive.mjs"
		, "tests/helpers/direct-proof-erasure-hosted-evidence.mjs"
	]);
export const directProofErasureSameRunRefusalIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureSameRunRefusalHistoryAdditions
	= Object.freeze([
		"scripts/update-direct-proof-erasure-same-run-refusal-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-same-run-refusal-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-same-run-refusal-source-history.mjs"
	]);
export const directProofErasureSameRunRefusalNormalizationPaths
	= Object.freeze([...new Set([
		...directProofErasureSameRunRefusalImplementationPaths
		, ...directProofErasureSameRunRefusalIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureSameRunRefusalHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated same-run refusal transition.
 *
 * @param source - Complete current source.
 * @param update - Path, digests and current-side edits.
 */
export const reverseDirectProofErasureSameRunRefusalUpdate = (
	source, update
) => {
	assert.ok(directProofErasureSameRunRefusalNormalizationPaths
		.includes(update.path), update.path);
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
 * Remove this same-run refusal layer newest-first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDirectProofErasureSameRunRefusalSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureSameRunRefusalNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDirectProofErasureSameRunRefusalUpdate(
				current, update);
	}
	return current;
};
