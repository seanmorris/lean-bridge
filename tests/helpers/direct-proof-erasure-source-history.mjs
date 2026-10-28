/**
 * Preserve the exact direct proof-erasure implementation and registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureHistoryPath
	= "docs/evidence/direct-proof-erasure-source-history-20261028.json";
export const directProofErasurePredecessor
	= "60b90ab5cfea41edd033ba70163614cd053dfff5";
export const directProofErasureImplementation
	= "f195e8dece1a00d68fea3647ec6046c1bc5ee8ed";
export const directProofErasureChangedPaths = Object.freeze([
	"schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "tests/compiler-adapters.test.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/reviewed-semantic-decisions-tests.mjs"
	, "tests/reviewed-owned-source.test.mjs"
]);
export const directProofErasureIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureNormalizationPaths = Object.freeze([
	...directProofErasureChangedPaths
	, ...directProofErasureIntegrationPaths
]);
export const directProofErasureAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated direct proof-erasure transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasureUpdate = (source, update) => {
	assert.ok(directProofErasureNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove recognized direct proof-erasure transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !directProofErasureNormalizationPaths.includes(path)) return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureUpdate(current, update);
	}
	return current;
};
