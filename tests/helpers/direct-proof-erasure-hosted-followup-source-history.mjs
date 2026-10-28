/**
 * Preserve the reviewed-Subtype and WIT replay repairs found by hosted CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureHostedFollowupHistoryPath
	= "docs/evidence/direct-proof-erasure-hosted-followup-source-history-20261028.json";
export const directProofErasureHostedFollowupPredecessor
	= "859466ef8fe078f7349bdfaa2704aed3802ecf92";
export const directProofErasureHostedFollowupImplementation
	= "8b9c42c2bd5d6c0c1025be3f454cc9357aaad427";
export const directProofErasureHostedFollowupCommits = Object.freeze([
	directProofErasureHostedFollowupImplementation
]);
export const directProofErasureHostedFollowupImplementationPaths
	= Object.freeze([
		"tests/helpers/reviewed-subtype-build-tests.mjs"
		, "tests/helpers/reviewed-subtype-fixture.mjs"
		, "tests/helpers/wit-owned-callback-result-runtime-evidence.mjs"
		, "tests/wit-owned-callback-result-runtime-evidence.test.mjs"
	]);
export const directProofErasureHostedFollowupIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureHostedFollowupNormalizationPaths
	= Object.freeze([
		...directProofErasureHostedFollowupImplementationPaths
		, ...directProofErasureHostedFollowupIntegrationPaths
	]);
export const directProofErasureHostedFollowupAddedPaths
	= Object.freeze([
		"scripts/update-direct-proof-erasure-hosted-followup-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-hosted-followup-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-hosted-followup-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureHostedFollowupHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated hosted follow-up transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and current-side edits.
 */
export const reverseDirectProofErasureHostedFollowupUpdate
	= (source, update) => {
		assert.ok(directProofErasureHostedFollowupNormalizationPaths
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
 * Remove only this repair and its newest-first central registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureHostedFollowupSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !directProofErasureHostedFollowupNormalizationPaths
				.includes(path)) return source;
		const value = record();
		const updates = [...value.integrationUpdates, ...value.updates];
		let current = source;
		for(let count = 0; count < updates.length; ++count)
		{
			const digest = sha256(current);
			if(digest === expected) return current;
			const update = updates.find(item =>
				item.path === path && item.currentSha256 === digest);
			if(update === undefined) return current;
			current = reverseDirectProofErasureHostedFollowupUpdate(
				current, update);
		}
		return current;
	};
