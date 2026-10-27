/**
 * Preserve the bounded recurring acceptance sweep.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const boundedRecurringAcceptanceSweepHistoryPath
	= "docs/evidence/bounded-recurring-acceptance-sweep-source-history-20261027.json";
export const boundedRecurringAcceptanceSweepPredecessor
	= "4c2d188b495e84d2cdff60cc628c45b800c4e4bb";
export const boundedRecurringAcceptanceSweepImplementation
	= "fee6e855b4cd37e107deff918fba359ac3c203d6";
export const boundedRecurringAcceptanceSweepImplementationPaths = Object.freeze([
	".github/workflows/callback-checked-record-browser.yml"
	, ".github/workflows/callback-checked-record-languages.yml"
	, ".github/workflows/callback-checked-record-native.yml"
	, ".github/workflows/callback-checked-record-perl.yml"
	, ".github/workflows/callback-checked-record-remaining.yml"
	, ".github/workflows/callback-refinements-php-wasm.yml"
	, ".github/workflows/callback-subtype-browser.yml"
	, ".github/workflows/callback-subtype-languages.yml"
	, ".github/workflows/callback-subtype-native.yml"
	, ".github/workflows/callback-subtype-perl.yml"
	, ".github/workflows/callback-subtype-php-wasm.yml"
	, ".github/workflows/callback-subtype-remaining.yml"
	, ".github/workflows/checked-record-browser.yml"
	, ".github/workflows/checked-record-php-wasm.yml"
	, ".github/workflows/checked-record-value-index-browser.yml"
	, ".github/workflows/checked-record-value-index-dotnet.yml"
	, ".github/workflows/checked-record-value-index-jvm.yml"
	, ".github/workflows/checked-record-value-index-native.yml"
	, ".github/workflows/checked-record-value-index-perl.yml"
	, ".github/workflows/checked-record-value-index-php-wasm.yml"
	, ".github/workflows/checked-record-value-index-php.yml"
	, ".github/workflows/checked-record-value-index-python.yml"
	, ".github/workflows/checked-record-value-index-ruby.yml"
	, ".github/workflows/checked-record-value-index-rust.yml"
	, ".github/workflows/checked-record-value-index-wit.yml"
	, ".github/workflows/dependent-checked-record-browser.yml"
	, ".github/workflows/dependent-checked-record-dotnet.yml"
	, ".github/workflows/dependent-checked-record-jvm.yml"
	, ".github/workflows/dependent-checked-record-native.yml"
	, ".github/workflows/dependent-checked-record-perl.yml"
	, ".github/workflows/dependent-checked-record-php-wasm.yml"
	, ".github/workflows/dependent-checked-record-php.yml"
	, ".github/workflows/dependent-checked-record-python.yml"
	, ".github/workflows/dependent-checked-record-ruby.yml"
	, ".github/workflows/dependent-checked-record-rust.yml"
	, ".github/workflows/dependent-checked-record-wit.yml"
	, ".github/workflows/generic-subtype-languages.yml"
	, ".github/workflows/generic-subtype-managed-wit.yml"
	, ".github/workflows/generic-subtype-native-perl.yml"
	, ".github/workflows/generic-subtype-npm-browser.yml"
	, ".github/workflows/inherited-checked-record-browser.yml"
	, ".github/workflows/inherited-checked-record-dotnet.yml"
	, ".github/workflows/inherited-checked-record-jvm.yml"
	, ".github/workflows/inherited-checked-record-native.yml"
	, ".github/workflows/inherited-checked-record-perl.yml"
	, ".github/workflows/inherited-checked-record-php-wasm.yml"
	, ".github/workflows/inherited-checked-record-php.yml"
	, ".github/workflows/inherited-checked-record-python.yml"
	, ".github/workflows/inherited-checked-record-ruby.yml"
	, ".github/workflows/inherited-checked-record-rust.yml"
	, ".github/workflows/inherited-checked-record-wit.yml"
	, ".github/workflows/nested-checked-record-browser.yml"
	, ".github/workflows/nested-checked-record-dotnet.yml"
	, ".github/workflows/nested-checked-record-jvm.yml"
	, ".github/workflows/nested-checked-record-native.yml"
	, ".github/workflows/nested-checked-record-perl.yml"
	, ".github/workflows/nested-checked-record-php-wasm.yml"
	, ".github/workflows/nested-checked-record-php.yml"
	, ".github/workflows/nested-checked-record-python.yml"
	, ".github/workflows/nested-checked-record-ruby.yml"
	, ".github/workflows/nested-checked-record-rust.yml"
	, ".github/workflows/nested-checked-record-wit.yml"
	, ".github/workflows/nominal-primitive-subtype-browser.yml"
	, ".github/workflows/nominal-primitive-subtype-dotnet.yml"
	, ".github/workflows/nominal-primitive-subtype-jvm.yml"
	, ".github/workflows/nominal-primitive-subtype-native.yml"
	, ".github/workflows/nominal-primitive-subtype-npm.yml"
	, ".github/workflows/nominal-primitive-subtype-perl.yml"
	, ".github/workflows/nominal-primitive-subtype-php-wasm.yml"
	, ".github/workflows/nominal-primitive-subtype-php.yml"
	, ".github/workflows/nominal-primitive-subtype-python.yml"
	, ".github/workflows/nominal-primitive-subtype-ruby.yml"
	, ".github/workflows/nominal-primitive-subtype-rust.yml"
	, ".github/workflows/nominal-primitive-subtype-supplement.yml"
	, ".github/workflows/nominal-primitive-subtype-wit.yml"
	, ".github/workflows/nominal-subtype-browser.yml"
	, ".github/workflows/nominal-subtype-entry-browser.yml"
	, ".github/workflows/nominal-subtype-entry-native.yml"
	, ".github/workflows/nominal-subtype-php-wasm.yml"
	, ".github/workflows/owned-checked-record-languages.yml"
	, ".github/workflows/owned-checked-record-managed.yml"
	, ".github/workflows/owned-checked-record-native-perl.yml"
	, ".github/workflows/owned-checked-record-php-wasm.yml"
	, ".github/workflows/owned-subtype-languages.yml"
	, ".github/workflows/owned-subtype-native.yml"
	, ".github/workflows/owned-subtype-perl.yml"
	, ".github/workflows/owned-subtype-php-wasm.yml"
	, ".github/workflows/owned-subtype-remaining.yml"
	, ".github/workflows/php-wasm-callback-entry.yml"
	, ".github/workflows/php-wasm-indexed-refinement-entry.yml"
	, ".github/workflows/php-wasm-owned-refinement-entry.yml"
	, ".github/workflows/php-wasm-refinement-entry.yml"
	, ".github/workflows/recursive-checked-record-native.yml"
	, ".github/workflows/recursive-checked-record-perl.yml"
	, ".github/workflows/recursive-checked-record-php-wasm.yml"
	, ".github/workflows/recursive-checked-record-php.yml"
	, ".github/workflows/recursive-checked-record-python.yml"
	, ".github/workflows/recursive-checked-record-ruby.yml"
	, ".github/workflows/recursive-checked-record-rust.yml"
	, ".github/workflows/recursive-checked-record-wit.yml"
	, ".github/workflows/recursive-subtype-php-wasm.yml"
	, ".github/workflows/zero-payload-checked-record-browser.yml"
	, ".github/workflows/zero-payload-checked-record-dotnet.yml"
	, ".github/workflows/zero-payload-checked-record-jvm.yml"
	, ".github/workflows/zero-payload-checked-record-native.yml"
	, ".github/workflows/zero-payload-checked-record-perl.yml"
	, ".github/workflows/zero-payload-checked-record-php-wasm.yml"
	, ".github/workflows/zero-payload-checked-record-php.yml"
	, ".github/workflows/zero-payload-checked-record-python.yml"
	, ".github/workflows/zero-payload-checked-record-ruby.yml"
	, ".github/workflows/zero-payload-checked-record-rust.yml"
	, ".github/workflows/zero-payload-checked-record-wit.yml"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/callback-subtype-native-ci.test.mjs"
	, "tests/helpers/checked-record-browser-ci-workflow.mjs"
	, "tests/helpers/checked-record-php-wasm-ci-workflow.mjs"
	, "tests/helpers/checked-record-value-index-dotnet-ci-workflow.mjs"
	, "tests/helpers/checked-record-value-index-jvm-ci-workflow.mjs"
	, "tests/helpers/checked-record-value-index-perl-ci-workflow.mjs"
	, "tests/helpers/checked-record-value-index-wit-ci-workflow.mjs"
	, "tests/helpers/dependent-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-dotnet-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-native-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-perl-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-php-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-php-wasm-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-python-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-ruby-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-rust-ci-workflow.mjs"
	, "tests/helpers/inherited-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/mutual-checked-record-native-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-dotnet-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-native-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-perl-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-php-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-php-wasm-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-python-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-ruby-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-rust-ci-workflow.mjs"
	, "tests/helpers/nested-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-browser-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-dotnet-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-jvm-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-npm-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-perl-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-python-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-ruby-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-ci-workflow.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow.mjs"
	, "tests/helpers/nominal-subtype-browser-ci-workflow.mjs"
	, "tests/helpers/nominal-subtype-php-wasm-ci-workflow.mjs"
	, "tests/helpers/php-wasm-fin-direct-ci-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix.mjs"
	, "tests/helpers/php-wasm-subtype-ci-tests.mjs"
	, "tests/helpers/recursive-checked-record-perl-ci-workflow.mjs"
	, "tests/helpers/recursive-checked-record-php-ci-workflow.mjs"
	, "tests/helpers/recursive-checked-record-php-wasm-ci-workflow.mjs"
	, "tests/helpers/recursive-checked-record-rust-ci-workflow.mjs"
	, "tests/helpers/recursive-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/wasmtime-capi-rollout-tests.mjs"
	, "tests/helpers/zero-payload-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/zero-payload-checked-record-perl-ci-workflow.mjs"
	, "tests/helpers/zero-payload-checked-record-wit-ci-workflow.mjs"
	, "tests/workflow-trigger-policy.test.mjs"
]);
export const boundedRecurringAcceptanceSweepIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-fin-direct-ci-tests.mjs"
]);
export const boundedRecurringAcceptanceSweepHistoryAdditions = Object.freeze([
	"scripts/update-bounded-recurring-acceptance-sweep-source-history.mjs"
	, "tests/helpers/bounded-recurring-acceptance-sweep-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	new URL(`../../${boundedRecurringAcceptanceSweepHistoryPath}`
		, import.meta.url), "utf8"
));

/**
 * List every source whose current bytes participate in this transition.
 */
export const boundedRecurringAcceptanceSweepNormalizationPaths = () =>
	Object.freeze([...new Set([
		...record().updates.map(update => update.path)
		, ...record().integrationUpdates.map(update => update.path)
	])]);

const allowedTransitionPath = path =>
	boundedRecurringAcceptanceSweepImplementationPaths.includes(path)
	|| boundedRecurringAcceptanceSweepIntegrationPaths.includes(path);

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseBoundedRecurringAcceptanceSweepUpdate = (source, update) => {
	assert.ok(allowedTransitionPath(update.path), update.path);
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
 * Remove only the authenticated recurring-sweep transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeBoundedRecurringAcceptanceSweepSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	if(!updates.some(update => update.path === path)) return source;
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseBoundedRecurringAcceptanceSweepUpdate(current, update);
	}
	return current;
};
