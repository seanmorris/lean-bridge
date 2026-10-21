/**
 * Reverse the authenticated .NET, JVM, native PHP and WIT callback Subtype
 * transition without rewriting older source-history records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeRemainingHistoryPath
	= "docs/evidence/callback-subtype-remaining-source-history-20261020.json";
export const callbackSubtypeRemainingPredecessor
	= "ef246c10f63b3929390ad7144d9fd4821ad266fa";
export const callbackSubtypeRemainingImplementation
	= "1e4e74095da9da447f6fffdd1f98e062eeb7e29a";
export const callbackSubtypeRemainingChangedPaths = Object.freeze([
	"docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "src/backends/dotnet/callable-graph-calls.mjs"
	, "src/backends/dotnet/callable-graph-model.mjs"
	, "src/backends/dotnet/callable-graph-package.mjs"
	, "src/backends/dotnet/callable-graph-runtime.mjs"
	, "src/backends/jvm/callable-graph-calls.mjs"
	, "src/backends/jvm/callable-graph-model.mjs"
	, "src/backends/jvm/callable-graph-package.mjs"
	, "src/backends/jvm/callable-graph-runtime.mjs"
	, "src/backends/jvm/copied-graph-assets.mjs"
	, "src/backends/php/callable-graph-calls.mjs"
	, "src/backends/php/callable-graph-model.mjs"
	, "src/backends/php/callable-graph-package.mjs"
	, "src/backends/php/callable-graph-runtime.mjs"
	, "src/backends/php/copied-names.mjs"
	, "src/backends/wit/callable-graph-host.mjs"
	, "src/backends/wit/callable-graph-package.mjs"
	, "src/backends/wit/callable-graph-session.mjs"
	, "src/backends/wit/callable-graph-typed.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/callback-subtype-language-source-history-tests.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/wit-recursive-callable-host.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeRemainingHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeRemainingUpdate = (source, update) => {
	assert.ok(callbackSubtypeRemainingChangedPaths.includes(update.path));
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
 * Remove only this exact remaining-host callback Subtype transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeRemainingSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackSubtypeRemainingChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeRemainingUpdate(source, update) : source;
};
