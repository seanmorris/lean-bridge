/**
 * Preserve exact source predecessors of the Refinement CI repair (#1435).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforePythonRefinementEvidenceSource } from "./python-refinement-evidence-source-history.mjs";

export const refinementCiRepairHistoryPath = "docs/evidence/refinement-ci-repair-source-history-20261007.json";
export const refinementCiRepairChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/browser-refinements.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/browser-refinements-source-history-tests.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/cpan-cli-control-source-history-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/dotnet-fin-source-history-tests.mjs"
	, "tests/helpers/fin-distribution-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/host-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/jvm-fin-source-history-tests.mjs"
	, "tests/helpers/native-fin-containers-source-history-tests.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/native-specializations-source-history-tests.mjs"
	, "tests/helpers/native-subtype-source-history-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/perl-fin-source-history-tests.mjs"
	, "tests/helpers/perl-indexed-errors-source-history-tests.mjs"
	, "tests/helpers/perl-indexed-errors-source-history.mjs"
	, "tests/helpers/perl-refinements-source-history-tests.mjs"
	, "tests/helpers/php-fin-source-history-tests.mjs"
	, "tests/helpers/python-fin-source-history-tests.mjs"
	, "tests/helpers/refinement-audit-source-history-tests.mjs"
	, "tests/helpers/ruby-fin-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-rejection-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-wording-source-history-tests.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
	, "tests/helpers/wit-fin-source-history-tests.mjs"
	, "tests/rust-structured-callable-contract.test.mjs"
	, "tests/scalar-fin-rejection.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseRefinementCiRepairUpdate = (source, update) => {
	assert.ok(refinementCiRepairChangedPaths.includes(update.path));
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
 * Restore the source before #1435, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeRefinementCiRepairSource = (path, source, expected) => {
	source = beforePythonRefinementEvidenceSource(path, source, expected);
	if(typeof source !== "string" || !refinementCiRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(refinementCiRepairHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRefinementCiRepairUpdate(source, update) : source;
};
