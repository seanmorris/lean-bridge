/**
 * Reverse the complete explicit HostNull JavaScript/browser rollout without
 * collapsing its intermediate foundation, implementation, CI or pin states.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullJavaScriptHistoryPath
	= "docs/evidence/host-null-javascript-source-history-20261029.json";
export const hostNullJavaScriptPredecessor
	= "7afb84696779982734578838e63e0d304b8622cf";
export const hostNullJavaScriptFoundation
	= "2bc4d5b43a600eeea36bc921540d7170e8de9dd6";
export const hostNullJavaScriptImplementation
	= "5f7a6cb86c843dbe077a65fdd2e10fce03ed5de2";
export const hostNullJavaScriptWorkflow
	= "04c8e8b45b7fa69f2e85d3ed65247912fac00926";
export const hostNullJavaScriptPinRefresh
	= "7ecdb9216aaeb16c09d59197ceed76c679c67c47";
export const hostNullJavaScriptCommits = Object.freeze([
	hostNullJavaScriptFoundation
	, hostNullJavaScriptImplementation
	, hostNullJavaScriptWorkflow
	, hostNullJavaScriptPinRefresh
]);

export const hostNullJavaScriptChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "docs/type-surface.v1.json"
	, "poc/lean-link-spike/component_scalar.cpp"
	, "schema/binding-ir.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "schema/lake-entry-elaboration.schema.json"
	, "schema/lean-export-configuration.schema.json"
	, "schema/native-metadata-type.schema.json"
	, "src/abi/component-copied.mjs"
	, "src/abi/component-records.mjs"
	, "src/abi/component-recursive.mjs"
	, "src/abi/owned-refinement-model.mjs"
	, "src/abi/refinements.mjs"
	, "src/adoption/type-surface.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/copied-metadata-graph.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/lean-project.mjs"
	, "src/analyze/native-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/owned-metadata-graph.mjs"
	, "src/analyze/project-analysis.mjs"
	, "src/analyze/reviewed-instantiation.mjs"
	, "src/analyze/reviewed-owned-source.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/javascript/copied-validators.mjs"
	, "src/backends/javascript/coverage.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/javascript/owned-package.mjs"
	, "src/binding-ir/contract.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-plan.mjs"
	, "src/build/component-record-adapters.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-structured-callable-defaults.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "src/build/elaborated-component.mjs"
	, "src/build/javascript-wasm-owned-project.mjs"
	, "src/build/lake-entry-intent.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/native-project.mjs"
	, "src/build/php-wasm-project.mjs"
	, "src/release/component-copied-codec.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-publication.mjs"
	, "src/release/component-recursive-codec.mjs"
	, "src/release/owned-javascript-npm-package.mjs"
	, "tests/binding-ir-contract.test.mjs"
	, "tests/component-compound-contract.test.mjs"
	, "tests/component-copied-codec.test.mjs"
	, "tests/component-npm-package.test.mjs"
	, "tests/component-structured-callable-lean.test.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/export-configuration.test.mjs"
	, "tests/helpers/component-scalar-install.mjs"
]);

export const hostNullJavaScriptImplementationAddedPaths = Object.freeze([
	"scripts/refresh-host-null-javascript-pins.mjs"
	, "tests/fixtures/host-null-consumers/npm.mjs"
	, "tests/fixtures/onboarding/host-null/HostNullDemo.lean"
	, "tests/fixtures/onboarding/host-null/lakefile.toml"
	, "tests/fixtures/onboarding/host-null/lean-toolchain"
	, "tests/fixtures/onboarding/host-null/package.json"
	, "tests/helpers/host-null-fixture.mjs"
	, "tests/host-null-npm-installed.test.mjs"
	, "tests/reviewed-host-null.test.mjs"
]);
export const hostNullJavaScriptIntegrationPaths = Object.freeze([
	"tests/helpers/structural-subtype-selection-history-tests.mjs"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullJavaScriptNormalizationPaths = Object.freeze([
	...hostNullJavaScriptChangedPaths
	, ...hostNullJavaScriptIntegrationPaths
]);
export const hostNullJavaScriptHistoryAddedPaths = Object.freeze([
	"scripts/update-host-null-javascript-source-history.mjs"
	, "tests/helpers/host-null-javascript-source-history-tests.mjs"
	, "tests/helpers/host-null-javascript-source-history.mjs"
]);
export const hostNullJavaScriptAddedPaths = Object.freeze([
	...hostNullJavaScriptImplementationAddedPaths
	, ...hostNullJavaScriptHistoryAddedPaths
]);

export const hostNullJavaScriptPinCounts = Object.freeze({
	"src/analyze/NativeExports.lean": 155
	, "src/analyze/reviewed-source.mjs": 99
	, "src/abi/refinements.mjs": 32
	, "src/analyze/native-metadata.mjs": 31
	, "src/build/native-project.mjs": 99
	, "src/analyze/native-types.mjs": 98
	, "src/abi/component-recursive.mjs": 11
	, "src/analyze/elaborated-metadata.mjs": 48
	, "src/analyze/lean-project.mjs": 6
	, "src/analyze/semantic-model.mjs": 60
	, "src/build/component-recursive-lean.mjs": 13
	, ".github/workflows/consumer-matrix.yml": 92
	, "poc/lean-link-spike/component_scalar.cpp": 8
	, "src/analyze/copied-metadata-graph.mjs": 14
	, "src/backends/javascript/copied-validators.mjs": 4
	, "src/backends/javascript/generate.mjs": 16
	, "src/build/compiler-adapters.mjs": 20
	, "src/build/component-recursive-adapters.mjs": 7
	, "src/release/component-npm-package.mjs": 16
	, "src/release/component-recursive-codec.mjs": 2
	, "tests/helpers/component-scalar-install.mjs": 10
	, "src/build/php-wasm-project.mjs": 7
	, "schema/elaborated-export-metadata.schema.json": 10
	, "schema/native-metadata-type.schema.json": 26
	, "src/abi/component-records.mjs": 6
	, "src/build/component-record-adapters.mjs": 14
	, "src/release/component-copied-codec.mjs": 5
	, "src/abi/component-copied.mjs": 6
	, "src/build/elaborated-component.mjs": 7
	, "schema/binding-ir.schema.json": 3
	, "src/backends/javascript/coverage.mjs": 4
	, "src/binding-ir/contract.mjs": 4
	, "tests/component-compound-contract.test.mjs": 2
	, "tests/component-copied-codec.test.mjs": 1
	, "src/analyze/project-analysis.mjs": 2
	, "src/adoption/type-surface.mjs": 1
	, "src/build/multi-profile-project.mjs": 7
	, "src/analyze/export-configuration.mjs": 6
	, "schema/lean-export-configuration.schema.json": 1
	, "tests/export-configuration.test.mjs": 1
	, "src/build/component-plan.mjs": 2
	, "src/build/lake-entry-intent.mjs": 1
	, "src/build/component-structured-callable-defaults.mjs": 2
	, "src/build/component-structured-callable-lean.mjs": 3
	, "tests/component-structured-callable-lean.test.mjs": 1
	, "tests/elaborated-metadata.test.mjs": 4
	, "src/analyze/reviewed-instantiation.mjs": 2
	, "src/abi/owned-refinement-model.mjs": 6
});
export const hostNullJavaScriptPinCount = Object.values(
	hostNullJavaScriptPinCounts).reduce((sum, count) => sum + count, 0);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullJavaScriptHistoryPath, "utf8"
));
const normalizationPaths = new Set(hostNullJavaScriptNormalizationPaths);

/**
 * Restore one exact HostNull first-parent or integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact authenticated source transition.
 */
export const reverseHostNullJavaScriptUpdate = (source, update) => {
	assert.ok(normalizationPaths.has(update.path));
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

/**
 * Remove matching HostNull transitions newest first, stopping at an exact
 * authenticated intermediate digest when requested.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullJavaScriptSource = (path, source, expected) => {
	if(typeof source !== "string" || !normalizationPaths.has(path)) return source;
	let current = source;
	const updates = [...record().integrationUpdates, ...record().updates];
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseHostNullJavaScriptUpdate(current, update);
	}
};
