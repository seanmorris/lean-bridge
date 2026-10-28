/**
 * Reverse the authenticated history-reader buffer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historyReaderBufferRepairHistoryPath
	= "docs/evidence/history-reader-buffer-repair-source-history-20261021.json";
export const historyReaderBufferRepairPredecessor
	= "9cc6767cc1c69df89f8e9554bc2c88c8d939c690";
export const historyReaderBufferRepairImplementation
	= "0177cc9e34177538ca72df6e8c08d18936d7c15c";
export const historyReaderBufferRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-record-alias-admission-source-history.test.mjs"
	, "tests/closed-generic-checked-record-source-history.test.mjs"
	, "tests/helpers/callback-subtype-browser-artifact-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-foundation-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-language-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-native-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-npm-acceptance-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-npm-browser-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-remaining-acceptance-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-remaining-source-history-tests.mjs"
	, "tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/checked-record-browser-archive-history-tests.mjs"
	, "tests/helpers/checked-record-browser-ci-history-tests.mjs"
	, "tests/helpers/checked-record-browser-history-tests.mjs"
	, "tests/helpers/checked-record-browser-promotion-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-archive-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-ci-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-history-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/cli-import-repair-history-tests.mjs"
	, "tests/helpers/component-engine-closure-history-tests.mjs"
	, "tests/helpers/component-nominal-subtype-history-tests.mjs"
	, "tests/helpers/component-refinement-mirror-history-tests.mjs"
	, "tests/helpers/core-contract-repair-history-tests.mjs"
	, "tests/helpers/core-quality-budget-history-tests.mjs"
	, "tests/helpers/core-runner-headroom-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-composition-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-npm-browser-source-history-tests.mjs"
	, "tests/helpers/history-reader-hub-repair-source-history-tests.mjs"
	, "tests/helpers/inherited-checked-record-docs-closure-source-history-tests.mjs"
	, "tests/helpers/inherited-checked-record-foundation-history-tests.mjs"
	, "tests/helpers/inherited-checked-record-promotion-source-history-tests.mjs"
	, "tests/helpers/jvm-container-entry-exit-history-tests.mjs"
	, "tests/helpers/jvm-pending-exit-history-tests.mjs"
	, "tests/helpers/managed-nominal-gate-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-hardening-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-review-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-npm-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-source-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-history-tests.mjs"
	, "tests/helpers/native-fin-jvm-exit-history-tests.mjs"
	, "tests/helpers/native-fin-nix-comparison-history-tests.mjs"
	, "tests/helpers/native-history-checkout-history-tests.mjs"
	, "tests/helpers/native-owned-gate-history-tests.mjs"
	, "tests/helpers/nested-checked-record-archive-gap-history-tests.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-diagnostic-oracle-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-dotnet-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-jvm-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-matrix-closure-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-native-correction-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-native-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-perl-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-php-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-python-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-quality-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-ruby-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-rust-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-wit-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-audit-correction-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-registration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-dotnet-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-jvm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-registration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-integration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-registration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-registration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-registration-gap-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-registration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-integration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-registration-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-author-history-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-browser-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-conversion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ceiling-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-dotnet-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-entry-measurement-source-history-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-jvm-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-native-history-tests.mjs"
	, "tests/helpers/nominal-subtype-native-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-npm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-perl-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-path-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-python-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-ruby-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-archive-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-rust-registration-history-tests.mjs"
	, "tests/helpers/nominal-subtype-selection-history-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-ci-history-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-promotion-history-tests.mjs"
	, "tests/helpers/nominal-subtype-wit-registration-history-tests.mjs"
	, "tests/helpers/owned-refinement-carriers-source-history-tests.mjs"
	, "tests/helpers/owned-refinement-model-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-analysis-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-core-registration-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-javascript-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-javascript-transfer-source-history-tests.mjs"
	, "tests/helpers/perl-container-subtype-ci-history-tests.mjs"
	, "tests/helpers/perl-engine-owned-refinement-closure-source-history-tests.mjs"
	, "tests/helpers/perl-history-checkout-history-tests.mjs"
	, "tests/helpers/perl-scalar-relocation-source-history-tests.mjs"
	, "tests/helpers/php-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/php-wasm-corpus-partition-history-tests.mjs"
	, "tests/helpers/php-wasm-failure-diagnostics-history-tests.mjs"
	, "tests/helpers/primitive-audit-core-repair-source-history-tests.mjs"
	, "tests/helpers/primitive-audit-integration-source-history-tests.mjs"
	, "tests/helpers/projected-checked-record-mirror-source-history-tests.mjs"
	, "tests/helpers/python-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/recursive-checked-record-promotion-source-history-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-source-history-tests.mjs"
	, "tests/helpers/ruby-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/ruby-graph-keyword-field-source-history-tests.mjs"
	, "tests/helpers/ruby-member-escape-source-history-tests.mjs"
	, "tests/helpers/rust-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/structural-subtype-ci-foundation-history-tests.mjs"
	, "tests/helpers/structural-subtype-core-ci-history-tests.mjs"
	, "tests/helpers/structural-subtype-partition-validator-source-history-tests.mjs"
	, "tests/helpers/subtype-result-history-tests.mjs"
	, "tests/helpers/wit-callback-installed-acceptance-history-tests.mjs"
	, "tests/helpers/wit-graph-diagnostic-source-history-tests.mjs"
	, "tests/helpers/wit-history-checkout-history-tests.mjs"
	, "tests/helpers/wit-history-checkout-repair-history-tests.mjs"
	, "tests/helpers/zero-payload-browser-archive-source-history-tests.mjs"
	, "tests/helpers/zero-payload-browser-ci-source-history-tests.mjs"
	, "tests/helpers/zero-payload-browser-diagnostic-source-history-tests.mjs"
	, "tests/helpers/zero-payload-browser-source-history-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-source-history-tests.mjs"
	, "tests/helpers/zero-payload-dotnet-archive-source-history-tests.mjs"
	, "tests/helpers/zero-payload-dotnet-ci-source-history-tests.mjs"
	, "tests/helpers/zero-payload-dotnet-control-repair-source-history-tests.mjs"
	, "tests/helpers/zero-payload-dotnet-source-history-tests.mjs"
	, "tests/helpers/zero-payload-dotnet-verifier-repair-source-history-tests.mjs"
	, "tests/helpers/zero-payload-javascript-source-history-tests.mjs"
	, "tests/helpers/zero-payload-jvm-archive-source-history-tests.mjs"
	, "tests/helpers/zero-payload-jvm-source-history-tests.mjs"
	, "tests/helpers/zero-payload-native-archive-source-history-tests.mjs"
	, "tests/helpers/zero-payload-native-evidence-source-history-tests.mjs"
	, "tests/helpers/zero-payload-native-source-history-tests.mjs"
	, "tests/helpers/zero-payload-npm-foundation-source-history-tests.mjs"
	, "tests/helpers/zero-payload-npm-installed-source-history-tests.mjs"
	, "tests/helpers/zero-payload-perl-archive-source-history-tests.mjs"
	, "tests/helpers/zero-payload-python-source-history-tests.mjs"
	, "tests/helpers/zero-payload-ruby-source-history-tests.mjs"
	, "tests/helpers/zero-payload-rust-archive-source-history-tests.mjs"
	, "tests/helpers/zero-payload-rust-audit-repair-source-history-tests.mjs"
	, "tests/helpers/zero-payload-rust-ci-source-history-tests.mjs"
	, "tests/helpers/zero-payload-rust-installed-source-history-tests.mjs"
	, "tests/helpers/zero-payload-rust-source-history-tests.mjs"
	, "tests/helpers/zero-payload-variant-source-history-tests.mjs"
	, "tests/inherited-checked-record-dotnet-artifact-retention-source-history.test.mjs"
	, "tests/inherited-checked-record-dotnet-source-history.test.mjs"
	, "tests/inherited-checked-record-hosted-evidence-history.test.mjs"
	, "tests/inherited-checked-record-jvm-source-history.test.mjs"
	, "tests/inherited-checked-record-perl-source-history.test.mjs"
	, "tests/inherited-checked-record-php-source-history.test.mjs"
	, "tests/inherited-checked-record-python-source-history.test.mjs"
	, "tests/inherited-checked-record-ruby-source-history.test.mjs"
	, "tests/inherited-checked-record-test-registration-history.test.mjs"
	, "tests/late-checked-record-test-registration-history.test.mjs"
	, "tests/mutual-checked-record-dotnet-source-history.test.mjs"
	, "tests/mutual-checked-record-jvm-source-history.test.mjs"
	, "tests/mutual-checked-record-npm-archive-source-history.test.mjs"
	, "tests/owned-subtype-host-registration-history.test.mjs"
	, "tests/php-copied-keyword-source-history.test.mjs"
	, "tests/php-wasm-writer-guard-source-history.test.mjs"
	, "tests/recursive-checked-record-perl-diagnostic-source-history.test.mjs"
	, "tests/recursive-checked-record-perl-package-history-repair.test.mjs"
	, "tests/recursive-component-regression-repair-source-history.test.mjs"
	, "tests/recursive-wit-test-registration-history.test.mjs"
]);
export const historyReaderBufferRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-fin-containers.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	historyReaderBufferRepairHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseHistoryReaderBufferRepairUpdate = (source, update) => {
	assert.ok([...historyReaderBufferRepairChangedPaths
		, ...historyReaderBufferRepairIntegrationPaths].includes(update.path));
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
 * Remove only this exact reader repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHistoryReaderBufferRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...historyReaderBufferRepairChangedPaths
			, ...historyReaderBufferRepairIntegrationPaths]
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseHistoryReaderBufferRepairUpdate(source, update)
		: source;
};
