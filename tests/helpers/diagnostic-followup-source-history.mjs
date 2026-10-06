/**
 * Preserve the exact predecessors of the locked-engine diagnostic and CLI lineage follow-up (#1419).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const diagnosticFollowupHistoryPath = "docs/evidence/diagnostic-followup-source-history-20261006.json";
export const diagnosticFollowupChangedPaths = [
	"docs/evidence/npm-fin-diagnostics-20261006.md"
	, "docs/type-surface.v1.json"
	, "src/build/component-engine-failure.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/component-engine-failure.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history.mjs"
	, "tests/helpers/owned-perl-callback-result-combined-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-package-evidence-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence-tests.mjs"
	, "tests/unlocked-component.test.mjs"
];
let history;

/**
 * Reverse exact spans only when both complete source identities agree.
 *
 * @param source - Complete current text.
 * @param update - Recorded transition.
 */
export const reverseDiagnosticFollowupUpdate = (source, update) => {
	assert.ok(diagnosticFollowupChangedPaths.includes(update.path));
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
 * Undo only the locked-engine diagnostic and CLI lineage follow-up (#1419) before following older refinement transitions.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDiagnosticFollowupSource = (path, source, expected) => {
	if(typeof source !== "string" || !diagnosticFollowupChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(diagnosticFollowupHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseDiagnosticFollowupUpdate(source, update) : source;
};
