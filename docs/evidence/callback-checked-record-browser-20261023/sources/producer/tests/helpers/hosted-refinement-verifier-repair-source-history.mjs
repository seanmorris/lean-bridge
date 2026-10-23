/**
 * Reverse the hosted refinement validator and native-PHP verifier repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostedRefinementVerifierRepairHistoryPath
	= "docs/evidence/hosted-refinement-verifier-repair-source-history-20261022.json";
export const hostedRefinementVerifierRepairPredecessor
	= "2beba112ca77cefc934a60d93ad8b5716defb4bb";
export const hostedRefinementVerifierRepairImplementation
	= "ee21e4a0c529cfb6de1ecaad9be1566456d11f7e";
export const hostedRefinementVerifierRepairIntegrationBase
	= "ee21e4a0c529cfb6de1ecaad9be1566456d11f7e";
export const hostedRefinementVerifierRepairChangedPaths = Object.freeze([
	"src/build/component-recursive-lean.mjs"
	, "src/build/component-refinements.mjs"
	, "tests/helpers/dependent-checked-record-php-ci-report.mjs"
	, "tests/helpers/dependent-checked-record-php-fixture-tests.mjs"
	, "tests/helpers/dependent-checked-record-php-fixture.mjs"
	, "tests/native-graph-model.test.mjs"
	, "tests/php-wasm-recursive-callable-contract.test.mjs"
]);
export const hostedRefinementVerifierRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostedRefinementVerifierRepairHistoryPath, "utf8"));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseHostedRefinementVerifierRepairUpdate = (source, update) => {
	assert.ok([...hostedRefinementVerifierRepairChangedPaths
		, ...hostedRefinementVerifierRepairIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact hosted refinement/verifier repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostedRefinementVerifierRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...hostedRefinementVerifierRepairChangedPaths
			, ...hostedRefinementVerifierRepairIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.updates, ...value.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseHostedRefinementVerifierRepairUpdate(source, update)
		: source;
};
