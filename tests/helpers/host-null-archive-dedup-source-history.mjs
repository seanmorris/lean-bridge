/**
 * Preserve removal of redundant extracted HostNull archive members.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullArchiveDedupHistoryPath
	= "docs/evidence/host-null-archive-dedup-source-history-20261029.json";
export const hostNullArchiveDedupPredecessor
	= "38c32dd5bb1c957fad323fea5ecac95463adc4c7";
export const hostNullArchiveDedupImplementation
	= "22eebb37f00498a8f40d0346270240ecbddf9890";
export const hostNullArchiveDedupImplementationPaths = Object.freeze([
	"scripts/archive-host-null-complete-evidence.mjs"
	, "tests/helpers/host-null-complete-hosted-archive-tests.mjs"
	, "tests/helpers/host-null-complete-hosted-evidence.mjs"
]);
export const hostNullArchiveDedupIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullArchiveDedupHistoryAdditions = Object.freeze([
	"scripts/update-host-null-archive-dedup-source-history.mjs"
	, "tests/helpers/host-null-archive-dedup-source-history-tests.mjs"
	, "tests/helpers/host-null-archive-dedup-source-history.mjs"
]);
export const hostNullArchiveDedupNormalizationPaths
	= Object.freeze([...new Set([
		...hostNullArchiveDedupImplementationPaths
		, ...hostNullArchiveDedupIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullArchiveDedupHistoryPath, "utf8"
));

/**
 * Reverse one exact HostNull archive deduplication transition.
 *
 * @param source - Complete current source.
 * @param update - Path, digests and current-side edits.
 */
export const reverseHostNullArchiveDedupUpdate = (source, update) => {
	assert.ok(hostNullArchiveDedupNormalizationPaths.includes(update.path));
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
 * Remove the HostNull archive deduplication layer newest-first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullArchiveDedupSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !hostNullArchiveDedupNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullArchiveDedupUpdate(current, update);
	}
	return current;
};
