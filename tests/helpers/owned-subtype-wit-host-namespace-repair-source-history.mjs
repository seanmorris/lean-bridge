/**
 * Reverse the exact owned-Subtype WIT consumer namespace repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeWitHostNamespaceRepairHistoryPath
	= "docs/evidence/owned-subtype-wit-host-namespace-repair-source-history-20261023.json";
export const ownedSubtypeWitHostNamespaceRepairPredecessor
	= "ea2ae7a4166358c1daffdf53026e3d247864ba95";
export const ownedSubtypeWitHostNamespaceRepairImplementation
	= "06c822a733b04480830cfea69df52d7063ad49fc";
export const ownedSubtypeWitHostNamespaceRepairImplementationPaths
	= Object.freeze([
		"tests/owned-subtype-remaining-packaging.test.mjs"
	]);
export const ownedSubtypeWitHostNamespaceRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const ownedSubtypeWitHostNamespaceRepairChangedPaths = Object.freeze([
	...ownedSubtypeWitHostNamespaceRepairImplementationPaths
	, ...ownedSubtypeWitHostNamespaceRepairIntegrationPaths
]);
export const ownedSubtypeWitHostNamespaceRepairAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-wit-host-namespace-repair-source-history.mjs"
	, "tests/helpers/owned-subtype-wit-host-namespace-repair-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-wit-host-namespace-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeWitHostNamespaceRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated source transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded source transition.
 */
export const reverseOwnedSubtypeWitHostNamespaceRepairUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeWitHostNamespaceRepairChangedPaths.includes(
		update.path));
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
 * Remove only the owned-Subtype WIT host namespace repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeOwnedSubtypeWitHostNamespaceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeWitHostNamespaceRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseOwnedSubtypeWitHostNamespaceRepairUpdate(source, update);
};
