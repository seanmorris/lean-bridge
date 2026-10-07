/**
 * Preserve exact source predecessors of the History digest cache change (#1440).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeGenericRecordHostsSource } from "./generic-record-hosts-source-history.mjs";

export const historyDigestHistoryPath = "docs/evidence/history-digest-source-history-20261007.json";
export const historyDigestChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/browser-refinements-source-history.mjs"
	, "tests/helpers/c-structured-callable-source-history.mjs"
	, "tests/helpers/callback-fin-source-history.mjs"
	, "tests/helpers/cli-package-config-history.mjs"
	, "tests/helpers/closure-thread-source-history.mjs"
	, "tests/helpers/combined-lineage-source-history.mjs"
	, "tests/helpers/compound-source-history.mjs"
	, "tests/helpers/container-host-dispatch-source-history.mjs"
	, "tests/helpers/copied-fixture-source-history.mjs"
	, "tests/helpers/core-history-performance-history.mjs"
	, "tests/helpers/cpan-cli-control-source-history.mjs"
	, "tests/helpers/cpp-structured-callable-source-history.mjs"
	, "tests/helpers/diagnostic-followup-source-history.mjs"
	, "tests/helpers/dotnet-fin-source-history.mjs"
	, "tests/helpers/dotnet-recursive-callable-source-history.mjs"
	, "tests/helpers/dotnet-source-history.mjs"
	, "tests/helpers/dotnet-structured-callable-source-history.mjs"
	, "tests/helpers/fin-distribution-source-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/generic-records-source-history.mjs"
	, "tests/helpers/host-fin-evidence-source-history.mjs"
	, "tests/helpers/jvm-fin-source-history.mjs"
	, "tests/helpers/jvm-probe-repair-history.mjs"
	, "tests/helpers/jvm-recursive-callable-source-history.mjs"
	, "tests/helpers/jvm-source-history.mjs"
	, "tests/helpers/jvm-structured-callable-source-history.mjs"
	, "tests/helpers/jvm-thread-exit-repair-history.mjs"
	, "tests/helpers/managed-ci-isolation-history.mjs"
	, "tests/helpers/managed-close-generated-history.mjs"
	, "tests/helpers/managed-close-history.mjs"
	, "tests/helpers/native-asset-tamper-history.mjs"
	, "tests/helpers/native-fin-containers-source-history.mjs"
	, "tests/helpers/native-fin-source-history.mjs"
	, "tests/helpers/native-fork-repair-history.mjs"
	, "tests/helpers/native-recursive-callable-source-history.mjs"
	, "tests/helpers/native-specializations-source-history.mjs"
	, "tests/helpers/native-subtype-source-history.mjs"
	, "tests/helpers/nested-fin-source-history.mjs"
	, "tests/helpers/nominal-fin-source-history.mjs"
	, "tests/helpers/npm-fin-diagnostics-source-history.mjs"
	, "tests/helpers/npm-structured-callable-source-history.mjs"
	, "tests/helpers/owned-aggregate-source-history.mjs"
	, "tests/helpers/owned-analysis-source-history.mjs"
	, "tests/helpers/owned-borrow-ci-history.mjs"
	, "tests/helpers/owned-borrow-history.mjs"
	, "tests/helpers/owned-c-source-history.mjs"
	, "tests/helpers/owned-callback-inventory-history.mjs"
	, "tests/helpers/owned-callback-result-history.mjs"
	, "tests/helpers/owned-ci-followup-history.mjs"
	, "tests/helpers/owned-ci-source-history.mjs"
	, "tests/helpers/owned-consumer-ci-repair-history.mjs"
	, "tests/helpers/owned-cpp-borrow-ci-history.mjs"
	, "tests/helpers/owned-cpp-borrow-history.mjs"
	, "tests/helpers/owned-cpp-callback-result-history.mjs"
	, "tests/helpers/owned-cpp-order-history.mjs"
	, "tests/helpers/owned-cpp-receiver-history.mjs"
	, "tests/helpers/owned-cpp-source-history.mjs"
	, "tests/helpers/owned-cpp-transfer-history.mjs"
	, "tests/helpers/owned-dotnet-borrow-history.mjs"
	, "tests/helpers/owned-dotnet-callback-result-history.mjs"
	, "tests/helpers/owned-dotnet-lifetime-history.mjs"
	, "tests/helpers/owned-dotnet-process-history.mjs"
	, "tests/helpers/owned-dotnet-receiver-history.mjs"
	, "tests/helpers/owned-dotnet-source-history.mjs"
	, "tests/helpers/owned-dotnet-transfer-history.mjs"
	, "tests/helpers/owned-host-source-history.mjs"
	, "tests/helpers/owned-javascript-borrow-history.mjs"
	, "tests/helpers/owned-javascript-coexistence-source-history.mjs"
	, "tests/helpers/owned-javascript-engine-history.mjs"
	, "tests/helpers/owned-javascript-nix-history.mjs"
	, "tests/helpers/owned-javascript-npm-source-history.mjs"
	, "tests/helpers/owned-javascript-publication-history.mjs"
	, "tests/helpers/owned-javascript-receiver-history.mjs"
	, "tests/helpers/owned-javascript-transfer-history.mjs"
	, "tests/helpers/owned-javascript-wasm-source-history.mjs"
	, "tests/helpers/owned-jvm-borrow-history.mjs"
	, "tests/helpers/owned-jvm-callback-result-history.mjs"
	, "tests/helpers/owned-jvm-receiver-gc-history.mjs"
	, "tests/helpers/owned-jvm-receiver-history.mjs"
	, "tests/helpers/owned-jvm-source-history.mjs"
	, "tests/helpers/owned-jvm-transfer-history.mjs"
	, "tests/helpers/owned-package-source-history.mjs"
	, "tests/helpers/owned-perl-borrow-history.mjs"
	, "tests/helpers/owned-perl-callback-result-history.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-history.mjs"
	, "tests/helpers/owned-perl-ci-history.mjs"
	, "tests/helpers/owned-perl-profile-history.mjs"
	, "tests/helpers/owned-perl-receiver-history.mjs"
	, "tests/helpers/owned-perl-source-history.mjs"
	, "tests/helpers/owned-perl-transfer-history.mjs"
	, "tests/helpers/owned-php-borrow-history.mjs"
	, "tests/helpers/owned-php-receiver-history.mjs"
	, "tests/helpers/owned-php-source-history.mjs"
	, "tests/helpers/owned-php-transfer-history.mjs"
	, "tests/helpers/owned-php-wasm-borrow-history.mjs"
	, "tests/helpers/owned-php-wasm-receiver-history.mjs"
	, "tests/helpers/owned-php-wasm-source-history.mjs"
	, "tests/helpers/owned-php-wasm-transfer-history.mjs"
	, "tests/helpers/owned-python-borrow-history.mjs"
	, "tests/helpers/owned-python-callback-result-history.mjs"
	, "tests/helpers/owned-python-receiver-history.mjs"
	, "tests/helpers/owned-python-source-history.mjs"
	, "tests/helpers/owned-python-transfer-history.mjs"
	, "tests/helpers/owned-receiver-ci-repair-history.mjs"
	, "tests/helpers/owned-receiver-history.mjs"
	, "tests/helpers/owned-reviewed-source-history.mjs"
	, "tests/helpers/owned-ruby-borrow-ci-history.mjs"
	, "tests/helpers/owned-ruby-borrow-history.mjs"
	, "tests/helpers/owned-ruby-callback-generated-history.mjs"
	, "tests/helpers/owned-ruby-callback-result-history.mjs"
	, "tests/helpers/owned-ruby-receiver-history.mjs"
	, "tests/helpers/owned-ruby-source-history.mjs"
	, "tests/helpers/owned-ruby-transfer-history.mjs"
	, "tests/helpers/owned-rust-borrow-history.mjs"
	, "tests/helpers/owned-rust-callback-result-history.mjs"
	, "tests/helpers/owned-rust-receiver-history.mjs"
	, "tests/helpers/owned-rust-source-history.mjs"
	, "tests/helpers/owned-rust-transfer-history.mjs"
	, "tests/helpers/owned-transfer-c-history.mjs"
	, "tests/helpers/owned-transfer-generated-history.mjs"
	, "tests/helpers/owned-transfer-package-history.mjs"
	, "tests/helpers/owned-wasm32-source-history.mjs"
	, "tests/helpers/owned-zend-bailout-repair-history.mjs"
	, "tests/helpers/perl-contract-repair-history.mjs"
	, "tests/helpers/perl-evidence-repair-source-history.mjs"
	, "tests/helpers/perl-fin-source-history.mjs"
	, "tests/helpers/perl-indexed-errors-source-history.mjs"
	, "tests/helpers/perl-recursive-callable-source-history.mjs"
	, "tests/helpers/perl-refinements-source-history.mjs"
	, "tests/helpers/perl-structured-callable-source-history.mjs"
	, "tests/helpers/php-callback-acceptance-history.mjs"
	, "tests/helpers/php-callback-installed-staging-history.mjs"
	, "tests/helpers/php-ci-regression-source-history.mjs"
	, "tests/helpers/php-fin-source-history.mjs"
	, "tests/helpers/php-nix-boundary-repair-history.mjs"
	, "tests/helpers/php-recursive-callable-source-history.mjs"
	, "tests/helpers/php-structured-callable-source-history.mjs"
	, "tests/helpers/php-wasm-callback-result-acceptance-history.mjs"
	, "tests/helpers/php-wasm-recursive-callable-source-history.mjs"
	, "tests/helpers/php-wasm-structured-callable-source-history.mjs"
	, "tests/helpers/post-perl-callback-staging-history.mjs"
	, "tests/helpers/python-fin-source-history.mjs"
	, "tests/helpers/python-recursive-callable-source-history.mjs"
	, "tests/helpers/python-refinement-evidence-source-history.mjs"
	, "tests/helpers/python-structured-callable-source-history.mjs"
	, "tests/helpers/recursive-documentation-history.mjs"
	, "tests/helpers/recursive-source-history.mjs"
	, "tests/helpers/refinement-audit-source-history.mjs"
	, "tests/helpers/refinement-ci-repair-source-history.mjs"
	, "tests/helpers/refinement-closure-source-history.mjs"
	, "tests/helpers/refinement-history-cache-source-history.mjs"
	, "tests/helpers/reviewed-fin-evidence-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-evidence-source-history.mjs"
	, "tests/helpers/reviewed-fin-source-history.mjs"
	, "tests/helpers/reviewed-semantic-decisions-source-history.mjs"
	, "tests/helpers/ruby-fin-source-history.mjs"
	, "tests/helpers/ruby-recursive-callable-source-history.mjs"
	, "tests/helpers/ruby-source-history.mjs"
	, "tests/helpers/ruby-structured-callable-source-history.mjs"
	, "tests/helpers/runtime-receipt-source-history.mjs"
	, "tests/helpers/rust-fin-source-history.mjs"
	, "tests/helpers/rust-recursive-callable-source-history.mjs"
	, "tests/helpers/rust-structured-callable-source-history.mjs"
	, "tests/helpers/scalar-fin-rejection-source-history.mjs"
	, "tests/helpers/scalar-fin-wording-source-history.mjs"
	, "tests/helpers/source-registration-history.mjs"
	, "tests/helpers/structured-docs-ci-history.mjs"
	, "tests/helpers/subtype-component-source-history.mjs"
	, "tests/helpers/subtype-heap-source-history.mjs"
	, "tests/helpers/subtype-refinement-source-history.mjs"
	, "tests/helpers/test-profile-registration-source-history.mjs"
	, "tests/helpers/test-registration-history.mjs"
	, "tests/helpers/wit-acceptance-source-history.mjs"
	, "tests/helpers/wit-callback-acceptance-history.mjs"
	, "tests/helpers/wit-callback-installed-acceptance-history.mjs"
	, "tests/helpers/wit-callback-runtime-staging-history.mjs"
	, "tests/helpers/wit-composition-source-history.mjs"
	, "tests/helpers/wit-fin-source-history.mjs"
	, "tests/helpers/wit-host-source-history.mjs"
	, "tests/helpers/wit-owned-borrow-history.mjs"
	, "tests/helpers/wit-owned-build-repair-history.mjs"
	, "tests/helpers/wit-owned-native-history.mjs"
	, "tests/helpers/wit-owned-package-history.mjs"
	, "tests/helpers/wit-owned-projection-history.mjs"
	, "tests/helpers/wit-owned-receiver-history.mjs"
	, "tests/helpers/wit-owned-session-history.mjs"
	, "tests/helpers/wit-owned-transfer-history.mjs"
	, "tests/helpers/wit-package-source-history.mjs"
	, "tests/helpers/wit-recursive-callable-source-history.mjs"
	, "tests/helpers/wit-structured-callable-source-history.mjs"
	, "tests/source-history-memo.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseHistoryDigestUpdate = (source, update) => {
	assert.ok(historyDigestChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore the source before #1440, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHistoryDigestSource = (path, source, expected) => {
	source = beforeGenericRecordHostsSource(path, source, expected);
	if(typeof source !== "string" || !historyDigestChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(historyDigestHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseHistoryDigestUpdate(source, update) : source;
};
