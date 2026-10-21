/**
 * Authenticate the missing checked-JavaScript disposition repair as one exact,
 * reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedJavaScriptDispositionHistoryPath
	= "docs/evidence/checked-javascript-disposition-source-history-20261017.json";
export const checkedJavaScriptDispositionPredecessor
	= "8e43e3210de3053867485f71929d0fe610f74966";
export const checkedJavaScriptDispositionCurrentChangedPaths = Object.freeze([
	"config/checked-javascript.json"
	, "docs/type-surface.v1.json"
	, "scripts/promote-fin-native-hosted-evidence.mjs"
	, "scripts/update-hosted-container-inventory-history.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/checked-records.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/current-source-evidence.test.mjs"
	, "tests/fin-container-edge-integration-history.test.mjs"
	, "tests/fin-scalar-dispatch-inventory.test.mjs"
	, "tests/generic-record-array-rollout.test.mjs"
	, "tests/helpers/archive-batch-source-history-tests.mjs"
	, "tests/helpers/browser-generic-promotion-source-history-tests.mjs"
	, "tests/helpers/browser-install-source-history-tests.mjs"
	, "tests/helpers/browser-refinements-source-history-tests.mjs"
	, "tests/helpers/callback-coverage-repair-source-history-tests.mjs"
	, "tests/helpers/callback-fin-promotion-source-history-tests.mjs"
	, "tests/helpers/callback-fin-promotion-tests.mjs"
	, "tests/helpers/callback-fin-source-history-tests.mjs"
	, "tests/helpers/checked-record-browser-history-tests.mjs"
	, "tests/helpers/checked-record-host-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-native-promotion-tests.mjs"
	, "tests/helpers/checked-record-perl-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/checked-record-promotion-source-history-tests.mjs"
	, "tests/helpers/checked-record-promotion-tests.mjs"
	, "tests/helpers/ci-contract-repair-source-history.mjs"
	, "tests/helpers/ci-dependency-timeout-source-history-tests.mjs"
	, "tests/helpers/cli-package-config-history-tests.mjs"
	, "tests/helpers/cli-package-config-history.mjs"
	, "tests/helpers/combined-lineage-source-history-tests.mjs"
	, "tests/helpers/container-host-dispatch-source-history-tests.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/cpan-cli-control-source-history-tests.mjs"
	, "tests/helpers/cpp-fin-dispatch-integration-tests.mjs"
	, "tests/helpers/diagnostic-followup-source-history-tests.mjs"
	, "tests/helpers/dotnet-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/dotnet-fin-source-history-tests.mjs"
	, "tests/helpers/fin-container-evidence-ci-tests.mjs"
	, "tests/helpers/fin-core-repair-history-tests.mjs"
	, "tests/helpers/fin-distribution-source-history-tests.mjs"
	, "tests/helpers/fin-entry-integration-tests.mjs"
	, "tests/helpers/fin-native-batch-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-native-batch-promotion-tests.mjs"
	, "tests/helpers/fin-native-hosted-promotion-tests.mjs"
	, "tests/helpers/fin-product-evidence-tests.mjs"
	, "tests/helpers/fin-product-php-name-source-history-tests.mjs"
	, "tests/helpers/fin-products-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-archive-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-host-notes-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-python-ruby-promotion-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/fin-runtime-provenance-source-history-tests.mjs"
	, "tests/helpers/generic-record-browser-archive-source-history-tests.mjs"
	, "tests/helpers/generic-record-browser-source-history-tests.mjs"
	, "tests/helpers/generic-record-hosts-source-history-tests.mjs"
	, "tests/helpers/generic-record-npm-closure-tests.mjs"
	, "tests/helpers/generic-record-promotion-source-history-tests.mjs"
	, "tests/helpers/generic-record-specialization-source-history-tests.mjs"
	, "tests/helpers/generic-records-engine-source-history-tests.mjs"
	, "tests/helpers/generic-records-source-history-tests.mjs"
	, "tests/helpers/generic-refusal-fix-source-history-tests.mjs"
	, "tests/helpers/history-digest-source-history-tests.mjs"
	, "tests/helpers/host-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/hosted-container-inventory.mjs"
	, "tests/helpers/inheritance-subtype-harness-source-history-tests.mjs"
	, "tests/helpers/inherited-record-archive-source-history-tests.mjs"
	, "tests/helpers/inherited-record-promotion-tests.mjs"
	, "tests/helpers/inherited-records-source-history-tests.mjs"
	, "tests/helpers/jvm-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/jvm-fin-source-history-tests.mjs"
	, "tests/helpers/jvm-shard-source-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-tests.mjs"
	, "tests/helpers/native-fin-containers-source-history-tests.mjs"
	, "tests/helpers/native-fin-jvm-exit-history-tests.mjs"
	, "tests/helpers/native-fin-promotion-source-history-tests.mjs"
	, "tests/helpers/native-fin-promotion-tests.mjs"
	, "tests/helpers/native-fin-source-history-tests.mjs"
	, "tests/helpers/native-observation-split-tests.mjs"
	, "tests/helpers/native-specializations-source-history-tests.mjs"
	, "tests/helpers/native-subtype-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-diagnostic-oracle-source-history-tests.mjs"
	, "tests/helpers/node-consumer-budget-ci-tests.mjs"
	, "tests/helpers/nominal-fin-contract-tests.mjs"
	, "tests/helpers/nominal-fin-source-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-path-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-python-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-promotion-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-workflow-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-promotion-tests.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history-tests.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-history-tests.mjs"
	, "tests/helpers/perl-closure-native-budget-tests.mjs"
	, "tests/helpers/perl-evidence-repair-source-history-tests.mjs"
	, "tests/helpers/perl-fin-source-history-tests.mjs"
	, "tests/helpers/perl-indexed-errors-source-history-tests.mjs"
	, "tests/helpers/perl-refinement-hosted-source-history-tests.mjs"
	, "tests/helpers/perl-refinements-source-history-tests.mjs"
	, "tests/helpers/perl-scalar-relocation-source-history-tests.mjs"
	, "tests/helpers/perl-xs-budget-source-history-tests.mjs"
	, "tests/helpers/php-callback-installed-staging-history-tests.mjs"
	, "tests/helpers/php-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/php-fin-source-history-tests.mjs"
	, "tests/helpers/php-receiver-dependency-source-history-tests.mjs"
	, "tests/helpers/php-shard-ci-tests.mjs"
	, "tests/helpers/php-shard-source-history-tests.mjs"
	, "tests/helpers/php-wasm-corpus-partition-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-entry-ci-tests.mjs"
	, "tests/helpers/primitive-subtype-history-repair-tests.mjs"
	, "tests/helpers/python-fin-source-history-tests.mjs"
	, "tests/helpers/python-refinement-evidence-source-history-tests.mjs"
	, "tests/helpers/refinement-audit-source-history-tests.mjs"
	, "tests/helpers/refinement-ci-followup-source-history-tests.mjs"
	, "tests/helpers/refinement-ci-repair-source-history-tests.mjs"
	, "tests/helpers/refinement-closure-source-history-tests.mjs"
	, "tests/helpers/refinement-core-followup-source-history-tests.mjs"
	, "tests/helpers/refinement-history-cache-tests.mjs"
	, "tests/helpers/reviewed-callback-fin-admission-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-acceptance-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-host-evidence-tests.mjs"
	, "tests/helpers/reviewed-fin-promotion-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-promotion-tests.mjs"
	, "tests/helpers/reviewed-fin-refusal-ci-tests.mjs"
	, "tests/helpers/reviewed-fin-source-history-tests.mjs"
	, "tests/helpers/reviewed-record-promotion-tests.mjs"
	, "tests/helpers/reviewed-scalar-hosts-source-history-tests.mjs"
	, "tests/helpers/reviewed-scalar-rollout-source-history-tests.mjs"
	, "tests/helpers/reviewed-semantic-decisions-source-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-admission-source-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-decisions-source-history-tests.mjs"
	, "tests/helpers/ruby-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/ruby-fin-source-history-tests.mjs"
	, "tests/helpers/runtime-receipt-source-history-tests.mjs"
	, "tests/helpers/rust-fin-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-rejection-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-source-entry-ci-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-source-entry-integration-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-wording-source-history-tests.mjs"
	, "tests/helpers/source-history-memo.mjs"
	, "tests/helpers/structural-subtype-core-ci-history-tests.mjs"
	, "tests/helpers/structural-subtype-registration-history-tests.mjs"
	, "tests/helpers/test-profile-registration-source-history-tests.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history-tests.mjs"
	, "tests/helpers/wit-dependency-source-history-tests.mjs"
	, "tests/helpers/wit-dispatch-integration-source-history-tests.mjs"
	, "tests/helpers/wit-fin-source-history-tests.mjs"
	, "tests/hosted-container-inventory.test.mjs"
	, "tests/native-edge-array-harness-history.test.mjs"
	, "tests/owned-javascript-receiver-evidence.test.mjs"
	, "tests/owned-php-wasm-ci.test.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
	, "tests/php-wasm-fin.test.mjs"
	, "tests/recursive-component-regression-repair-source-history.test.mjs"
	, "tests/recursive-wit-test-registration-history.test.mjs"
	, "tests/reviewed-fin-refusal-history.test.mjs"
	, "tests/test-profile-backlog-repair.test.mjs"
	, "tests/wasm-ci-array-history.test.mjs"
	, "tests/wasm-entry-archive-history.test.mjs"
	, "tests/wasm-entry-controls-history.test.mjs"
	, "tests/wasm-entry-harness-history.test.mjs"
	, "tests/wasm-entry-supplement-history.test.mjs"
	, "tests/wasm-entry-supplement.test.mjs"
]);
export const checkedJavaScriptDispositionHistoricalPaths = Object.freeze([
	".gitattributes"
	, "scripts/run-test-profile.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-report.mjs"
	, "tests/helpers/recursive-checked-record-rust-tests.mjs"
	, "tests/recursive-checked-record-php.test.mjs"
	, "tests/recursive-checked-record-wit.test.mjs"
]);
export const checkedJavaScriptDispositionChangedPaths = Object.freeze([
	...new Set([
		...checkedJavaScriptDispositionCurrentChangedPaths
		, ...checkedJavaScriptDispositionHistoricalPaths
	])
].sort());
export const checkedJavaScriptDispositionAddedPaths = Object.freeze([
	"scripts/update-checked-javascript-disposition-history.mjs"
	, "tests/checked-record-browser-ci.test.mjs"
	, "tests/checked-record-browser-foundation.test.mjs"
	, "tests/checked-record-browser-promotion.test.mjs"
	, "tests/checked-record-native-archives.test.mjs"
	, "tests/checked-record-native-ci.test.mjs"
	, "tests/checked-record-native-history.test.mjs"
	, "tests/checked-record-perl-acceptance.test.mjs"
	, "tests/checked-record-php-wasm-evidence-ci.test.mjs"
	, "tests/checked-record-php-wasm-foundation.test.mjs"
	, "tests/checked-record-php-wasm-promotion.test.mjs"
	, "tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/checked-javascript-disposition-history.mjs"
	, "tests/helpers/source-at-fin-history-milestone.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedJavaScriptDispositionHistoryPath, "utf8"
));

/**
 * Reverse one exact checked-JavaScript disposition transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedJavaScriptDispositionUpdate = (source, update) => {
	assert.ok(checkedJavaScriptDispositionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(
				replacement.current, replacement.previous);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
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
 * Remove only this repair layer from an exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedJavaScriptDispositionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedJavaScriptDispositionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const evidence = record();
	const update = evidence.updates.find(item => item.path === path);
	if(update?.currentSha256 === digest)
	{
		source = reverseCheckedJavaScriptDispositionUpdate(source, update);
		if(expected === undefined) return source;
	}
	if(sha256(source) === expected) return source;
	for(const transition of [...evidence.historicalTransitions].reverse())
	{
		const historical = transition.updates.find(item => item.path === path);
		if(historical?.currentSha256 === sha256(source))
			source = reverseCheckedJavaScriptDispositionUpdate(
				source, historical);
		if(sha256(source) === expected) return source;
	}
	return source;
};

/**
 * Restore only source pins refreshed by this exact disposition repair.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforeCheckedJavaScriptDispositionPins = inventory => {
	const previous = structuredClone(inventory);
	const evidence = record();
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = evidence.pinUpdates.find(item => item.path === file.path);
		if(update?.currentSha256 === file.sha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};
