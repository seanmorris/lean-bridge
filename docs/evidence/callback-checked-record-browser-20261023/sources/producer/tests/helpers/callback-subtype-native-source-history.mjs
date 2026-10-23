/**
 * Reverse the authenticated C/C++/Perl callback Subtype transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeNativeHistoryPath
	= "docs/evidence/callback-subtype-native-source-history-20261020.json";
export const callbackSubtypeNativePredecessor
	= "79da70e5dd123914f8243fce441cceca84e52ff7";
export const callbackSubtypeNativeImplementation
	= "a031522d08d2130cb0d54ae33c39d0525bf1ee0c";
export const callbackSubtypeNativeChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/perl.md"
	, "docs/contributing/testing.md"
	, "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
	, "docs/publish/cpan.md"
	, "src/backends/c/callable-graph-model.mjs"
	, "src/backends/c/callable-graph-package.mjs"
	, "src/backends/c/native-callable-graph-borrows.mjs"
	, "src/backends/c/native-callable-graph-calls.mjs"
	, "src/backends/cpp/callable-graph-package.mjs"
	, "src/backends/perl/callable-graph-model.mjs"
	, "src/backends/perl/callable-graph-package.mjs"
	, "src/backends/perl/callable-graph-xs.mjs"
	, "src/build/native-callable-graph.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/c-recursive-callable-package.test.mjs"
	, "tests/cpp-recursive-callable-package.test.mjs"
	, "tests/helpers/callback-subtype-fixture.mjs"
	, "tests/helpers/structured-callable-fixture.mjs"
	, "tests/fixtures/callback-subtype-consumers/types.mts"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/perl-recursive-callable-contract.test.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeNativeHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeNativeUpdate = (source, update) => {
	assert.ok(callbackSubtypeNativeChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact native callback Subtype transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeNativeSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackSubtypeNativeChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeNativeUpdate(source, update) : source;
};
