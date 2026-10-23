/**
 * Reverse the authenticated zero-payload native PHP package source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadPhpHistoryHistoryPath
	= "docs/evidence/zero-payload-php-source-history-20261021.json";
export const zeroPayloadPhpHistoryPredecessor
	= "5352bfdeccdd6b42d3baafc27855da065e916148";
export const zeroPayloadPhpHistoryImplementation
	= "0a22efc049ecb6c5dce3c70d2d93187657de7f3a";
export const zeroPayloadPhpHistoryChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/zero-payload-checked-record-php.test.mjs"
]);
export const zeroPayloadPhpHistoryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const zeroPayloadPhpHistoryApplicationPaths = Object.freeze([
	".github/workflows/zero-payload-checked-record-php.yml"
	, "scripts/check-zero-payload-checked-record-php-ci.mjs"
	, "scripts/run-zero-payload-checked-record-php-ci.sh"
	, "tests/fixtures/zero-payload-checked-record-php/php.php"
	, "tests/helpers/zero-payload-checked-record-php-ci-report-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-ci-report.mjs"
	, "tests/helpers/zero-payload-checked-record-php-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-php-installed-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-php-model.php"
	, "tests/helpers/zero-payload-checked-record-php-package.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadPhpHistoryHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadPhpHistoryUpdate = (source, update) => {
	assert.ok([...zeroPayloadPhpHistoryChangedPaths
		, ...zeroPayloadPhpHistoryIntegrationPaths].includes(update.path));
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
 * Remove only this exact zero-payload native PHP milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadPhpHistorySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadPhpHistoryChangedPaths
			, ...zeroPayloadPhpHistoryIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadPhpHistoryUpdate(source, update)
		: source;
};
