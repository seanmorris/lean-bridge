/**
 * Preserve exact source predecessors of the Reviewed Subtype admission change (#1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCallbackCodeCiRepairSource } from "./callback-code-ci-repair-source-history.mjs";

export const reviewedSubtypeAdmissionHistoryPath = "docs/evidence/reviewed-subtype-admission-source-history-20261008.json";
export const reviewedSubtypeAdmissionChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/build/lean-component-compiler.mjs"
	, "src/build/native-model.mjs"
	, "tests/helpers/reviewed-fin-tests.mjs"
	, "tests/helpers/reviewed-semantic-decisions-tests.mjs"
	, "tests/helpers/reviewed-subtype-decisions-tests.mjs"
	, "tests/reviewed-source-build.test.mjs"
	, "tests/toolchain-preflight.test.mjs"
	, "docs/lean/existing-package.md"
	, "docs/evidence/refinement-closure-audit-20261007.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-callback-admission-source-history.mjs"
	, "tests/helpers/native-fin-callback-admission-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedSubtypeAdmissionUpdate = (source, update) => {
	assert.ok(reviewedSubtypeAdmissionChangedPaths.includes(update.path));
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
 * Restore the source before #1220, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeReviewedSubtypeAdmissionSource = (path, source, expected) => {
	source = beforeCallbackCodeCiRepairSource(path, source, expected);
	if(typeof source !== "string" || !reviewedSubtypeAdmissionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedSubtypeAdmissionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedSubtypeAdmissionUpdate(source, update) : source;
};
