/**
 * Preserve the Core recursive-callable evidence-pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRecursiveCallableEvidencePinRepairHistoryPath
	= "docs/evidence/core-recursive-callable-evidence-pin-repair-source-history-20261027.json";
export const coreRecursiveCallableEvidencePinRepairPredecessor
	= "94d2aaeff6b8f66f0b526075fe7646ded739d239";
export const coreRecursiveCallableEvidencePinRepairImplementation
	= "c0a9590da47e6463bc63b12465f2c2557a3c4ce2";
export const coreRecursiveCallableEvidencePinRepairImplementationPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const coreRecursiveCallableEvidencePinRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreRecursiveCallableEvidencePinRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-core-recursive-callable-evidence-pin-repair-source-history.mjs"
		, "tests/helpers/core-recursive-callable-evidence-pin-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreRecursiveCallableEvidencePinRepairHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every source whose current bytes participate in this transition. */
export const coreRecursiveCallableEvidencePinRepairNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreRecursiveCallableEvidencePinRepairImplementationPaths.includes(path)
	|| coreRecursiveCallableEvidencePinRepairIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreRecursiveCallableEvidencePinRepairUpdate = (
	source, update
) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
 * Remove only the authenticated recursive-callable evidence-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreRecursiveCallableEvidencePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreRecursiveCallableEvidencePinRepairUpdate(
			current, update);
	}
	return current;
};
