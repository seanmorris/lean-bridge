/**
 * Reverse the authenticated Python, Ruby and Rust owned checked-record layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordLanguageHistoryPath
	= "docs/evidence/owned-checked-record-language-source-history-20261022.json";
export const ownedCheckedRecordLanguageEvidencePath
	= "docs/evidence/owned-checked-record-language-local-qualification-20261022.json";
export const ownedCheckedRecordLanguagePredecessor
	= "c45304fba9e85b562a30ad466a4aeea7f1a546fc";
export const ownedCheckedRecordLanguageImplementation
	= "a74c9476dcac286a4e0f9db5cf5283d36c9dc51e";
export const ownedCheckedRecordLanguageImplementationPaths = Object.freeze([
	".github/workflows/owned-checked-record-languages.yml"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/rust/owned-callables.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-python.py"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-python.py"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-ruby.rb"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-rust.rs"
	, "tests/fixtures/structured-types/owned-checked-record-ruby.rb"
	, "tests/fixtures/structured-types/owned-checked-record-rust.rs"
	, "tests/helpers/owned-checked-record-language-fixture.mjs"
	, "tests/owned-checked-record-language-packaging.test.mjs"
	, "tests/owned-rust-transfers.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordLanguageModifiedPaths = Object.freeze([
	"package.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/rust/owned-callables.mjs"
	, "tests/owned-rust-transfers.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordLanguageRegistrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
]);
export const ownedCheckedRecordLanguageChangedPaths = Object.freeze([
	...ownedCheckedRecordLanguageRegistrationPaths
	, ...ownedCheckedRecordLanguageModifiedPaths
]);
export const ownedCheckedRecordLanguageAddedPaths = Object.freeze([
	".github/workflows/owned-checked-record-languages.yml"
	, ownedCheckedRecordLanguageEvidencePath
	, "docs/evidence/owned-checked-record-language-local-qualification-20261022.md"
	, "scripts/update-owned-checked-record-language-source-history.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-python.py"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-python.py"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-ruby.rb"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-rust.rs"
	, "tests/fixtures/structured-types/owned-checked-record-ruby.rb"
	, "tests/fixtures/structured-types/owned-checked-record-rust.rs"
	, "tests/helpers/owned-checked-record-language-fixture.mjs"
	, "tests/helpers/owned-checked-record-language-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-language-source-history.mjs"
	, "tests/owned-checked-record-language-packaging.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordLanguageHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded exact update.
 */
export const reverseOwnedCheckedRecordLanguageUpdate = (source, update) => {
	assert.ok(ownedCheckedRecordLanguageChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact Python/Ruby/Rust owned checked-record layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordLanguageSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordLanguageChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseOwnedCheckedRecordLanguageUpdate(source, update)
		: source;
};
