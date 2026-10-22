/**
 * Reverse the authenticated zero-payload WIT package source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadWitHistoryHistoryPath
	= "docs/evidence/zero-payload-wit-source-history-20261021.json";
export const zeroPayloadWitHistoryPredecessor
	= "4370feedfa903a195d5e31e8e5646c268f237140";
export const zeroPayloadWitHistoryImplementation
	= "38355ab8e3d57ef1c1a4fcb76debfb4cdb5202d0";
export const zeroPayloadWitHistoryChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/zero-payload-checked-record-wit.test.mjs"
]);
export const zeroPayloadWitHistoryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const zeroPayloadWitHistoryApplicationPaths = Object.freeze([
	".github/workflows/zero-payload-checked-record-wit.yml"
	, "scripts/check-zero-payload-checked-record-wit-ci.mjs"
	, "scripts/run-zero-payload-checked-record-wit-ci.sh"
	, "tests/fixtures/zero-payload-checked-record-wit/wit-values.h"
	, "tests/fixtures/zero-payload-checked-record-wit/wit-wasi.c"
	, "tests/helpers/zero-payload-checked-record-wit-ci-handoff-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-report-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-shell-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-environment-records.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-handoff.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-install.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-installed-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-model-records.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-model.c"
	, "tests/helpers/zero-payload-checked-record-wit-package-records.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-package.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-report.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-resources.mjs"
	, "tests/zero-payload-checked-record-wit.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadWitHistoryHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadWitHistoryUpdate = (source, update) => {
	assert.ok([...zeroPayloadWitHistoryChangedPaths
		, ...zeroPayloadWitHistoryIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload WIT milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadWitHistorySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadWitHistoryChangedPaths
			, ...zeroPayloadWitHistoryIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadWitHistoryUpdate(source, update)
		: source;
};

