/**
 * Reverse the zero-payload JVM package foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadJvmHistoryPath
	= "docs/evidence/zero-payload-jvm-source-history-20261021.json";
export const zeroPayloadJvmPredecessor
	= "28ead008be53cf8d8ed53b6d5ee6afeb053c6514";
export const zeroPayloadJvmImplementation
	= "7f778e650ec308f8cca6c6fe9e6dcbfb864acd0b";
export const zeroPayloadJvmChangedPaths = Object.freeze([
	"tests/zero-payload-checked-record-jvm.test.mjs"
]);
export const zeroPayloadJvmIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadJvmHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and restore one exact source update.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadJvmUpdate = (source, update) => {
	assert.ok([...zeroPayloadJvmChangedPaths
		, ...zeroPayloadJvmIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload JVM milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadJvmSource = (path, source, expected) => {
	if(typeof source !== "string" || ![...zeroPayloadJvmChangedPaths
		, ...zeroPayloadJvmIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadJvmUpdate(source, update)
		: source;
};
