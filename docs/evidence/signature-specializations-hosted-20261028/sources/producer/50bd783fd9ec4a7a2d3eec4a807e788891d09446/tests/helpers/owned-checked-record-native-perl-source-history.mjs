/**
 * Reverse the authenticated native/Perl owned checked-record qualification layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordNativePerlHistoryPath
	= "docs/evidence/owned-checked-record-native-perl-source-history-20261022.json";
export const ownedCheckedRecordNativePerlEvidencePath
	= "docs/evidence/owned-checked-record-native-perl-local-qualification-20261022.json";
export const ownedCheckedRecordNativePerlPredecessor
	= "c5d31ebc5f4be54fac89f9a56b707f8e523882ef";
export const ownedCheckedRecordNativePerlImplementation
	= "162f6aafa07f6f3221e67079a9f92f2b874d1f6a";
export const ownedCheckedRecordNativePerlImplementationPaths = Object.freeze([
	".github/workflows/owned-checked-record-native-perl.yml"
	, "package.json"
	, "scripts/run-nominal-subtype-entry-native-ci.sh"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/build/owned-refinement-carriers.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-installed.c"
	, "tests/fixtures/structured-types/owned-checked-record-installed.cpp"
	, "tests/fixtures/structured-types/owned-checked-record-installed.pl"
	, "tests/fixtures/structured-types/owned-checked-record-result-only.c"
	, "tests/fixtures/structured-types/owned-checked-record-result-only.cpp"
	, "tests/fixtures/structured-types/owned-checked-record-result-only.pl"
	, "tests/fixtures/structured-types/owned-perl-installed-assets.pl"
	, "tests/helpers/nominal-subtype-entry-native-ci-tests.mjs"
	, "tests/helpers/owned-checked-record-native-fixture.mjs"
	, "tests/helpers/owned-perl-installed-assets.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/owned-checked-record-native-packaging.test.mjs"
	, "tests/owned-checked-record-perl-packaging.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordNativePerlModifiedPaths = Object.freeze([
	"package.json"
	, "scripts/run-nominal-subtype-entry-native-ci.sh"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/build/owned-refinement-carriers.mjs"
	, "tests/fixtures/structured-types/owned-perl-installed-assets.pl"
	, "tests/helpers/nominal-subtype-entry-native-ci-tests.mjs"
	, "tests/helpers/owned-perl-installed-assets.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const ownedCheckedRecordNativePerlRegistrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const ownedCheckedRecordNativePerlChangedPaths = Object.freeze([
	...ownedCheckedRecordNativePerlRegistrationPaths
	, ...ownedCheckedRecordNativePerlModifiedPaths
]);
export const ownedCheckedRecordNativePerlAddedPaths = Object.freeze([
	".github/workflows/owned-checked-record-native-perl.yml"
	, ownedCheckedRecordNativePerlEvidencePath
	, "docs/evidence/owned-checked-record-native-perl-local-qualification-20261022.md"
	, "scripts/update-owned-checked-record-native-perl-source-history.mjs"
	, "tests/fixtures/structured-types/owned-checked-record-installed.c"
	, "tests/fixtures/structured-types/owned-checked-record-installed.cpp"
	, "tests/fixtures/structured-types/owned-checked-record-installed.pl"
	, "tests/fixtures/structured-types/owned-checked-record-result-only.c"
	, "tests/fixtures/structured-types/owned-checked-record-result-only.cpp"
	, "tests/fixtures/structured-types/owned-checked-record-result-only.pl"
	, "tests/helpers/owned-checked-record-native-fixture.mjs"
	, "tests/helpers/owned-checked-record-native-perl-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-native-perl-source-history.mjs"
	, "tests/owned-checked-record-native-packaging.test.mjs"
	, "tests/owned-checked-record-perl-packaging.test.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordNativePerlHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Complete current source text.
 * @param update - Recorded exact update.
 */
export const reverseOwnedCheckedRecordNativePerlUpdate = (source, update) => {
	assert.ok(ownedCheckedRecordNativePerlChangedPaths.includes(update.path));
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
 * Remove only the exact native/Perl owned checked-record qualification layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordNativePerlSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordNativePerlChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseOwnedCheckedRecordNativePerlUpdate(source, update)
		: source;
};
