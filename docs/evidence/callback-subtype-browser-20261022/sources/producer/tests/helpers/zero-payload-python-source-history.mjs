/**
 * Reverse the authenticated zero-payload Python package source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadPythonHistoryHistoryPath
	= "docs/evidence/zero-payload-python-source-history-20261021.json";
export const zeroPayloadPythonHistoryPredecessor
	= "a6173cade3bbe158baa1a5695e3e93e1037359b0";
export const zeroPayloadPythonHistoryImplementation
	= "432bfd0772342630df9176017a5c9c2f6a1f4c40";
export const zeroPayloadPythonHistoryChangedPaths = Object.freeze([
	"src/backends/python/package-audit.mjs"
	, "tests/python-generator.test.mjs"
]);
export const zeroPayloadPythonHistoryIntegrationPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/zero-payload-checked-record-python.test.mjs"
]);
export const zeroPayloadPythonHistoryApplicationPaths = Object.freeze([
	".github/workflows/zero-payload-checked-record-python.yml"
	, "scripts/check-zero-payload-checked-record-python-ci.mjs"
	, "scripts/run-zero-payload-checked-record-python-ci.sh"
	, "tests/fixtures/zero-payload-checked-record-python/python.py"
	, "tests/helpers/zero-payload-checked-record-python-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-python-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-python-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-python-install.mjs"
	, "tests/helpers/zero-payload-checked-record-python-installed-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-python-model.py"
	, "tests/helpers/zero-payload-checked-record-python-wheel.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadPythonHistoryHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadPythonHistoryUpdate = (source, update) => {
	assert.ok([...zeroPayloadPythonHistoryChangedPaths
		, ...zeroPayloadPythonHistoryIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload Python milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadPythonHistorySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadPythonHistoryChangedPaths
			, ...zeroPayloadPythonHistoryIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadPythonHistoryUpdate(source, update)
		: source;
};
