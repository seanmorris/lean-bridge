/**
 * Authenticate structural Subtype CI workflow evidence registration without rewriting earlier source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const structuralSubtypeCiWorkflowHistoryPath = "docs/evidence/structural-subtype-ci-workflow-source-history-20261011.json";
export const structuralSubtypeCiWorkflowPredecessor = "fb99ddabe63722eeda0da7a4e54c5b289c2edd7c";
export const structuralSubtypeCiWorkflowChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/helpers/checked-record-host-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-workflow-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-subtype-browser-report-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-workflow-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-workflow-tests.mjs"
	, "tests/helpers/scalar-fin-source-entry-run-tests.mjs"
	, "tests/helpers/structural-subtype-ci-foundation-history-tests.mjs"
	, "tests/helpers/structural-subtype-ci-foundation-history.mjs"
	, "tests/structural-subtype-installed.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseStructuralSubtypeCiWorkflowUpdate = (source, update) => {
	assert.ok(structuralSubtypeCiWorkflowChangedPaths.includes(update.path));
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
 * Preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeStructuralSubtypeCiWorkflowSource = (path, source, expected) => {
	if(typeof source !== "string" || !structuralSubtypeCiWorkflowChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(structuralSubtypeCiWorkflowHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseStructuralSubtypeCiWorkflowUpdate(source, update) : source;
};
