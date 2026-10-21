/**
 * Reverse the authenticated zero-payload npm adapter foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadNpmFoundationHistoryPath
	= "docs/evidence/zero-payload-npm-foundation-source-history-20261021.json";
export const zeroPayloadNpmFoundationPredecessor
	= "a9968c5e1b0710091880409280d8047ce001fc4f";
export const zeroPayloadNpmFoundationImplementation
	= "7794d931167ff3c7f8a809774c930a10dc31d751";
export const zeroPayloadNpmFoundationChangedPaths = Object.freeze([
	"src/abi/component-recursive.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/build/compiler-adapters.mjs"
]);
export const zeroPayloadNpmFoundationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadNpmFoundationHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadNpmFoundationUpdate = (source, update) => {
	assert.ok([...zeroPayloadNpmFoundationChangedPaths
		, ...zeroPayloadNpmFoundationIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload npm foundation.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadNpmFoundationSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadNpmFoundationChangedPaths
		, ...zeroPayloadNpmFoundationIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadNpmFoundationUpdate(source, update)
		: source;
};
