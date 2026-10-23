/**
 * Reverse the authenticated history-reader hub repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historyReaderHubRepairHistoryPath
	= "docs/evidence/history-reader-hub-repair-source-history-20261021.json";
export const historyReaderHubRepairPredecessor
	= "8294e36230b803df202ceb6233187028cc5b463f";
export const historyReaderHubRepairImplementation
	= "96212899ab063c05c9089e23a7f0a95198af4ce3";
export const historyReaderHubRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/callback-subtype-browser-artifact-source-history-tests.mjs"
	, "tests/helpers/core-runner-headroom-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-composition-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-npm-browser-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-core-registration-source-history-tests.mjs"
	, "tests/helpers/perl-engine-owned-refinement-closure-source-history-tests.mjs"
	, "tests/helpers/projected-checked-record-mirror-source-history-tests.mjs"
	, "tests/helpers/structural-subtype-partition-validator-source-history-tests.mjs"
	, "tests/helpers/zero-payload-php-source-history-tests.mjs"
	, "tests/helpers/zero-payload-python-source-history-tests.mjs"
	, "tests/helpers/zero-payload-ruby-source-history-tests.mjs"
	, "tests/helpers/zero-payload-wit-source-history-tests.mjs"
]);
export const historyReaderHubRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	historyReaderHubRepairHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseHistoryReaderHubRepairUpdate = (source, update) => {
	assert.ok([...historyReaderHubRepairChangedPaths
		, ...historyReaderHubRepairIntegrationPaths].includes(update.path));
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
 * Remove only this exact reader repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHistoryReaderHubRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...historyReaderHubRepairChangedPaths
			, ...historyReaderHubRepairIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseHistoryReaderHubRepairUpdate(source, update)
		: source;
};
