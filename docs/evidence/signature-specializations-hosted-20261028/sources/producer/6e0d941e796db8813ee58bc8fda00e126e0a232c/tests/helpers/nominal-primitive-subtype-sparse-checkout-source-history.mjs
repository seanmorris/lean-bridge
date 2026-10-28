/**
 * Preserve the primitive-base acceptance sparse-checkout milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeSparseCheckoutHistoryPath
	= "docs/evidence/nominal-primitive-subtype-sparse-checkout-source-history-20261026.json";
export const nominalPrimitiveSubtypeSparseCheckoutPredecessor
	= "a6e785dd9961af4d0a68225eb96eff4a8161965f";
export const nominalPrimitiveSubtypeSparseCheckoutImplementation
	= "a937a09921fa099c0d9618468af19d52e58f3666";
export const nominalPrimitiveSubtypeSparseCheckoutWorkflowPaths = Object.freeze([
	".github/workflows/nominal-primitive-subtype-browser.yml"
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
]);
export const nominalPrimitiveSubtypeSparseCheckoutModifiedPaths = Object.freeze([
	...nominalPrimitiveSubtypeSparseCheckoutWorkflowPaths
	, "docs/type-surface.v1.json"
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
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-wit-ci-workflow.mjs"
	, "tests/nominal-primitive-subtype-supplement-ci.test.mjs"
]);
export const nominalPrimitiveSubtypeSparseCheckoutImplementationAdditions
	= Object.freeze([
		"tests/helpers/nominal-primitive-subtype-history-checkout-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-history-checkout.mjs"
	]);
export const nominalPrimitiveSubtypeSparseCheckoutImplementationPaths
	= Object.freeze([
		...nominalPrimitiveSubtypeSparseCheckoutModifiedPaths
		, ...nominalPrimitiveSubtypeSparseCheckoutImplementationAdditions
	]);
export const nominalPrimitiveSubtypeSparseCheckoutIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const nominalPrimitiveSubtypeSparseCheckoutNormalizationPaths
	= Object.freeze([
		...new Set([
			...nominalPrimitiveSubtypeSparseCheckoutModifiedPaths
			, ...nominalPrimitiveSubtypeSparseCheckoutIntegrationPaths
		])
	]);
export const nominalPrimitiveSubtypeSparseCheckoutAddedPaths = Object.freeze([
	"scripts/update-nominal-primitive-subtype-sparse-checkout-source-history.mjs"
	, "tests/helpers/nominal-primitive-subtype-sparse-checkout-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalPrimitiveSubtypeSparseCheckoutHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseNominalPrimitiveSubtypeSparseCheckoutUpdate = (
	source, update
) => {
	assert.ok(nominalPrimitiveSubtypeSparseCheckoutNormalizationPaths
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
 * Remove only the authenticated sparse-checkout milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeNominalPrimitiveSubtypeSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypeSparseCheckoutNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseNominalPrimitiveSubtypeSparseCheckoutUpdate(
			current, update);
	}
	return current;
};
