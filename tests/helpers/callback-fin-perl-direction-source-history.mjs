/**
 * Reverse the Perl callback converter direction repair: returned closures do
 * not reference host-only native wrapper symbols.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinPerlDirectionHistoryPath
	= "docs/evidence/callback-fin-perl-direction-source-history-20261028.json";
export const callbackFinPerlDirectionPredecessor
	= "d339d8c212794f4a398931a041e7bd92e682f8dd";
export const callbackFinPerlDirectionImplementation
	= "b4226db2d563b0ecdfdf8bdac0f3b40e081a7c89";
export const callbackFinPerlDirectionChangedPaths = Object.freeze([
	"src/backends/perl/generate.mjs"
	, "tests/callback-fin-perl-package.test.mjs"
]);
export const callbackFinPerlDirectionIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/callback-fin-host-repair-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinPerlDirectionNormalizationPaths = Object.freeze([
	...callbackFinPerlDirectionChangedPaths
	, ...callbackFinPerlDirectionIntegrationPaths
].toSorted());
export const callbackFinPerlDirectionAddedPaths = Object.freeze([
	"scripts/update-callback-fin-perl-direction-source-history.mjs"
	, "tests/helpers/callback-fin-perl-direction-source-history-tests.mjs"
	, "tests/helpers/callback-fin-perl-direction-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinPerlDirectionHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinPerlDirectionUpdate = (source, update) => {
	assert.ok(callbackFinPerlDirectionNormalizationPaths.includes(update.path));
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
 * Remove only the exact Perl callback direction repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackFinPerlDirectionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackFinPerlDirectionNormalizationPaths.includes(path))
		return source;
	const value = record(), updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCallbackFinPerlDirectionUpdate(current, update);
	}
	return current;
};
