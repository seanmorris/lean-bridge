/**
 * Reverse the combined dependent checked-record hosted-archiver preparation
 * milestone without rewriting any earlier archive history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordHostedArchiversHistoryPath
	= "docs/evidence/dependent-checked-record-hosted-archivers-source-history-20261021.json";
export const dependentCheckedRecordHostedArchiversPredecessor
	= "e1899c46c9169c93419e230a9efba9892963c7f2";
export const dependentCheckedRecordHostedArchiversImplementation
	= "4d352cff2ebbc4f03504801619104248204c264a";
export const dependentCheckedRecordHostedArchiversChangedPaths = Object.freeze([
	"tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
	, "tests/helpers/dependent-checked-record-hosted-evidence-sources.mjs"
]);
export const dependentCheckedRecordHostedArchiversAddedPaths = Object.freeze([
	"scripts/archive-dependent-checked-record-browser-evidence.mjs"
	, "scripts/archive-dependent-checked-record-dotnet-evidence.mjs"
	, "scripts/archive-dependent-checked-record-jvm-evidence.mjs"
	, "scripts/archive-dependent-checked-record-native-evidence.mjs"
	, "scripts/archive-dependent-checked-record-php-evidence.mjs"
	, "scripts/archive-dependent-checked-record-php-wasm-evidence.mjs"
	, "scripts/archive-dependent-checked-record-wit-evidence.mjs"
	, "scripts/check-dependent-checked-record-browser-ci.mjs"
	, "scripts/check-dependent-checked-record-native-ci.mjs"
	, "tests/helpers/dependent-checked-record-browser-ci-report-tests.mjs"
	, "tests/helpers/dependent-checked-record-browser-ci-report.mjs"
	, "tests/helpers/dependent-checked-record-browser-report.mjs"
	, "tests/helpers/dependent-checked-record-native-ci-report-tests.mjs"
	, "tests/helpers/dependent-checked-record-native-ci-report.mjs"
	, "tests/helpers/dependent-checked-record-native-report.mjs"
]);
export const dependentCheckedRecordHostedArchiversIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordHostedArchiversHistoryPath, "utf8"
));

/**
 * Authenticate both endpoints and reverse one registered transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact transition record.
 */
export const reverseDependentCheckedRecordHostedArchiversUpdate = (
	source, update
) => {
	assert.ok([
		...dependentCheckedRecordHostedArchiversChangedPaths
		, ...dependentCheckedRecordHostedArchiversIntegrationPaths
	].includes(update.path));
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
		assert.equal(source.slice(
			edit.start, edit.start + edit.current.length
		), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this exact combined archiver-preparation milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordHostedArchiversSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || ![
		...dependentCheckedRecordHostedArchiversChangedPaths
		, ...dependentCheckedRecordHostedArchiversIntegrationPaths
	].includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseDependentCheckedRecordHostedArchiversUpdate(source, update)
		: source;
};
