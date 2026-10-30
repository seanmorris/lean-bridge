/**
 * Preserve the final HostNull/Core reconciliation exposed by the full shards.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHostNullReconciliationHistoryPath
	= "docs/evidence/core-host-null-reconciliation-source-history-20261030.json";
export const coreHostNullReconciliationPredecessor
	= "dd5e6bb519e1a1fc39d3924937beb456cfc06871";
export const coreHostNullReconciliationImplementation
	= "87303da42452224305a55b48a3a996222c8a3b4d";
export const coreHostNullReconciliationRefreshedPins = 247;
export const coreHostNullReconciliationPinnedPaths = 26;
export const coreHostNullReconciliationImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "docs/type-surface.v1.json"
	, "src/backends/php/copied-values.mjs"
	, "tests/cpp-structured-callable-contract.test.mjs"
	, "tests/dotnet-structured-callable-contract.test.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-workflow-tests.mjs"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/cpp-structured-callable-evidence.mjs"
	, "tests/helpers/cpp-structured-callable-regression.mjs"
	, "tests/helpers/current-repair-history-isolation-source-history-tests.mjs"
	, "tests/helpers/dotnet-structured-callable-evidence.mjs"
	, "tests/helpers/dotnet-structured-callable-regression.mjs"
	, "tests/helpers/generic-subtype-hosted-contract-tests.mjs"
	, "tests/helpers/historical-type-surface-cells.mjs"
	, "tests/helpers/inherited-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow.mjs"
	, "tests/helpers/nominal-subtype-python-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-ci-workflow-tests.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history.mjs"
	, "tests/helpers/optional-parameter-source-history.mjs"
	, "tests/helpers/php-structured-callable-evidence.mjs"
	, "tests/helpers/php-structured-callable-regression.mjs"
	, "tests/helpers/python-structured-callable-evidence.mjs"
	, "tests/helpers/python-structured-callable-regression.mjs"
	, "tests/helpers/recursive-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry-ci.mjs"
	, "tests/helpers/ruby-structured-callable-evidence.mjs"
	, "tests/helpers/ruby-structured-callable-regression.mjs"
	, "tests/helpers/rust-structured-callable-evidence.mjs"
	, "tests/helpers/rust-structured-callable-regression.mjs"
	, "tests/helpers/structural-subtype-entry-report.mjs"
	, "tests/helpers/structural-subtype-native-report.mjs"
	, "tests/helpers/wit-structured-callable-evidence.mjs"
	, "tests/helpers/wit-structured-callable-regression.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/managed-ci-isolation.test.mjs"
	, "tests/nested-checked-record-foundation.test.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
	, "tests/owned-javascript-nix-evidence.test.mjs"
	, "tests/python-structured-callable-contract.test.mjs"
	, "tests/ruby-structured-callable-contract.test.mjs"
	, "tests/rust-structured-callable-contract.test.mjs"
	, "tests/type-surface.test.mjs"
]);
export const coreHostNullReconciliationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreHostNullReconciliationHistoryAdditions = Object.freeze([
	"scripts/update-core-host-null-reconciliation-source-history.mjs"
	, "tests/helpers/core-host-null-reconciliation-source-history-tests.mjs"
	, "tests/helpers/core-host-null-reconciliation-source-history.mjs"
]);

const historyUrl = new URL(`../../${coreHostNullReconciliationHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreHostNullReconciliationNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreHostNullReconciliationImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreHostNullReconciliationImplementationPaths
	.includes(path) || coreHostNullReconciliationIntegrationPaths.includes(path);

/**
 * Reverse one exact HostNull/Core reconciliation transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseCoreHostNullReconciliationUpdate = (source, update) => {
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
 * Remove only the authenticated HostNull/Core reconciliation.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreHostNullReconciliationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHostNullReconciliationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreHostNullReconciliationUpdate(current, update);
	}
	return current;
};
