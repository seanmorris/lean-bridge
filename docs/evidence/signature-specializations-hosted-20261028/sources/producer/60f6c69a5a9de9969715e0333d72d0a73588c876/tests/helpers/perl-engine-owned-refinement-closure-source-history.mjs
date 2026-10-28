/**
 * Reverse the authenticated filtered-Perl-engine import-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlEngineOwnedRefinementClosureHistoryPath
	= "docs/evidence/perl-engine-owned-refinement-closure-source-history-20261021.json";
export const perlEngineOwnedRefinementClosurePredecessor
	= "b103cdc1751d57b0ae5621f43a25a11cec80e9e3";
export const perlEngineOwnedRefinementClosureImplementation
	= "ee6a6221e8decedafab1e3a95cb65745089892b6";
export const perlEngineOwnedRefinementClosureChangedPaths = Object.freeze([
	"nix/perl-engine-source-boundary.json"
]);
export const perlEngineOwnedRefinementClosureIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlEngineOwnedRefinementClosureHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePerlEngineOwnedRefinementClosureUpdate = (
	source, update
) => {
	assert.ok([...perlEngineOwnedRefinementClosureChangedPaths
		, ...perlEngineOwnedRefinementClosureIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact source-closure repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePerlEngineOwnedRefinementClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...perlEngineOwnedRefinementClosureChangedPaths
			, ...perlEngineOwnedRefinementClosureIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reversePerlEngineOwnedRefinementClosureUpdate(source, update)
		: source;
};
