/**
 * Preserve the exact .NET/Java/Kotlin direct proof-erasure package lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureManagedHistoryPath
	= "docs/evidence/direct-proof-erasure-managed-source-history-20261028.json";
export const directProofErasureManagedPredecessor
	= "19d2dcc50d5ba36cbf25478b459e01dca9f199d2";
export const directProofErasureManagedImplementation
	= "bef91328a598d5a01a1543e788547af7f5f278b5";
export const directProofErasureManagedChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
]);
export const directProofErasureManagedIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/proof-core-local-join-source-history-tests.mjs"
]);
export const directProofErasureManagedNormalizationPaths = Object.freeze([
	...directProofErasureManagedChangedPaths
	, ...directProofErasureManagedIntegrationPaths
]);
export const directProofErasureManagedImplementationAddedPaths = Object.freeze([
	"scripts/check-direct-proof-erasure-managed-ci.mjs"
	, "scripts/run-direct-proof-erasure-managed-ci.sh"
	, "tests/direct-proof-erasure-managed-installed.test.mjs"
	, "tests/fixtures/direct-proof-erasure-consumers/dotnet.cs"
	, "tests/fixtures/direct-proof-erasure-consumers/java.java"
	, "tests/fixtures/direct-proof-erasure-consumers/kotlin.kt"
	, "tests/helpers/direct-proof-erasure-managed-report.mjs"
	, "tests/helpers/direct-proof-erasure-managed-tests.mjs"
]);
export const directProofErasureManagedHistoryAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-managed-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-managed-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-managed-source-history.mjs"
]);
export const directProofErasureManagedAddedPaths = Object.freeze([
	...directProofErasureManagedImplementationAddedPaths
	, ...directProofErasureManagedHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureManagedHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated managed acceptance transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasureManagedUpdate = (source, update) => {
	assert.ok(directProofErasureManagedNormalizationPaths.includes(update.path));
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
 * Remove recognized managed-package transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureManagedSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureManagedNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureManagedUpdate(current, update);
	}
	return current;
};
