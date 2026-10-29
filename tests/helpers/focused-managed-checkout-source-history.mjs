/**
 * Preserve the focused managed-lane sparse checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const focusedManagedCheckoutHistoryPath
	= "docs/evidence/focused-managed-checkout-source-history-20261029.json";
export const focusedManagedCheckoutPredecessor
	= "cd8b427a323d30ee10788042f80879f2a075fd83";
export const focusedManagedCheckoutImplementation
	= "479b508671da6f860155ec882adeef251b818ebd";
export const focusedManagedCheckoutImplementationPaths = Object.freeze([
	".github/workflows/generic-subtype-managed-wit.yml"
	, "tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"
	, "tests/helpers/host-null-complete-ci-tests.mjs"
]);
export const focusedManagedCheckoutIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const focusedManagedCheckoutHistoryAdditions = Object.freeze([
	"scripts/update-focused-managed-checkout-source-history.mjs"
	, "tests/helpers/focused-managed-checkout-source-history-tests.mjs"
	, "tests/helpers/focused-managed-checkout-source-history.mjs"
]);

const historyUrl = new URL(`../../${focusedManagedCheckoutHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const focusedManagedCheckoutNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: focusedManagedCheckoutImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])
].sort());
const allowed = path => focusedManagedCheckoutImplementationPaths.includes(path)
	|| focusedManagedCheckoutIntegrationPaths.includes(path);

/**
 * Reverse one authenticated focused managed-checkout transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseFocusedManagedCheckoutUpdate = (source, update) => {
	assert.ok(allowed(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only the authenticated focused managed-checkout repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeFocusedManagedCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !focusedManagedCheckoutNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseFocusedManagedCheckoutUpdate(current, update);
	}
	return current;
};
