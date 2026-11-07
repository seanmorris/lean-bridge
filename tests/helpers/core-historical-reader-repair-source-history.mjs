/**
 * Preserve the complete historical-reader and dependent-Fin packaging repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoricalReaderRepairHistoryPath
	= "docs/evidence/core-historical-reader-repair-source-history-20261107.json";
export const coreHistoricalReaderRepairPredecessor
	= "5b1fed7e8a4d27cba80eed2ffa863863f9bdcbbd";
export const coreHistoricalReaderRepairImplementation
	= "c76a98643b28b689a4b87234214921bf83ff4a16";
export const coreHistoricalReaderRepairModifiedPaths = Object.freeze([
	"src/build/component-callable-adapters.mjs"
	, "src/build/component-scalar-adapters.mjs"
	, "tests/helpers/borrow-receiver-producer-binding-tests.mjs"
	, "tests/helpers/dependent-signature-foundation-tests.mjs"
	, "tests/helpers/fin-container-foreign-measured-evidence-tests.mjs"
	, "tests/helpers/jvm-recursive-callable-evidence.mjs"
	, "tests/helpers/php-recursive-callable-evidence.mjs"
	, "tests/helpers/php-wasm-recursive-callable-evidence.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry-ci.mjs"
	, "tests/helpers/structural-subtype-dotnet-report.mjs"
	, "tests/helpers/structural-subtype-jvm-report.mjs"
	, "tests/helpers/structural-subtype-perl-report.mjs"
	, "tests/helpers/structural-subtype-php-report.mjs"
	, "tests/helpers/structural-subtype-php-wasm-report.mjs"
	, "tests/helpers/structural-subtype-promotion-tests.mjs"
	, "tests/helpers/structural-subtype-python-report.mjs"
	, "tests/helpers/structural-subtype-ruby-report.mjs"
	, "tests/helpers/structural-subtype-rust-report.mjs"
	, "tests/helpers/structural-subtype-wit-report.mjs"
	, "tests/owned-jvm-receiver-evidence.test.mjs"
	, "tests/reviewed-fin-wasm-entry-ci.test.mjs"
	, "tests/wit-owned-native-evidence.test.mjs"
	, "tests/wit-owned-session-evidence.test.mjs"
	, "tests/word-contract.test.mjs"
]);
export const coreHistoricalReaderRepairImplementationAdditions = Object.freeze([
	"tests/helpers/structural-subtype-producer-fixture.mjs"
]);
export const coreHistoricalReaderRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreHistoricalReaderRepairHistoryAdditions = Object.freeze([
	"scripts/update-core-historical-reader-repair-source-history.mjs"
	, "tests/helpers/core-historical-reader-repair-source-history-tests.mjs"
	, "tests/helpers/core-historical-reader-repair-source-history.mjs"
]);
export const coreHistoricalReaderRepairBehavior = Object.freeze({
	changedSupportCells: 0
	, runtimeSemanticChanges: 1
	, currentSourcePaths: 16
	, refreshedPins: 271
});

const historyUrl = new URL("../../" + coreHistoricalReaderRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreHistoricalReaderRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: coreHistoricalReaderRepairModifiedPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...coreHistoricalReaderRepairModifiedPaths
	, ...coreHistoricalReaderRepairIntegrationPaths
].includes(path);

/**
 * Require the substantive repair boundaries at the implementation commit.
 *
 * @param sources - Exact implementation sources by repository path.
 */
export const assertCoreHistoricalReaderRepair = sources => {
	for(const path of [
		...coreHistoricalReaderRepairModifiedPaths
		, ...coreHistoricalReaderRepairImplementationAdditions
	]) assert.equal(typeof sources[path], "string", path);
	for(const path of [
		"src/build/component-callable-adapters.mjs"
		, "src/build/component-scalar-adapters.mjs"
	]) assert.equal(sources[path].split(
		'refinement.kind !== "fin-parameter"').length - 1, 2, path);
	for(const path of [
		"tests/helpers/jvm-recursive-callable-evidence.mjs"
		, "tests/helpers/php-recursive-callable-evidence.mjs"
		, "tests/helpers/php-wasm-recursive-callable-evidence.mjs"
	]) {
		assert.match(sources[path], /sourceAtFinHistoryRecordSource/u, path);
		assert.match(sources[path], /authenticateProducerSources/u, path);
		assert.match(sources[path], /typeSurfaceContractsAtProducer/u, path);
	}
	const fixture = sources[
		"tests/helpers/structural-subtype-producer-fixture.mjs"];
	assert.match(fixture, /moduleAtProducerWithSourceReads/u);
	assert.match(fixture, /producerContracts/u);
	for(const host of [
		"dotnet", "jvm", "perl", "php", "php-wasm"
		, "python", "ruby", "rust", "wit"
	]) assert.match(sources[
		`tests/helpers/structural-subtype-${host}-report.mjs`]
	, /producerContracts/u, host);
	const wasm = sources["tests/helpers/reviewed-fin-wasm-entry-ci.mjs"];
	assert.match(wasm, /export const wasmEntryCiJobSource/u);
	assert.doesNotMatch(wasm, /export const wasmEntryCiJob =/u);
	return { ...coreHistoricalReaderRepairBehavior };
};

/**
 * Reverse one exact authenticated repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCoreHistoricalReaderRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this repair and its central integration.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreHistoricalReaderRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoricalReaderRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreHistoricalReaderRepairUpdate(current, update);
	}
	return current;
};
