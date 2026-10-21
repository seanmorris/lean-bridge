/**
 * Reverse the zero-payload native retained-evidence milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadNativeEvidenceHistoryPath
	= "docs/evidence/zero-payload-native-evidence-source-history-20261021.json";
export const zeroPayloadNativeEvidencePredecessor
	= "05af12cf39dc3ebe95c499e8b386ce8d4db756b6";
export const zeroPayloadNativeEvidenceImplementation
	= "ac26590b1c4b10e2ea535d0a28899c88e1a4fd9d";
export const zeroPayloadNativeEvidenceChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs", "tests/test-profiles.test.mjs"
]);
export const zeroPayloadNativeEvidenceIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadNativeEvidenceHistoryPath, "utf8"));

/**
 * Authenticate and reverse one exact retained-evidence update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadNativeEvidenceUpdate = (source, update) => {
	assert.ok([...zeroPayloadNativeEvidenceChangedPaths
		, ...zeroPayloadNativeEvidenceIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this retained-evidence milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadNativeEvidenceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadNativeEvidenceChangedPaths
			, ...zeroPayloadNativeEvidenceIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadNativeEvidenceUpdate(source, update) : source;
};
