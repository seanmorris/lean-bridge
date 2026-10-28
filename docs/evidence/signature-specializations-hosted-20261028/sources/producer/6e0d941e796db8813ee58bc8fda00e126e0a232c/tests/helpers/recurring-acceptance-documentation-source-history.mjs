/**
 * Preserve the recurring acceptance documentation correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const recurringAcceptanceDocumentationHistoryPath
	= "docs/evidence/recurring-acceptance-documentation-source-history-20261027.json";
export const recurringAcceptanceDocumentationPredecessor
	= "e2995f3c80728e89711aabbca7df9db7608a5d6f";
export const recurringAcceptanceDocumentationImplementation
	= "51c4bc51132cdd1e41e5da71bdef5c75f51448c8";
export const recurringAcceptanceDocumentationImplementationPaths = Object.freeze([
	"docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
]);
export const recurringAcceptanceDocumentationIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const recurringAcceptanceDocumentationHistoryAdditions = Object.freeze([
	"scripts/update-recurring-acceptance-documentation-source-history.mjs"
	, "tests/helpers/recurring-acceptance-documentation-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${recurringAcceptanceDocumentationHistoryPath}`
		, import.meta.url), "utf8"
));

/**
 * List every source whose current bytes participate in this transition.
 */
export const recurringAcceptanceDocumentationNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	recurringAcceptanceDocumentationImplementationPaths.includes(path)
	|| recurringAcceptanceDocumentationIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseRecurringAcceptanceDocumentationUpdate = (source, update) => {
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
 * Remove only the authenticated recurring-acceptance documentation transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeRecurringAcceptanceDocumentationSource = (
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
		current = reverseRecurringAcceptanceDocumentationUpdate(current, update);
	}
	return current;
};
