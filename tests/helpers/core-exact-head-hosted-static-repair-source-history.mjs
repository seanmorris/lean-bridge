/**
 * Preserve the exact-head hosted Core static-check repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreExactHeadHostedStaticRepairHistoryPath
	= "docs/evidence/core-exact-head-hosted-static-repair-source-history-20261027.json";
export const coreExactHeadHostedStaticRepairPredecessor
	= "4ad2aeffa59f1a5f20405280de0bbb7fe9eb49b1";
export const coreExactHeadHostedStaticRepairImplementation
	= "413e5d64c097cc58849b2cffe69d77f4225566ac";
export const coreExactHeadHostedStaticRepairImplementationPaths
	= Object.freeze([
		"scripts/update-core-exact-head-hosted-replay-repair-source-history.mjs"
		, "tests/helpers/core-exact-head-hosted-replay-repair-source-history.mjs"
		, "tests/helpers/nominal-primitive-subtype-jvm-promotion-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-native-promotion-tests.mjs"
	]);
export const coreExactHeadHostedStaticRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreExactHeadHostedStaticRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-core-exact-head-hosted-static-repair-source-history.mjs"
		, "tests/helpers/core-exact-head-hosted-static-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${coreExactHeadHostedStaticRepairHistoryPath}`
		, import.meta.url), "utf8"
));

/** List every reversible source in this transition. */
export const coreExactHeadHostedStaticRepairNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	coreExactHeadHostedStaticRepairImplementationPaths.includes(path)
	|| coreExactHeadHostedStaticRepairIntegrationPaths.includes(path);

/**
 * Restore one authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreExactHeadHostedStaticRepairUpdate = (
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
 * Remove only the authenticated static-check repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreExactHeadHostedStaticRepairSource = (
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
		current = reverseCoreExactHeadHostedStaticRepairUpdate(current, update);
	}
	return current;
};
