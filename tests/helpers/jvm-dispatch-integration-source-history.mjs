/**
 * Preserve exact predecessors when integrating the measured JVM Fin dispatch archive and host guidance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const jvmDispatchIntegrationHistoryPath = "docs/evidence/jvm-dispatch-integration-source-history-20261009.json";
export const jvmDispatchIntegrationPredecessor = "63ae7b175733d806c6bfaa829822ac7f0f756943";
export const jvmDispatchIntegrationChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/jvm-fin.test.mjs"
	, "docs/php.md"
	, "docs/consume/wit-wasi.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/lean/existing-package.md"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/perl-scalar-relocation-source-history.mjs"
	, "tests/helpers/perl-scalar-relocation-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseJvmDispatchIntegrationUpdate = (source, update) => {
	assert.ok(jvmDispatchIntegrationChangedPaths.includes(update.path));
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
 * Restore the pre-integration source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeJvmDispatchIntegrationSource = (path, source, expected) => {
	if(typeof source !== "string" || !jvmDispatchIntegrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(jvmDispatchIntegrationHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseJvmDispatchIntegrationUpdate(source, update) : source;
};
