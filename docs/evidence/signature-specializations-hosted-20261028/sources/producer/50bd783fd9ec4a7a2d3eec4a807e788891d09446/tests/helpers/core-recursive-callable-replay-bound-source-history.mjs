/**
 * Preserve the bounded recursive-callable evidence replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRecursiveCallableReplayBoundHistoryPath
	= "docs/evidence/core-recursive-callable-replay-bound-source-history-20261027.json";
export const coreRecursiveCallableReplayBoundPredecessor
	= "a897eab54811e622111a63ff5c85b30eb54544fa";
export const coreRecursiveCallableReplayBoundImplementation
	= "75f8eeb8389b22dcd0fa28bd13437c633eb59df2";
export const coreRecursiveCallableReplayBoundImplementationPaths
	= Object.freeze([
		"tests/dotnet-recursive-callable-evidence.test.mjs"
		, "tests/helpers/c-structured-callable-evidence.mjs"
		, "tests/helpers/closure-thread-evidence.mjs"
		, "tests/helpers/core-quality-budget-tests.mjs"
		, "tests/helpers/cpp-structured-callable-evidence.mjs"
		, "tests/helpers/dotnet-recursive-callable-evidence.mjs"
		, "tests/helpers/dotnet-structured-callable-evidence.mjs"
		, "tests/helpers/historical-type-surface-cells.mjs"
		, "tests/helpers/jvm-structured-callable-evidence.mjs"
		, "tests/helpers/native-recursive-callable-evidence.mjs"
		, "tests/helpers/npm-structured-callable-evidence.mjs"
		, "tests/helpers/perl-recursive-callable-evidence.mjs"
		, "tests/helpers/perl-structured-callable-evidence.mjs"
		, "tests/helpers/php-ci-regression-evidence.mjs"
		, "tests/helpers/php-structured-callable-evidence.mjs"
		, "tests/helpers/php-wasm-structured-callable-evidence.mjs"
		, "tests/helpers/python-recursive-callable-evidence.mjs"
		, "tests/helpers/python-structured-callable-evidence.mjs"
		, "tests/helpers/ruby-recursive-callable-evidence.mjs"
		, "tests/helpers/ruby-structured-callable-evidence.mjs"
		, "tests/helpers/rust-recursive-callable-evidence.mjs"
		, "tests/helpers/rust-structured-callable-evidence.mjs"
		, "tests/helpers/wit-composition-evidence.mjs"
		, "tests/helpers/wit-recursive-acceptance.mjs"
		, "tests/helpers/wit-structured-callable-evidence.mjs"
		, "tests/perl-recursive-callable-evidence.test.mjs"
		, "tests/python-recursive-callable-evidence.test.mjs"
		, "tests/ruby-recursive-callable-evidence.test.mjs"
		, "tests/rust-recursive-callable-evidence.test.mjs"
		, "tests/wit-composition-evidence.test.mjs"
	]);
export const coreRecursiveCallableReplayBoundIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreRecursiveCallableReplayBoundHistoryAdditions
	= Object.freeze([
		"scripts/update-core-recursive-callable-replay-bound-source-history.mjs"
		, "tests/helpers/core-recursive-callable-replay-bound-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreRecursiveCallableReplayBoundHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every source whose current bytes participate in this transition. */
export const coreRecursiveCallableReplayBoundNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreRecursiveCallableReplayBoundImplementationPaths.includes(path)
	|| coreRecursiveCallableReplayBoundIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreRecursiveCallableReplayBoundUpdate = (
	source, update
) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated recursive-callable replay transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreRecursiveCallableReplayBoundSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreRecursiveCallableReplayBoundUpdate(
			current, update);
	}
	return current;
};
