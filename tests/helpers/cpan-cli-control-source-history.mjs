/**
 * Preserve exact source predecessors of the provenance-independent CPAN CLI-selection control (#1424).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePythonFinSource } from "./python-fin-source-history.mjs";

export const cpanCliControlHistoryPath = "docs/evidence/cpan-cli-control-source-history-20261006.json";
export const cpanCliControlChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/cli-package-config-history-tests.mjs"
	, "tests/helpers/cli-package-config-history.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-package-evidence-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCpanCliControlUpdate = (source, update) => {
	assert.ok(cpanCliControlChangedPaths.includes(update.path));
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
 * Restore the source before #1424, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCpanCliControlSource = (path, source, expected) => {
	source = beforePythonFinSource(path, source, expected);
	if(typeof source !== "string" || !cpanCliControlChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(cpanCliControlHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCpanCliControlUpdate(source, update) : source;
};
