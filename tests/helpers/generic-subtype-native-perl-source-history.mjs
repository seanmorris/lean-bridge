/**
 * Reverse the authenticated generic-Subtype native/Perl transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeNativePerlHistoryPath
	= "docs/evidence/generic-subtype-native-perl-source-history-20261021.json";
export const genericSubtypeNativePerlPredecessor
	= "dc42dd6383b051f65155bb1c9f99b233c056b92c";
export const genericSubtypeNativePerlImplementation
	= "8368b2c2a9f587d617c1da90731ed99347bc52b8";
export const genericSubtypeNativePerlChangedPaths = Object.freeze([
	"tests/helpers/nominal-subtype-native-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-install.mjs"
	, "tests/helpers/nominal-subtype-perl-installed-tests.mjs"
]);
export const genericSubtypeNativePerlIntegrationPaths = Object.freeze([
	"tests/generic-subtype-native-perl.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypeNativePerlImplementationAdditions = Object.freeze([
	".github/workflows/generic-subtype-native-perl.yml"
	, "scripts/check-generic-subtype-native-perl-ci.mjs"
	, "scripts/run-generic-subtype-native-ci.sh"
	, "scripts/run-generic-subtype-perl-ci.sh"
	, "tests/fixtures/generic-subtype-consumers/c.c"
	, "tests/fixtures/generic-subtype-consumers/cpp.cpp"
	, "tests/fixtures/generic-subtype-consumers/perl.pl"
	, "tests/generic-subtype-native-perl.test.mjs"
	, "tests/helpers/generic-subtype-native-perl-report.mjs"
	, "tests/helpers/generic-subtype-native-perl-tests.mjs"
	, "tests/helpers/generic-subtype-native-perl.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeNativePerlHistoryPath, "utf8"));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeNativePerlUpdate = (source, update) => {
	assert.ok([...genericSubtypeNativePerlChangedPaths
		, ...genericSubtypeNativePerlIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this exact generic-Subtype native/Perl transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeNativePerlSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| ![...genericSubtypeNativePerlChangedPaths
			, ...genericSubtypeNativePerlIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseGenericSubtypeNativePerlUpdate(source, update) : source;
};
