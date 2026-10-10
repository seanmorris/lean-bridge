/**
 * Authenticate the CI archive-reader repair without changing historical execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinEdgeIntegrationSource } from "./fin-container-edge-integration-history.mjs";

export const finDiagnosticCiHistoryPath = "docs/evidence/native-fin-diagnostic-ci-source-history-20261010.json";
export const finDiagnosticCiPredecessor = "4007e0d1926a0a2206e8b49c26f82b474aca0c0f";
export const finDiagnosticCiChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/fin-container-entry-ci.test.mjs"
	, "tests/generic-record-array-rollout-history.test.mjs"
	, "tests/helpers/fin-container-edge-evidence.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/inherited-record-evidence.mjs"
	, "tests/helpers/native-fin-diagnostic-tests.mjs"
	, "tests/helpers/native-fin-nix-boundary-history.mjs"
	, "tests/helpers/native-fin-nix-boundary-tests.mjs"
	, "tests/helpers/python-refinement-evidence-tests.mjs"
	, "tests/helpers/reviewed-fin-host-evidence-tests.mjs"
	, "tests/perl-scalar-promotion.test.mjs"
];
let history;

/**
 * Reverse exact registered spans only when both complete source digests match.
 *
 * @param source - Complete source text.
 * @param update - Recorded transition.
 */
export const reverseFinDiagnosticCiUpdate = (source, update) => {
	assert.ok(finDiagnosticCiChangedPaths.includes(update.path));
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
 * Restore the predecessor, preserving exact requested stops and unregistered bytes.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeFinDiagnosticCiSource = (path, source, expected) => {
	source = beforeFinEdgeIntegrationSource(path, source, expected);
	if(typeof source !== "string" || !finDiagnosticCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finDiagnosticCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinDiagnosticCiUpdate(source, update) : source;
};
