/**
 * Reverse the authenticated .NET, JVM, native PHP and WIT owned checked-record layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordManagedHistoryPath
	= "docs/evidence/owned-checked-record-managed-source-history-20261022.json";
export const ownedCheckedRecordManagedEvidencePath
	= "docs/evidence/owned-checked-record-managed-local-qualification-20261022.json";
export const ownedCheckedRecordManagedPredecessor
	= "d36bd5abf4303aab6dbdada4b33983ffc83c17cb";
export const ownedCheckedRecordManagedImplementation
	= "edee8e14ecdc7f0e2febab98b740d523940f28d7";
export const ownedCheckedRecordManagedImplementationPaths = Object.freeze([
	".github/workflows/owned-checked-record-managed.yml"
	, "package.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-dotnet.cs"
	, "tests/fixtures/structured-types/owned-checked-record-java.java"
	, "tests/fixtures/structured-types/owned-checked-record-kotlin.kt"
	, "tests/fixtures/structured-types/owned-checked-record-php.php"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-dotnet.cs"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-java.java"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-kotlin.kt"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-php.php"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/owned-checked-record-managed-fixture.mjs"
	, "tests/owned-checked-record-managed-packaging.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordManagedModifiedPaths = Object.freeze([
	"package.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordManagedRegistrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
]);
export const ownedCheckedRecordManagedChangedPaths = Object.freeze([
	...ownedCheckedRecordManagedRegistrationPaths
	, ...ownedCheckedRecordManagedModifiedPaths
]);
export const ownedCheckedRecordManagedAddedPaths = Object.freeze([
	".github/workflows/owned-checked-record-managed.yml"
	, ownedCheckedRecordManagedEvidencePath
	, "docs/evidence/owned-checked-record-managed-local-qualification-20261022.md"
	, "scripts/update-owned-checked-record-managed-source-history.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-dotnet.cs"
	, "tests/fixtures/structured-types/owned-checked-record-java.java"
	, "tests/fixtures/structured-types/owned-checked-record-kotlin.kt"
	, "tests/fixtures/structured-types/owned-checked-record-php.php"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-dotnet.cs"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-java.java"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-kotlin.kt"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-php.php"
	, "tests/helpers/owned-checked-record-managed-fixture.mjs"
	, "tests/helpers/owned-checked-record-managed-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-managed-source-history.mjs"
	, "tests/owned-checked-record-managed-packaging.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordManagedHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded exact update.
 */
export const reverseOwnedCheckedRecordManagedUpdate = (source, update) => {
	assert.ok(ownedCheckedRecordManagedChangedPaths.includes(update.path));
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
 * Remove only the exact managed/WIT owned checked-record layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordManagedSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordManagedChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseOwnedCheckedRecordManagedUpdate(source, update)
		: source;
};
