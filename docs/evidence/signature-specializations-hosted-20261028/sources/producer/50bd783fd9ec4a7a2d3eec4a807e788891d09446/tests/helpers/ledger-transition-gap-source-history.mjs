/**
 * Close the omitted history-hub transitions of `src/release/cpan-package.mjs`,
 * which later layers changed without recording the transition, so every older
 * milestone reader can reach its digest again. Nothing historical is
 * rewritten: each omitted transition is reconstructed from exact Git blobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ledgerTransitionGapHistoryPath
	= "docs/evidence/ledger-transition-gap-source-history-20261021.json";
export const ledgerTransitionGapPredecessor
	= "736ce9d03fc324ed6004aa77de534cd9885bfa83";
export const ledgerTransitionGapChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
]);
export const ledgerTransitionGapHistoricalPaths = Object.freeze([
	"src/release/cpan-package.mjs"
]);
/**
 * Newest commit per path whose blob the other ledgers still reach; every newer
 * blob pair is an omitted transition this repair records.
 */
export const ledgerTransitionGapAnchors = Object.freeze({
	"src/release/cpan-package.mjs": "70989c90670341d1dd2a82da0423fb3230356496"
});
/** Oldest milestone digest every hosted history reader must reach again. */
export const ledgerTransitionGapTargets = Object.freeze({
	"src/release/cpan-package.mjs":
		"304934221a88450709aab2a49d189444215fa4119e0f8473cb5f13c68cd149f9"
});
export const ledgerTransitionGapAddedPaths = Object.freeze([
	"scripts/update-ledger-transition-gap-source-history.mjs"
	, "tests/helpers/ledger-transition-gap-source-history-tests.mjs"
	, "tests/helpers/ledger-transition-gap-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	ledgerTransitionGapHistoryPath, "utf8"
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
export const reverseLedgerTransitionGapUpdate = (source, update) =>
	reverse(source, update, ledgerTransitionGapChangedPaths);

/**
 * Reverse one omitted historical transition.
 *
 * @param source - Complete later source text.
 * @param update - Authenticated historical transition to reverse.
 */
export const reverseLedgerTransitionGapHistoricalUpdate = (source, update) =>
	reverse(source, update, ledgerTransitionGapHistoricalPaths);

/**
 * Reconstruct a source before this repair, stopping exactly at a requested
 * digest. Omitted history deliberately walks every contiguous recorded state.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact digest at which reconstruction stops.
 */
export const beforeLedgerTransitionGapSource = (path, source, expected) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(ledgerTransitionGapChangedPaths.includes(path))
	{
		const update = record().updates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseLedgerTransitionGapUpdate(source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!ledgerTransitionGapHistoricalPaths.includes(path)) return source;
	while(true)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest
		);
		if(!update) return source;
		source = reverseLedgerTransitionGapHistoricalUpdate(source, update);
		digest = sha256(source);
		if(digest === expected) return source;
	}
};
