/**
 * Preserve the bounded aggregate-history comparison optimization for VO #1220.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220BoundedHistoryComparisonHistoryPath
	= "docs/evidence/vo1220-bounded-history-comparison-source-history-20261109.json";
export const vo1220BoundedHistoryComparisonPredecessor
	= "24041d6b9d9ce7728881919d058393e98fb1e5cd";
export const vo1220BoundedHistoryComparisonImplementation
	= "b53baf273788c6dc9198a6d673a43f10944c7921";
export const vo1220BoundedHistoryComparisonImplementationPaths = Object.freeze([
	"tests/checked-javascript-partition-12.test.mjs"
	, "tests/copied-fixture-source-history.test.mjs"
	, "tests/core-history-performance-evidence.test.mjs"
	, "tests/fin-container-edge-integration-history.test.mjs"
	, "tests/fin-scalar-dispatch-inventory.test.mjs"
	, "tests/generic-record-array-rollout-history.test.mjs"
	, "tests/helpers/author-refinement-docs-source-history-tests.mjs"
	, "tests/helpers/candidate-acceptance-repair-source-history-tests.mjs"
	, "tests/helpers/checked-record-host-ci-history-tests.mjs"
	, "tests/helpers/checked-record-native-host-history-tests.mjs"
	, "tests/helpers/checked-record-native-installed-history-tests.mjs"
	, "tests/helpers/checked-record-perl-history-tests.mjs"
	, "tests/helpers/checked-record-perl-installed-history-tests.mjs"
	, "tests/helpers/checked-record-python-history-tests.mjs"
	, "tests/helpers/checked-record-remaining-hosts-history-tests.mjs"
	, "tests/helpers/checked-record-ruby-jvm-history-tests.mjs"
	, "tests/helpers/copied-graph-repair-source-history-tests.mjs"
	, "tests/helpers/core-evidence-memory-repair-source-history-tests.mjs"
	, "tests/helpers/core-evidence-repair-integration-source-history-tests.mjs"
	, "tests/helpers/core-inventory-followup-endpoint-tests.mjs"
	, "tests/helpers/core-milestone-replay-repair-source-history-tests.mjs"
	, "tests/helpers/core-perl-consumer-endpoint-tests.mjs"
	, "tests/helpers/core-receiver-endpoint-tests.mjs"
	, "tests/helpers/cpp-fin-dispatch-integration-tests.mjs"
	, "tests/helpers/documentation-workflow-repair-source-history-tests.mjs"
	, "tests/helpers/dotnet-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/fin-alias-closure-history-tests.mjs"
	, "tests/helpers/fin-container-edge-ci-history-tests.mjs"
	, "tests/helpers/fin-container-evidence-ci-tests.mjs"
	, "tests/helpers/fin-container-foreign-history-tests.mjs"
	, "tests/helpers/fin-core-repair-history-tests.mjs"
	, "tests/helpers/fin-dotnet-sdk-history-tests.mjs"
	, "tests/helpers/fin-entry-integration-tests.mjs"
	, "tests/helpers/fin-jvm-diagnostics-history-tests.mjs"
	, "tests/helpers/fin-nominal-refusal-history-tests.mjs"
	, "tests/helpers/fin-record-zero-ci-history-tests.mjs"
	, "tests/helpers/fin-scalar-dispatch-inventory.mjs"
	, "tests/helpers/generic-refusal-fix-source-history-tests.mjs"
	, "tests/helpers/hosted-container-inventory.mjs"
	, "tests/helpers/jvm-container-entry-exit-history-tests.mjs"
	, "tests/helpers/jvm-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/maven-prerequisite-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-npm-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-source-history-tests.mjs"
	, "tests/helpers/native-fin-diagnostic-ci-tests.mjs"
	, "tests/helpers/native-fin-diagnostic-source-history-tests.mjs"
	, "tests/helpers/native-fin-nix-boundary-history-tests.mjs"
	, "tests/helpers/nested-checked-record-matrix-closure-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-native-correction-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-quality-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-history-tests.mjs"
	, "tests/helpers/owned-cpp-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-history-tests.mjs"
	, "tests/helpers/owned-receipt-producer-replay-tests.mjs"
	, "tests/helpers/owned-subtype-test-profile-pin-repair-source-history-tests.mjs"
	, "tests/helpers/perl-closure-native-budget-tests.mjs"
	, "tests/helpers/perl-refinement-hosted-source-history-tests.mjs"
	, "tests/helpers/perl-relocated-consumer-source-history-tests.mjs"
	, "tests/helpers/perl-scalar-promotion.mjs"
	, "tests/helpers/perl-scalar-relocation-source-history-tests.mjs"
	, "tests/helpers/perl-xs-budget-source-history-tests.mjs"
	, "tests/helpers/php-callback-acceptance-history-tests.mjs"
	, "tests/helpers/php-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-ci-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-harness-history-tests.mjs"
	, "tests/helpers/php-wasm-failure-diagnostics-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-history-tests.mjs"
	, "tests/helpers/php-wasm-recursive-evidence-replay-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-acceptance-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-entry-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-history-tests.mjs"
	, "tests/helpers/python-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/refinement-core-ci-history-tests.mjs"
	, "tests/helpers/refinement-followup-history-tests.mjs"
	, "tests/helpers/reviewed-fin-refusal-ci-tests.mjs"
	, "tests/helpers/reviewed-perl-diagnostic-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-report-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-ci-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-package-record-history-tests.mjs"
	, "tests/helpers/ruby-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/ruby-gdb-ci-source-history-tests.mjs"
	, "tests/helpers/ruby-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/ruby-graph-keyword-field-source-history-tests.mjs"
	, "tests/helpers/ruby-member-escape-source-history-tests.mjs"
	, "tests/helpers/rust-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/source-at-fin-history-milestone.mjs"
	, "tests/helpers/value-index-promotion-milestone-repair-source-history-tests.mjs"
	, "tests/helpers/vo1220-exact-cohort-repair-source-history-tests.mjs"
	, "tests/helpers/wit-graph-diagnostic-source-history-tests.mjs"
	, "tests/jvm-thread-exit-repair-evidence.test.mjs"
	, "tests/managed-close-evidence.test.mjs"
	, "tests/mutual-checked-record-dotnet-source-history.test.mjs"
	, "tests/mutual-checked-record-jvm-source-history.test.mjs"
	, "tests/mutual-checked-record-npm-archive-source-history.test.mjs"
	, "tests/native-edge-array-harness-history.test.mjs"
	, "tests/owned-analysis-evidence.test.mjs"
	, "tests/owned-borrow-evidence.test.mjs"
	, "tests/owned-callback-inventory-repair.test.mjs"
	, "tests/owned-callback-result-history.test.mjs"
	, "tests/owned-cpp-borrow-evidence.test.mjs"
	, "tests/owned-cpp-callback-result-history.test.mjs"
	, "tests/owned-cpp-receiver-evidence.test.mjs"
	, "tests/owned-dotnet-borrow-evidence.test.mjs"
	, "tests/owned-dotnet-lifetime-evidence.test.mjs"
	, "tests/owned-dotnet-receiver-evidence.test.mjs"
	, "tests/owned-javascript-borrow-evidence.test.mjs"
	, "tests/owned-javascript-coexistence-evidence.test.mjs"
	, "tests/owned-javascript-engine-evidence.test.mjs"
	, "tests/owned-javascript-nix-evidence.test.mjs"
	, "tests/owned-javascript-npm-evidence.test.mjs"
	, "tests/owned-javascript-publication-evidence.test.mjs"
	, "tests/owned-javascript-receiver-evidence.test.mjs"
	, "tests/owned-javascript-transfer-evidence.test.mjs"
	, "tests/owned-javascript-wasm-evidence.test.mjs"
	, "tests/owned-jvm-borrow-evidence.test.mjs"
	, "tests/owned-jvm-callback-result-history.test.mjs"
	, "tests/owned-jvm-receiver-evidence.test.mjs"
	, "tests/owned-jvm-receiver-gc-evidence.test.mjs"
	, "tests/owned-perl-borrow-evidence.test.mjs"
	, "tests/owned-perl-package-evidence.test.mjs"
	, "tests/owned-perl-receiver-ci.test.mjs"
	, "tests/owned-perl-receiver-evidence.test.mjs"
	, "tests/owned-perl-transfer-evidence.test.mjs"
	, "tests/owned-php-borrow-evidence.test.mjs"
	, "tests/owned-php-package-evidence.test.mjs"
	, "tests/owned-php-receiver-evidence.test.mjs"
	, "tests/owned-php-transfer-evidence.test.mjs"
	, "tests/owned-php-wasm-borrow-evidence.test.mjs"
	, "tests/owned-php-wasm-evidence.test.mjs"
	, "tests/owned-php-wasm-receiver-evidence.test.mjs"
	, "tests/owned-php-wasm-transfer-evidence.test.mjs"
	, "tests/owned-python-borrow-evidence.test.mjs"
	, "tests/owned-python-callback-result-history.test.mjs"
	, "tests/owned-python-receiver-evidence.test.mjs"
	, "tests/owned-receiver-evidence.test.mjs"
	, "tests/owned-ruby-borrow-evidence.test.mjs"
	, "tests/owned-ruby-callback-result-history.test.mjs"
	, "tests/owned-ruby-receiver-evidence.test.mjs"
	, "tests/owned-rust-borrow-evidence.test.mjs"
	, "tests/owned-rust-callback-result-history.test.mjs"
	, "tests/owned-rust-receiver-evidence.test.mjs"
	, "tests/owned-transfer-c-evidence.test.mjs"
	, "tests/owned-transfer-package-evidence.test.mjs"
	, "tests/owned-wasm32-evidence.test.mjs"
	, "tests/owned-zend-bailout-repair.test.mjs"
	, "tests/perl-contract-repair-evidence.test.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
	, "tests/recursive-checked-record-perl-diagnostic-source-history.test.mjs"
	, "tests/reviewed-fin-refusal-history.test.mjs"
	, "tests/structured-docs-ci-evidence.test.mjs"
	, "tests/wasm-ci-array-history.test.mjs"
	, "tests/wasm-entry-archive-history.test.mjs"
	, "tests/wasm-entry-controls-history.test.mjs"
	, "tests/wasm-entry-harness-history.test.mjs"
	, "tests/wasm-entry-supplement-history.test.mjs"
	, "tests/wit-owned-borrow-evidence.test.mjs"
	, "tests/wit-owned-build-repair-evidence.test.mjs"
	, "tests/wit-owned-projection-evidence.test.mjs"
	, "tests/wit-owned-receiver-evidence.test.mjs"
	, "tests/wit-owned-transfer-evidence.test.mjs"
]);
export const vo1220BoundedHistoryComparisonImplementationAdditions
	= Object.freeze([
		"tests/helpers/bounded-json-equality-tests.mjs"
		, "tests/helpers/bounded-json-equality.mjs"
	]);
export const vo1220BoundedHistoryComparisonIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-12.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220BoundedHistoryComparisonHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-bounded-history-comparison-source-history.mjs"
	, "tests/helpers/vo1220-bounded-history-comparison-source-history-tests.mjs"
	, "tests/helpers/vo1220-bounded-history-comparison-source-history.mjs"
]);

const historyUrl = new URL(`../../${vo1220BoundedHistoryComparisonHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220BoundedHistoryComparisonNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220BoundedHistoryComparisonImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	vo1220BoundedHistoryComparisonImplementationPaths.includes(path)
	|| vo1220BoundedHistoryComparisonIntegrationPaths.includes(path);

/**
 * Reverse one exact bounded-comparison transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseVo1220BoundedHistoryComparisonUpdate = (
	source, update
) => {
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
 * Remove only the authenticated bounded-comparison optimization.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeVo1220BoundedHistoryComparisonSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220BoundedHistoryComparisonNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220BoundedHistoryComparisonUpdate(current, update);
	}
	return current;
};
