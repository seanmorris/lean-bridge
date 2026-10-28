/**
 * Preserve the shard-scoped Core evidence-checkout milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreContractEvidenceCheckoutHistoryPath
	= "docs/evidence/core-contract-evidence-checkout-source-history-20261026.json";
export const coreContractEvidenceCheckoutPredecessor
	= "eed699f87bef4a8ec552d9dd01bf6d853418f3f2";
export const coreContractEvidenceCheckoutImplementation
	= "ee99d0b30784e0402d59eaa7d326865d98d59051";
export const coreContractEvidenceCheckoutWorkflowPaths = Object.freeze([
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
export const coreContractEvidenceCheckoutModifiedPaths = Object.freeze([
	...coreContractEvidenceCheckoutWorkflowPaths
	, ".github/workflows/quality.yml"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-history-checkout.mjs"
	, "tests/owned-checked-record-hosted-evidence.test.mjs"
]);
export const coreContractEvidenceCheckoutImplementationAdditions
	= Object.freeze([
		"scripts/core-contract-evidence.mjs"
		, "scripts/materialize-core-contract-evidence.mjs"
		, ...Array.from({ length: 12 }, (_, index) =>
			`tests/checked-javascript-partition-${String(index + 1)
				.padStart(2, "0")}.test.mjs`)
		, "tests/helpers/core-contract-evidence-tests.mjs"
		, "tests/helpers/owned-checked-record-hosted-replay-tests.mjs"
		, ...[
			"dotnet", "javascript", "jvm", "native", "perl", "php-wasm"
			, "php", "python", "ruby", "rust", "wit"
		].map(lane =>
			`tests/owned-checked-record-hosted-evidence-${lane}.test.mjs`)
	]);
export const coreContractEvidenceCheckoutImplementationPaths = Object.freeze([
	...coreContractEvidenceCheckoutModifiedPaths
	, ...coreContractEvidenceCheckoutImplementationAdditions
]);
export const coreContractEvidenceCheckoutIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreContractEvidenceCheckoutNormalizationPaths = Object.freeze([
	...new Set([
		...coreContractEvidenceCheckoutModifiedPaths
		, ...coreContractEvidenceCheckoutIntegrationPaths
	])
]);
export const coreContractEvidenceCheckoutAddedPaths = Object.freeze([
	"scripts/update-core-contract-evidence-checkout-source-history.mjs"
	, "tests/helpers/core-contract-evidence-checkout-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreContractEvidenceCheckoutHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreContractEvidenceCheckoutUpdate = (source, update) => {
	assert.ok(coreContractEvidenceCheckoutNormalizationPaths
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
 * Remove only the authenticated shard-scoped evidence-checkout milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreContractEvidenceCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreContractEvidenceCheckoutNormalizationPaths.includes(path))
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
		current = reverseCoreContractEvidenceCheckoutUpdate(current, update);
	}
	return current;
};
