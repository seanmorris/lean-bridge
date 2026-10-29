/**
 * Preserve atomic publication of the complete HostNull evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullArchiveTransactionHistoryPath
	= "docs/evidence/host-null-archive-transaction-source-history-20261029.json";
export const hostNullArchiveTransactionPredecessor
	= "d7ff55890b78ed542f87a6547fbd4f9fdf6d8e0a";
export const hostNullArchiveTransactionImplementation
	= "f3fbb035fe5cfa1ee1ac9196031a7ab8f33058ef";
export const hostNullArchiveTransactionImplementationPaths = Object.freeze([
	"scripts/archive-host-null-complete-evidence.mjs"
	, "tests/helpers/host-null-complete-hosted-archive-tests.mjs"
]);
export const hostNullArchiveTransactionIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullArchiveTransactionHistoryAdditions = Object.freeze([
	"scripts/update-host-null-archive-transaction-source-history.mjs"
	, "tests/helpers/host-null-archive-transaction-source-history-tests.mjs"
	, "tests/helpers/host-null-archive-transaction-source-history.mjs"
]);
export const hostNullArchiveTransactionNormalizationPaths
	= Object.freeze([...new Set([
		...hostNullArchiveTransactionImplementationPaths
		, ...hostNullArchiveTransactionIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullArchiveTransactionHistoryPath, "utf8"
));

/**
 * Reverse one exact HostNull archive transaction transition.
 *
 * @param source - Complete current source.
 * @param update - Path, digests and current-side edits.
 */
export const reverseHostNullArchiveTransactionUpdate = (source, update) => {
	assert.ok(hostNullArchiveTransactionNormalizationPaths.includes(update.path));
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
 * Remove the HostNull archive transaction layer newest-first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullArchiveTransactionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullArchiveTransactionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullArchiveTransactionUpdate(current, update);
	}
	return current;
};
