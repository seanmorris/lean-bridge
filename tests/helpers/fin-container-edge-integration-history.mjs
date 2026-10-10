/**
 * Authenticate the native container observer integration without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finEdgeIntegrationHistoryPath = "docs/evidence/fin-container-edge-integration-source-history-20261010.json";
export const finEdgeIntegrationPredecessor = "e503ba7c40d2e32002028559b70f2dbcc94983fc";
export const finEdgeIntegrationBranch = "8287f60cc78a55f6e201a364656d8dc556411add";
export const finEdgeIntegrationChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/build/native-artifacts.mjs"
	, "tests/fin-container-edges.test.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-install.mjs"
	, "tests/helpers/fin-container-edges.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-diagnostic-ci-history.mjs"
	, "tests/helpers/native-fin-diagnostic-ci-tests.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseFinEdgeIntegrationUpdate = (source, update) => {
	assert.ok(finEdgeIntegrationChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeFinEdgeIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !finEdgeIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(finEdgeIntegrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseFinEdgeIntegrationUpdate(source, update) : source;
};
