/**
 * Preserve every source state of the C, C++, Rust and WIT/WASI HostNull rollout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullSystemsHistoryPath
	= "docs/evidence/host-null-systems-source-history-20261029.json";
export const hostNullSystemsPredecessor
	= "2a15b1f9c02131f5d59174aad68bbd9c57ff8647";
export const hostNullSystemsProjection
	= "d524741ae435266c10679aaa1eb9309f881916ef";
export const hostNullSystemsAcceptance
	= "835bfa546a5e7823c6d1ad7269f00df36a067902";
export const hostNullSystemsPinDefinition
	= "95b3dedcbceee518695c3901534300a9468fc36e";
export const hostNullSystemsPinRefresh
	= "1dc4c6c47def16c4cb5f98ce0ee23e12ed6a7d82";
export const hostNullSystemsCommits = Object.freeze([
	hostNullSystemsProjection
	, hostNullSystemsAcceptance
	, hostNullSystemsPinDefinition
	, hostNullSystemsPinRefresh
]);
export const hostNullSystemsChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/gmp-values.mjs"
	, "src/backends/c/native-callables.mjs"
	, "src/backends/cpp/copied-values.mjs"
	, "src/backends/cpp/primitives.mjs"
	, "src/backends/rust/copied-conversions.mjs"
	, "src/backends/rust/copied-model.mjs"
	, "src/backends/rust/copied-values.mjs"
	, "src/backends/wit/callable-result-owners.mjs"
	, "src/backends/wit/canonical-borrow-drops.mjs"
	, "src/backends/wit/copied-component.mjs"
	, "src/backends/wit/copied-conversions.mjs"
	, "src/backends/wit/copied-model.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const hostNullSystemsExternalHistoryPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const hostNullSystemsImplementationAddedPaths = Object.freeze([
	"scripts/check-host-null-systems-ci.mjs"
	, "scripts/refresh-host-null-systems-pins.mjs"
	, "scripts/run-host-null-systems-ci.sh"
	, "tests/fixtures/host-null-consumers/c.c"
	, "tests/fixtures/host-null-consumers/cpp.cpp"
	, "tests/fixtures/host-null-consumers/rust.rs"
	, "tests/fixtures/host-null-consumers/wit-wasi.c"
	, "tests/helpers/host-null-systems-installed.mjs"
	, "tests/systems-host-null-ci.test.mjs"
	, "tests/systems-host-null-contract.test.mjs"
	, "tests/systems-host-null.test.mjs"
]);
export const hostNullSystemsIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullSystemsHistoryAddedPaths = Object.freeze([
	"scripts/update-host-null-systems-source-history.mjs"
	, "tests/helpers/host-null-systems-source-history-tests.mjs"
	, "tests/helpers/host-null-systems-source-history.mjs"
]);
export const hostNullSystemsAddedPaths = Object.freeze([
	...hostNullSystemsImplementationAddedPaths
	, ...hostNullSystemsHistoryAddedPaths
]);
export const hostNullSystemsNormalizationPaths = Object.freeze([
	...hostNullSystemsChangedPaths
	, ...hostNullSystemsIntegrationPaths
]);
export const hostNullSystemsPinCounts = Object.freeze({
	".github/workflows/consumer-matrix.yml": 92
	, "src/adoption/test-profiles.mjs": 98
	, "src/backends/c/gmp-values.mjs": 6
	, "src/backends/c/native-callables.mjs": 13
	, "src/backends/cpp/copied-values.mjs": 12
	, "src/backends/cpp/primitives.mjs": 10
	, "src/backends/rust/copied-conversions.mjs": 10
	, "src/backends/rust/copied-model.mjs": 12
	, "src/backends/rust/copied-values.mjs": 18
	, "src/backends/wit/callable-result-owners.mjs": 1
	, "src/backends/wit/copied-component.mjs": 10
	, "src/backends/wit/copied-conversions.mjs": 10
	, "src/backends/wit/copied-model.mjs": 12
	, "tests/test-profiles.test.mjs": 4
});
export const hostNullSystemsPinCount = Object.values(
	hostNullSystemsPinCounts).reduce((sum, count) => sum + count, 0);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullSystemsHistoryPath, "utf8"
));
const normalizationPaths = new Set(hostNullSystemsNormalizationPaths);

/**
 * Restore one exact systems HostNull transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseHostNullSystemsUpdate = (source, update) => {
	assert.ok(normalizationPaths.has(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

const reverseSet = (path, source, expected, updates) => {
	if(typeof source !== "string" || !normalizationPaths.has(path)) return source;
	let current = source;
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseHostNullSystemsUpdate(current, update);
	}
};

/**
 * Restore only this layer's newest-first registration edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullSystemsIntegrationSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().integrationUpdates);

/**
 * Restore the four systems HostNull implementation milestones.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullSystemsSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().updates);
