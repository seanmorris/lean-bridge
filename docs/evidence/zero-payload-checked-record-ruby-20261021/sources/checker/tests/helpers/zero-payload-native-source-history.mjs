/**
 * Reverse the authenticated zero-payload C/C++ package milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadNativeHistoryPath
	= "docs/evidence/zero-payload-native-source-history-20261021.json";
export const zeroPayloadNativePredecessor
	= "88d5b78cb7c77328231f0a89e7d31ab6432c00df";
export const zeroPayloadNativeImplementation
	= "15e9c40ccd8e42e1ebe8e2cdcf21049a92117a94";
export const zeroPayloadNativeChangedPaths = Object.freeze([
	"tests/zero-payload-checked-records.test.mjs"
]);
export const zeroPayloadNativeIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadNativeHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadNativeUpdate = (source, update) => {
	assert.ok([...zeroPayloadNativeChangedPaths
		, ...zeroPayloadNativeIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload native milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadNativeSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadNativeChangedPaths
		, ...zeroPayloadNativeIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadNativeUpdate(source, update)
		: source;
};
