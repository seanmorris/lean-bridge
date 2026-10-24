/**
 * Reverse the explicit Borrow/receiver producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const borrowReceiverProducerRepairHistoryPath
	= "docs/evidence/borrow-receiver-producer-repair-source-history-20261024.json";
export const borrowReceiverProducerRepairPredecessor
	= "b46fac281e7f9154c05e7e1153ff771f1cbd9629";
export const borrowReceiverProducerRepairImplementation
	= "aa59633ee322d38dc924687e5fd4389be4a0bdba";
export const borrowReceiverProducerRepairIntegrationBase
	= "aa59633ee322d38dc924687e5fd4389be4a0bdba";
export const borrowReceiverProducerRepairCommits = Object.freeze([
	"335cbe5cc9e49dc9a2912a3005d6c8b3764d653f"
	, "8c6dfa31bb61d16306e1c000eafbd5889a235493"
	, "aa59633ee322d38dc924687e5fd4389be4a0bdba"
]);
export const borrowReceiverProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/managed-close-evidence.mjs"
	, "tests/helpers/owned-cpp-receiver-evidence.mjs"
	, "tests/helpers/owned-dotnet-receiver-evidence.mjs"
	, "tests/helpers/owned-dotnet-receiver-package-evidence.mjs"
	, "tests/helpers/owned-javascript-receiver-evidence.mjs"
	, "tests/helpers/owned-perl-borrow-evidence.mjs"
	, "tests/helpers/owned-perl-receiver-evidence.mjs"
	, "tests/helpers/owned-perl-receiver-package-evidence.mjs"
	, "tests/helpers/owned-php-receiver-evidence.mjs"
	, "tests/helpers/owned-php-receiver-package-evidence.mjs"
	, "tests/helpers/owned-php-wasm-borrow-evidence.mjs"
	, "tests/helpers/owned-php-wasm-receiver-evidence.mjs"
	, "tests/helpers/owned-php-wasm-transfer-evidence.mjs"
	, "tests/helpers/owned-ruby-borrow-evidence.mjs"
	, "tests/helpers/owned-ruby-transfer-evidence.mjs"
	, "tests/helpers/owned-rust-borrow-evidence.mjs"
	, "tests/owned-ruby-borrow-evidence.test.mjs"
]);
export const borrowReceiverProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const borrowReceiverProducerRepairNormalizationPaths = Object.freeze([
	...borrowReceiverProducerRepairChangedPaths
	, ...borrowReceiverProducerRepairIntegrationPaths
]);
export const borrowReceiverProducerRepairAddedPaths = Object.freeze([
	"scripts/update-borrow-receiver-producer-repair-source-history.mjs"
	, "tests/helpers/borrow-receiver-producer-repair-source-history-tests.mjs"
	, "tests/helpers/borrow-receiver-producer-repair-source-history.mjs"
	, "tests/helpers/borrow-receiver-producer-binding-tests.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	borrowReceiverProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseBorrowReceiverProducerRepairUpdate = (
	source, update
) => {
	assert.ok(borrowReceiverProducerRepairNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact Borrow/receiver producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeBorrowReceiverProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !borrowReceiverProducerRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseBorrowReceiverProducerRepairUpdate(current, update);
	}
	return current;
};
