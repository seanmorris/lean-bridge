/**
 * Reverse the zero-payload ordinary installed-evidence expectation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadOrdinaryEvidenceExpectationHistoryPath
	= "docs/evidence/zero-payload-ordinary-evidence-expectation-source-history-20261021.json";
export const zeroPayloadOrdinaryEvidenceExpectationPredecessor
	= "cabf49560ab4849897cbebb2561611415f2a8eed";
export const zeroPayloadOrdinaryEvidenceExpectationImplementation
	= "f29a3a93bc046d285ae59c94b0d48af81cfca140";
export const zeroPayloadOrdinaryEvidenceExpectationChangedPaths = Object.freeze([
	"tests/type-surface.test.mjs"
]);
export const zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadOrdinaryEvidenceExpectationHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadOrdinaryEvidenceExpectationUpdate = (
	source, update
) => {
	assert.ok([...zeroPayloadOrdinaryEvidenceExpectationChangedPaths
		, ...zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact evidence-expectation repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadOrdinaryEvidenceExpectationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadOrdinaryEvidenceExpectationChangedPaths
			, ...zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadOrdinaryEvidenceExpectationUpdate(source, update)
		: source;
};
