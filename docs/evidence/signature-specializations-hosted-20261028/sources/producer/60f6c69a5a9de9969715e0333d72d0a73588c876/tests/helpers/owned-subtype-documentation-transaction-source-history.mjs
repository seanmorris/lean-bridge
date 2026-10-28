/**
 * Reverse the exact owned-Subtype documentation transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeDocumentationTransactionHistoryPath
	= "docs/evidence/owned-subtype-documentation-transaction-source-history-20261023.json";
export const ownedSubtypeDocumentationTransactionPredecessor
	= "c45d40dd29bb095587208f878003993c420a0258";
export const ownedSubtypeDocumentationTransactionImplementation
	= "55fd7fda672e0782c2ac71ca40af076952cc03ba";
export const ownedSubtypeConsumerDocumentationGatePredecessor
	= "34cfe11dbdf2764aa793e241ee93d9c9a1533b07";
export const ownedSubtypeConsumerDocumentationGateImplementation
	= "61bc1e0d998dbf467ddb1fc130159f7f6f1566bb";
export const ownedSubtypeConsumerDocumentationGatePaths = Object.freeze([
	"scripts/generate-type-docs.mjs"
	, "tests/owned-subtype-promotion.test.mjs"
]);
export const ownedSubtypeDocumentationTransactionModifiedPaths = Object.freeze([
	"scripts/promote-owned-subtype-evidence.mjs"
	, "tests/owned-subtype-promotion.test.mjs"
]);
export const ownedSubtypeDocumentationTransactionImplementationAdditions
	= Object.freeze([
		"tests/helpers/owned-subtype-documentation.mjs"
	]);
export const ownedSubtypeDocumentationTransactionImplementationPaths
	= Object.freeze([
		...ownedSubtypeDocumentationTransactionModifiedPaths
		, ...ownedSubtypeDocumentationTransactionImplementationAdditions
	]);
export const ownedSubtypeDocumentationTransactionIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const ownedSubtypeDocumentationTransactionChangedPaths = Object.freeze([
	...new Set([
		...ownedSubtypeConsumerDocumentationGatePaths
		, ...ownedSubtypeDocumentationTransactionModifiedPaths
	])
	, ...ownedSubtypeDocumentationTransactionIntegrationPaths
]);
export const ownedSubtypeDocumentationTransactionAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-documentation-transaction-source-history.mjs"
	, "tests/helpers/owned-subtype-documentation-transaction-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-documentation-transaction-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeDocumentationTransactionHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeDocumentationTransactionUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeDocumentationTransactionChangedPaths
		.includes(update.path));
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
 * Remove only the owned-Subtype documentation transaction layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedSubtypeDocumentationTransactionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeDocumentationTransactionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const updates = [
		...data.updates
		, ...data.gateUpdates
		, ...data.integrationUpdates
	];
	let text = source;
	let currentDigest = digest;
	while(currentDigest !== expected)
	{
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === currentDigest);
		if(!update) break;
		text = reverseOwnedSubtypeDocumentationTransactionUpdate(text, update);
		currentDigest = sha256(text);
	}
	return text;
};
