/**
 * Preserve exact predecessors when integrating container counter archives and recurring CI checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeHostedContainerInventorySource } from "./hosted-container-inventory-source-history.mjs";

export const finContainerEvidenceCiHistoryPath = "docs/evidence/fin-container-evidence-ci-source-history-20261009.json";
export const finContainerEvidenceCiPredecessor = "60c80691ae2d432cfe304906549adbe6dab8bd4b";
export const finContainerEvidenceCiChangedPaths = [
	"docs/type-surface.v1.json"
	, ".gitattributes"
	, ".github/workflows/consumer-matrix.yml"
	, "src/adoption/test-profiles.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/native-consumer-budget-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/fin-entry-integration-source-history.mjs"
	, "tests/helpers/fin-entry-integration-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseFinContainerEvidenceCiUpdate = (source, update) => {
	assert.ok(finContainerEvidenceCiChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore the source before container evidence and CI integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFinContainerEvidenceCiSource = (path, source, expected) => {
	source = beforeHostedContainerInventorySource(path, source, expected);
	if(typeof source !== "string" || !finContainerEvidenceCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finContainerEvidenceCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinContainerEvidenceCiUpdate(source, update) : source;
};
