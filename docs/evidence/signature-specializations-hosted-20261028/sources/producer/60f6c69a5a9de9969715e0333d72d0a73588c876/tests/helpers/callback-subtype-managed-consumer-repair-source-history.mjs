/**
 * Reverse the managed callback Subtype consumer contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeManagedConsumerRepairHistoryPath
	= "docs/evidence/callback-subtype-managed-consumer-repair-source-history-20261022.json";
export const callbackSubtypeManagedConsumerRepairPredecessor
	= "1890afe06bc708f681db3f9c429f6551f6868437";
export const callbackSubtypeManagedConsumerRepairImplementation
	= "1fc7e424677bfb2a3fb5af7b839944fe9055f3e2";
export const callbackSubtypeManagedConsumerRepairImplementationPaths
	= Object.freeze([
		"tests/fixtures/callback-subtype-consumers/dotnet.cs"
		, "tests/fixtures/callback-subtype-consumers/java.java"
		, "tests/fixtures/callback-subtype-consumers/kotlin.kt"
	]);
export const callbackSubtypeManagedConsumerRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const callbackSubtypeManagedConsumerRepairChangedPaths = Object.freeze([
	...callbackSubtypeManagedConsumerRepairImplementationPaths
	, ...callbackSubtypeManagedConsumerRepairIntegrationPaths
]);
export const callbackSubtypeManagedConsumerRepairAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-managed-consumer-repair-source-history.mjs"
	, "tests/helpers/callback-subtype-managed-consumer-repair-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-managed-consumer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeManagedConsumerRepairHistoryPath, "utf8"));

/**
 * Restore one exact managed-consumer source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeManagedConsumerRepairUpdate
	= (source, update) => {
		assert.ok(callbackSubtypeManagedConsumerRepairChangedPaths.includes(
			update.path));
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
 * Remove only the exact managed callback Subtype consumer repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeManagedConsumerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeManagedConsumerRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypeManagedConsumerRepairUpdate(source, update)
		: source;
};
