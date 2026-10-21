/**
 * Reverse the zero-payload checked-record variant coverage milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadVariantHistoryPath
	= "docs/evidence/zero-payload-variant-source-history-20261021.json";
export const zeroPayloadVariantPredecessor
	= "0aece3431691044e091e1abdb3af1571dd91d051";
export const zeroPayloadVariantImplementation
	= "8a0cb47c87016b5c96e91f6443ffef1f685b3443";
export const zeroPayloadVariantChangedPaths = Object.freeze([
	"src/analyze/NativeExports.lean"
	, "src/analyze/semantic-model.mjs"
	, "tests/fixtures/onboarding/zero-payload-checked-records/ZeroPayloadCheckedRecords.lean"
	, "tests/fixtures/zero-payload-checked-record-browser/full.mts"
	, "tests/fixtures/zero-payload-checked-record-browser/javascript.mjs"
	, "tests/fixtures/zero-payload-checked-record-browser/result-only.mts"
	, "tests/fixtures/zero-payload-checked-record-dotnet/dotnet.cs"
	, "tests/fixtures/zero-payload-checked-record-native/c.c"
	, "tests/fixtures/zero-payload-checked-record-native/cpp.cpp"
	, "tests/fixtures/zero-payload-checked-record-native/result-only-c.c"
	, "tests/fixtures/zero-payload-checked-record-native/result-only-cpp.cpp"
	, "tests/helpers/zero-payload-checked-record-browser-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-dotnet-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-dotnet-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-fixture.mjs"
	, "tests/helpers/zero-payload-checked-record-native-fixture-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-native-fixture.mjs"
	, "tests/zero-payload-checked-record-browser-foundation.test.mjs"
	, "tests/zero-payload-checked-record-javascript.test.mjs"
	, "tests/zero-payload-checked-records.test.mjs"
]);
export const zeroPayloadVariantIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadVariantHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact variant-coverage update.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadVariantUpdate = (source, update) => {
	assert.ok([...zeroPayloadVariantChangedPaths
		, ...zeroPayloadVariantIntegrationPaths].includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this variant milestone from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadVariantSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadVariantChangedPaths
			, ...zeroPayloadVariantIntegrationPaths].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadVariantUpdate(source, update)
		: source;
};
