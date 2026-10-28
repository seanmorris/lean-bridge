/**
 * Authenticate expanded PHP-Wasm source coverage without inferring installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedPhpWasmMixedCoverageHistoryPath
	= "docs/evidence/owned-checked-php-wasm-mixed-coverage-source-history-20261025.json";
export const ownedCheckedPhpWasmMixedCoveragePredecessor
	= "83d8de7c2d69efede5a3cf701790cce71bdc9a48";
export const ownedCheckedPhpWasmMixedCoverageImplementation
	= "ebe348e56acd2f9aa721a48f9e43df9518914a0b";
export const ownedCheckedPhpWasmMixedCoverageIntegrationBase
	= "ebe348e56acd2f9aa721a48f9e43df9518914a0b";
export const ownedCheckedPhpWasmMixedCoverageCommits = Object.freeze([
	"ebe348e56acd2f9aa721a48f9e43df9518914a0b"
]);
export const ownedCheckedPhpWasmMixedCoverageChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/fixtures/structured-types/owned-checked-record-php-wasm.php"
	, "tests/helpers/owned-checked-record-hosted-output.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-hosted-tests.mjs"
	, "tests/helpers/owned-checked-record-promotion-tests.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-checked-record-php-wasm-packaging.test.mjs"
]);
export const ownedCheckedPhpWasmMixedCoverageImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-php-wasm-mixed-coverage-20261025.json"
	, "tests/helpers/owned-checked-record-php-wasm-corpus.mjs"
]);
export const ownedCheckedPhpWasmMixedCoverageImplementationPaths = Object.freeze([
	...ownedCheckedPhpWasmMixedCoverageChangedPaths
	, ...ownedCheckedPhpWasmMixedCoverageImplementationAddedPaths
]);
export const ownedCheckedPhpWasmMixedCoverageIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedPhpWasmMixedCoverageNormalizationPaths = Object.freeze([
	...ownedCheckedPhpWasmMixedCoverageChangedPaths
	, ...ownedCheckedPhpWasmMixedCoverageIntegrationPaths
]);
export const ownedCheckedPhpWasmMixedCoverageHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-php-wasm-mixed-coverage-source-history.mjs"
	, "tests/helpers/owned-checked-php-wasm-mixed-coverage-source-history-tests.mjs"
	, "tests/helpers/owned-checked-php-wasm-mixed-coverage-source-history.mjs"
]);
export const ownedCheckedPhpWasmMixedCoverageAddedPaths = Object.freeze([
	...ownedCheckedPhpWasmMixedCoverageImplementationAddedPaths
	, ...ownedCheckedPhpWasmMixedCoverageHistoryAddedPaths
]);
export const ownedCheckedPhpWasmMixedCoveragePins = Object.freeze([
	Object.freeze({
		path: "tests/fixtures/structured-types/owned-checked-record-php-wasm.php"
		, count: 4
		, previousSha256: "587502c1489137797675c9c4ecc7f1d9b12a32f2464d6046ed2f33ee9ce18fdc"
		, currentSha256: "ca67f744050815ecb10a84867045a9718aed20debeb08888c681bc5c95fd69d3"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-hosted-output.mjs"
		, count: 11
		, previousSha256: "bbe381f19f70166312731bf151f21da56c8374857c7c7d9cb1098ce56f0e44c0"
		, currentSha256: "06e71de8da8c60c07ea561806c53b64770b038f61e8a001b097400b2eb6d078c"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-promotion-tests.mjs"
		, count: 11
		, previousSha256: "b257df31252c8007f2dfb5dc041c0deaa870bfc51d7b0c357fd6ed4a60132bf4"
		, currentSha256: "721cb21bb45200b09c15bb225a12e2e18644cacf087e78c26a74c57aee24a3d0"
	})
	, Object.freeze({
		path: "tests/helpers/owned-php-wasm-packages.mjs"
		, count: 7
		, previousSha256: "cd8d2c8c672babfc1f601f7008ddf479913f6b6d6550198f016ff2f7795dbee0"
		, currentSha256: "264d6d33b27fd5b508f2e89c7dcdcf0801a19906fe6d179b8ad3c247a707c3b0"
	})
	, Object.freeze({
		path: "tests/owned-checked-record-php-wasm-packaging.test.mjs"
		, count: 4
		, previousSha256: "f6ca6ea5118059d63bc2c21b1f42b03070f458d7a8180819908c01e2a78760c6"
		, currentSha256: "a9e4cfbd64568662011273a0a10c7b543081980ea1cb5d3dec0ad71b2fa512ef"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedPhpWasmMixedCoverageHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedPhpWasmMixedCoverageUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedPhpWasmMixedCoverageNormalizationPaths
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
 * Remove only the exact Owned checked PHP-Wasm mixed coverage.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedPhpWasmMixedCoverageSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedPhpWasmMixedCoverageNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedPhpWasmMixedCoverageUpdate(current, update);
	}
	return current;
};
