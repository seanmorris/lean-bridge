/**
 * Reverse the exact Core Ruby-model availability repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRubyModelAvailabilityRepairHistoryPath
	= "docs/evidence/core-ruby-model-availability-repair-source-history-20261023.json";
export const coreRubyModelAvailabilityRepairPredecessor
	= "ef65333a8cb1e83681e919233bf4ef407bbf8b64";
export const coreRubyModelAvailabilityRepairImplementation
	= "0da25ff5e80db9e33afb96bef3b1ace976caaf6b";
export const coreRubyModelAvailabilityRepairChangedPaths = Object.freeze([
	"tests/helpers/zero-payload-checked-record-ruby-fixture-tests.mjs"
]);
export const coreRubyModelAvailabilityRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/zero-payload-checked-record-ruby.test.mjs"
]);
export const coreRubyModelAvailabilityRepairNormalizationPaths
	= Object.freeze([
		...coreRubyModelAvailabilityRepairChangedPaths
		, ...coreRubyModelAvailabilityRepairIntegrationPaths
	]);
export const coreRubyModelAvailabilityRepairAddedPaths = Object.freeze([
	"scripts/update-core-ruby-model-availability-repair-source-history.mjs"
	, "tests/helpers/core-ruby-model-availability-repair-source-history-tests.mjs"
	, "tests/helpers/core-ruby-model-availability-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreRubyModelAvailabilityRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCoreRubyModelAvailabilityRepairUpdate = (
	source, update
) => {
	assert.ok(coreRubyModelAvailabilityRepairNormalizationPaths
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
 * Remove only the exact Core Ruby-model availability repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreRubyModelAvailabilityRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreRubyModelAvailabilityRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCoreRubyModelAvailabilityRepairUpdate(source, update)
		: source;
};
