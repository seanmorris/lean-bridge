/**
 * Close the omitted history-hub transitions for ledgered sources that later
 * layers changed without recording: the Fin refinement hub and two Core
 * registration tests edited by sealing commits whose records carry no
 * integration updates, and the owned Subtype fixtures changed by an unsealed
 * implementation commit, so every older milestone reader can reach its digest
 * again; the five owned Subtype readers now read their recorded milestones
 * through the hub instead of comparing live text against pins. Nothing
 * historical is rewritten: each omitted transition is reconstructed from exact
 * Git blobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hubTransitionGapHistoryPath
	= "docs/evidence/hub-transition-gap-source-history-20261021.json";
export const hubTransitionGapPredecessor
	= "c2b8a0db192646b3a5b8271b55a47b4f0a468ec0";
export const hubTransitionGapChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
	, "tests/helpers/owned-refinement-carriers-source-history-tests.mjs"
	, "tests/helpers/owned-refinement-model-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-analysis-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-javascript-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-javascript-transfer-source-history-tests.mjs"
	, "tests/owned-subtype-host-registration-history.test.mjs"
]);
export const hubTransitionGapHistoricalPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/fixtures/onboarding/owned-subtypes/Owned.lean"
	, "tests/helpers/owned-aggregate-fixture.mjs"
]);
/**
 * Newest commit per path whose blob the other ledgers still reach; every newer
 * blob pair is an omitted transition this repair records.
 */
export const hubTransitionGapAnchors = Object.freeze({
	"tests/helpers/fin-refinement-source-history.mjs":
		"8722c9ee9b25257ea132ed1be7310a833ede9893"
	, "tests/native-subtype.test.mjs":
		"66639ddbe17be8d1d5264725c1e2816972a649ba"
	, "tests/component-array-contract.test.mjs":
		"4d813e8a9da8f81d6801869c09e0e5302496c452"
	, "tests/fixtures/onboarding/owned-subtypes/Owned.lean":
		"c95b9ca0bcfcc5138cc50072a868dc37942291b4"
	, "tests/helpers/owned-aggregate-fixture.mjs":
		"c95b9ca0bcfcc5138cc50072a868dc37942291b4"
});
/** Oldest milestone digest every hosted history reader must reach again. */
export const hubTransitionGapTargets = Object.freeze({
	"tests/helpers/fin-refinement-source-history.mjs":
		"ad83e10a46a92d3b8a4848c12c22acd802dbc76063a48a6e38470b4cb7b32801"
	, "tests/native-subtype.test.mjs":
		"5ac492e72723c3a82e094038a6a1c80f521cc8b91dd0233612225b57d99a7517"
	, "tests/component-array-contract.test.mjs":
		"4d61bd7c8fbb65b5d4ea787079f3015e8a47cbc129f1d2cd62832642798827cb"
	, "tests/fixtures/onboarding/owned-subtypes/Owned.lean":
		"0ecd4a71a73c8ec8865bd42bd411cc01e0476e9bd945efb976a7487c7ed45815"
	, "tests/helpers/owned-aggregate-fixture.mjs":
		"73484c0ff94ec14917bfea2b8a795cada9b89abd03fe35c14bf24da65448911b"
});
export const hubTransitionGapAddedPaths = Object.freeze([
	"scripts/update-hub-transition-gap-source-history.mjs"
	, "tests/helpers/hub-transition-gap-source-history-tests.mjs"
	, "tests/helpers/hub-transition-gap-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	hubTransitionGapHistoryPath, "utf8"
));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse one current source transition in this repair.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition to reverse.
 */
export const reverseHubTransitionGapUpdate = (source, update) =>
	reverse(source, update, hubTransitionGapChangedPaths);

/**
 * Reverse one omitted historical transition.
 *
 * @param source - Complete later source text.
 * @param update - Authenticated historical transition to reverse.
 */
export const reverseHubTransitionGapHistoricalUpdate = (source, update) =>
	reverse(source, update, hubTransitionGapHistoricalPaths);

/**
 * Reconstruct a source before this repair, stopping exactly at a requested
 * digest. Omitted history deliberately walks every contiguous recorded state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact digest at which reconstruction stops.
 */
export const beforeHubTransitionGapSource = (path, source, expected) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(hubTransitionGapChangedPaths.includes(path))
	{
		const update = record().updates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseHubTransitionGapUpdate(source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!hubTransitionGapHistoricalPaths.includes(path)) return source;
	while(true)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest
		);
		if(!update) return source;
		source = reverseHubTransitionGapHistoricalUpdate(source, update);
		digest = sha256(source);
		if(digest === expected) return source;
	}
};
