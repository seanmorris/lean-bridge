/**
 * Reverse the authenticated generic-Subtype npm/browser transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeNpmBrowserHistoryPath
	= "docs/evidence/generic-subtype-npm-browser-source-history-20261021.json";
export const genericSubtypeNpmBrowserPredecessor
	= "09bbcdf19160e1d32f27a1e4dda9463654049378";
export const genericSubtypeNpmBrowserImplementation
	= "71c542f8460b05a066885abaa41c60c3e7e0112a";
export const genericSubtypeNpmBrowserHubBase
	= "c95b9ca0bcfcc5138cc50072a868dc37942291b4";
export const genericSubtypeNpmBrowserChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/nominal-subtype-caller-model.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture-tests.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
]);
export const genericSubtypeNpmBrowserIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypeNpmBrowserImplementationAdditions = Object.freeze([
	".github/workflows/generic-subtype-npm-browser.yml"
	, "tests/fixtures/generic-subtype-compositions/GenericCompositions.lean"
	, "tests/fixtures/generic-subtype-consumers/browser.mjs"
	, "tests/fixtures/generic-subtype-consumers/javascript.mjs"
	, "tests/fixtures/nominal-subtype-consumers/generic.mts"
	, "tests/generic-subtype-npm-browser.test.mjs"
	, "tests/helpers/generic-subtype-npm-browser-ci-tests.mjs"
	, "tests/helpers/generic-subtype-npm-browser.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeNpmBrowserHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeNpmBrowserUpdate = (source, update) => {
	assert.ok([...genericSubtypeNpmBrowserChangedPaths
		, ...genericSubtypeNpmBrowserIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact generic-Subtype npm/browser transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeGenericSubtypeNpmBrowserSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...genericSubtypeNpmBrowserChangedPaths
			, ...genericSubtypeNpmBrowserIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseGenericSubtypeNpmBrowserUpdate(source, update) : source;
};
