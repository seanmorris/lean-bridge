/**
 * Authenticate the installed native callback-Fin repair without rewriting the
 * earlier admission, workflow or browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinInstalledRepairHistoryPath
	= "docs/evidence/callback-fin-installed-repair-source-history-20261028.json";
export const callbackFinInstalledRepairPredecessor
	= "4ac86a9e06c55c1e2f9e9112512008532706dbd1";
export const callbackFinInstalledRepairImplementation
	= "40232c74a0af9ab0c4057a2d386a5981e8e25ca4";
export const callbackFinInstalledRepairChangedPaths = Object.freeze([
	"src/backends/jvm/copied-model.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/backends/wit/copied-model.mjs"
	, "tests/callback-fin-language-installed.test.mjs"
	, "tests/callback-fin-language-package.test.mjs"
	, "tests/callback-fin-remaining-package.test.mjs"
	, "tests/fixtures/callback-fin-consumers/dotnet.cs"
	, "tests/fixtures/callback-fin-consumers/java.java"
	, "tests/fixtures/callback-fin-consumers/kotlin.kt"
	, "tests/fixtures/callback-fin-consumers/php-native.php"
	, "tests/fixtures/callback-fin-consumers/python.py"
	, "tests/fixtures/callback-fin-consumers/ruby.rb"
	, "tests/fixtures/callback-fin-consumers/rust.rs"
	, "tests/fixtures/callback-fin-consumers/wit-wasi.c"
	, "tests/helpers/callback-fin-language-ci.mjs"
]);
export const callbackFinInstalledRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-07.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinInstalledRepairNormalizationPaths = Object.freeze([
	...callbackFinInstalledRepairChangedPaths
	, ...callbackFinInstalledRepairIntegrationPaths
].toSorted());
export const callbackFinInstalledRepairImplementationAddedPaths = Object.freeze([
	"tests/callback-fin-perl-package.test.mjs"
]);
export const callbackFinInstalledRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-callback-fin-installed-repair-source-history.mjs"
	, "tests/helpers/callback-fin-installed-repair-source-history-tests.mjs"
	, "tests/helpers/callback-fin-installed-repair-source-history.mjs"
]);
export const callbackFinInstalledRepairAddedPaths = Object.freeze([
	...callbackFinInstalledRepairImplementationAddedPaths
	, ...callbackFinInstalledRepairHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinInstalledRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinInstalledRepairUpdate = (source, update) => {
	assert.ok(callbackFinInstalledRepairNormalizationPaths.includes(update.path));
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
 * Remove only the exact installed callback-Fin repair transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCallbackFinInstalledRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackFinInstalledRepairNormalizationPaths.includes(path))
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
		current = reverseCallbackFinInstalledRepairUpdate(current, update);
	}
	return current;
};
