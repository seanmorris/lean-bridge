/**
 * Reverse the authenticated zero-payload Ruby package source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadRubyHistoryHistoryPath
	= "docs/evidence/zero-payload-ruby-source-history-20261021.json";
export const zeroPayloadRubyHistoryPredecessor
	= "0d420c0dda5953f0167f55421887838a646b6296";
export const zeroPayloadRubyHistoryImplementation
	= "b539a4249f2a8af61d72e6ccfc7ac7ceeb1b8590";
export const zeroPayloadRubyHistoryChangedPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/zero-payload-checked-record-ruby.test.mjs"
]);
export const zeroPayloadRubyHistoryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const zeroPayloadRubyHistoryApplicationPaths = Object.freeze([
	".github/workflows/zero-payload-checked-record-ruby.yml"
	, "scripts/check-zero-payload-checked-record-ruby-ci.mjs"
	, "scripts/run-zero-payload-checked-record-ruby-ci.sh"
	, "tests/fixtures/zero-payload-checked-record-ruby/ruby.rb"
	, "tests/helpers/zero-payload-checked-record-ruby-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-ruby-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-ruby-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-ruby-installed-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-ruby-model.rb"
	, "tests/helpers/zero-payload-checked-record-ruby-package.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadRubyHistoryHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadRubyHistoryUpdate = (source, update) => {
	assert.ok([...zeroPayloadRubyHistoryChangedPaths
		, ...zeroPayloadRubyHistoryIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload Ruby milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadRubyHistorySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadRubyHistoryChangedPaths
			, ...zeroPayloadRubyHistoryIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadRubyHistoryUpdate(source, update)
		: source;
};
