/**
 * Preserve the Core documentation evidence-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreDocumentationEvidenceClosureRepairHistoryPath
	= "docs/evidence/core-documentation-evidence-closure-repair-source-history-20261027.json";
export const coreDocumentationEvidenceClosureRepairPredecessor
	= "c0d2f445ea9d3434362b856a6e7ab24679d10781";
export const coreDocumentationEvidenceClosureRepairImplementation
	= "efa447bc51d3953b3214b962bf7ac013d3e806e9";
export const coreDocumentationEvidenceClosureRepairImplementationPaths
	= Object.freeze([
		"scripts/core-contract-evidence.mjs"
		, "tests/component-consumer-docs.test.mjs"
		, "tests/helpers/core-contract-evidence-tests.mjs"
	]);
export const coreDocumentationEvidenceClosureRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreDocumentationEvidenceClosureRepairNormalizationPaths
	= Object.freeze([
		...coreDocumentationEvidenceClosureRepairImplementationPaths
		, ...coreDocumentationEvidenceClosureRepairIntegrationPaths
	]);
export const coreDocumentationEvidenceClosureRepairAddedPaths = Object.freeze([
	"scripts/update-core-documentation-evidence-closure-repair-source-history.mjs"
	, "tests/helpers/core-documentation-evidence-closure-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreDocumentationEvidenceClosureRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreDocumentationEvidenceClosureRepairUpdate = (
	source, update
) => {
	assert.ok(coreDocumentationEvidenceClosureRepairNormalizationPaths.includes(
		update.path
	));
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
 * Remove only the authenticated documentation evidence-closure repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreDocumentationEvidenceClosureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreDocumentationEvidenceClosureRepairNormalizationPaths.includes(path))
		return source;
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
		current = reverseCoreDocumentationEvidenceClosureRepairUpdate(
			current, update
		);
	}
	return current;
};
