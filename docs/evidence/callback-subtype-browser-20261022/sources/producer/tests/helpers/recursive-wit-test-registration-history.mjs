/**
 * Authenticate the closed registration of recursive checked-record WIT test
 * entrypoints after their source-only harness joined the integration branch.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveWitTestRegistrationHistoryPath
	= "docs/evidence/recursive-wit-test-registration-source-history-20261017.json";
export const recursiveWitTestRegistrationPredecessor
	= "35f930b30c7c0e1c9ac458cab5ec9743b66bd5ef";
export const recursiveWitTestRegistrationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/component-refinement-mirror-history.mjs"
	, "tests/helpers/browser-callback-archive-source-history-tests.mjs"
	, "tests/helpers/checked-record-browser-archive-history-tests.mjs"
	, "tests/helpers/checked-record-browser-ci-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-archive-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-ci-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-history-tests.mjs"
	, "tests/helpers/jvm-container-entry-exit-history-tests.mjs"
	, "tests/helpers/native-fin-nix-comparison-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-registration-history-tests.mjs"
	, "tests/helpers/perl-container-subtype-ci-history-tests.mjs"
	, "tests/helpers/php-wasm-failure-diagnostics-history-tests.mjs"
	, "tests/helpers/checked-record-host-ci-history-tests.mjs"
	, "tests/helpers/checked-record-native-host-history-tests.mjs"
	, "tests/helpers/checked-record-native-installed-history-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-history-tests.mjs"
	, "tests/helpers/checked-record-perl-history-tests.mjs"
	, "tests/helpers/checked-record-perl-installed-history-tests.mjs"
	, "tests/helpers/checked-record-python-history-tests.mjs"
	, "tests/helpers/checked-record-remaining-hosts-history-tests.mjs"
	, "tests/helpers/checked-record-ruby-jvm-history-tests.mjs"
	, "tests/helpers/core-quality-budget-history-tests.mjs"
	, "tests/helpers/fin-alias-closure-history-tests.mjs"
	, "tests/helpers/fin-container-edge-ci-history-tests.mjs"
	, "tests/helpers/fin-container-foreign-history-tests.mjs"
	, "tests/helpers/fin-dotnet-sdk-history-tests.mjs"
	, "tests/helpers/fin-jvm-diagnostics-history-tests.mjs"
	, "tests/helpers/fin-nominal-refusal-history-tests.mjs"
	, "tests/helpers/fin-record-review-omission-history-tests.mjs"
	, "tests/helpers/fin-record-zero-ci-history-tests.mjs"
	, "tests/helpers/maven-prerequisite-history-tests.mjs"
	, "tests/helpers/native-fin-diagnostic-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-history-tests.mjs"
	, "tests/helpers/refinement-core-ci-history-tests.mjs"
	, "tests/helpers/refinement-followup-history-tests.mjs"
	, "tests/helpers/reviewed-perl-diagnostic-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-record-history-tests.mjs"
	, "tests/helpers/structural-subtype-ci-foundation-history-tests.mjs"
	, "tests/helpers/jvm-pending-exit-history-tests.mjs"
	, "tests/helpers/subtype-fixture-link-source-history-tests.mjs"
	, "tests/late-checked-record-test-registration-history.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	recursiveWitTestRegistrationHistoryPath, "utf8"
));

/**
 * Reverse one complete authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseRecursiveWitTestRegistrationUpdate = (source, update) => {
	assert.ok(recursiveWitTestRegistrationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(replacement.current, replacement.previous);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact registration layer and preserve unknown source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization should stop.
 */
export const beforeRecursiveWitTestRegistrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveWitTestRegistrationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseRecursiveWitTestRegistrationUpdate(source, update) : source;
};
