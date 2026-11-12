/**
 * Preserve the complete primitive-base sparse-history closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeSparseClosureRepairHistoryPath
	= "docs/evidence/nominal-primitive-subtype-sparse-closure-repair-source-history-20261112.json";
export const nominalPrimitiveSubtypeSparseClosureRepairPredecessor
	= "a37850fde56e80ee54d75e55380de98fa40bbf5f";
export const nominalPrimitiveSubtypeSparseClosureRepairImplementation
	= "49460e3fbeb8f3d8378b02c36f397eb14f216c1c";
export const nominalPrimitiveSubtypeSparseClosureRepairPinRepair
	= "208ea0ee2f89e2334c72ac1046802524959fc4fa";
export const nominalPrimitiveSubtypeSparseClosureRepairWorkflowPaths
	= Object.freeze([
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
export const nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths
	= Object.freeze([
		...nominalPrimitiveSubtypeSparseClosureRepairWorkflowPaths
		, "tests/helpers/nominal-primitive-subtype-history-checkout-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-history-checkout.mjs"
	]);
export const nominalPrimitiveSubtypeSparseClosureRepairPinPaths
	= Object.freeze(["docs/type-surface.v1.json"]);
export const nominalPrimitiveSubtypeSparseClosureRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const nominalPrimitiveSubtypeSparseClosureRepairAddedPaths
	= Object.freeze([
		"scripts/update-nominal-primitive-subtype-sparse-closure-repair-source-history.mjs"
		, "tests/helpers/nominal-primitive-subtype-sparse-closure-repair-source-history-tests.mjs"
		, "tests/helpers/nominal-primitive-subtype-sparse-closure-repair-source-history.mjs"
	]);
export const nominalPrimitiveSubtypeSparseClosureRepairNormalizationPaths
	= Object.freeze([
		...nominalPrimitiveSubtypeSparseClosureRepairImplementationPaths
		, ...nominalPrimitiveSubtypeSparseClosureRepairPinPaths
		, ...nominalPrimitiveSubtypeSparseClosureRepairIntegrationPaths
	]);
export const nominalPrimitiveSubtypeSparseClosureRepairEvidencePaths
	= Object.freeze([
		"docs/evidence/ci-contract-repair-source-history-20261017.json"
		, "docs/evidence/optional-parameter-dispatch-bridge-source-history-20261029.json"
		, "docs/evidence/optional-parameter-focused-ci-source-history-20261029.json"
		, "docs/evidence/optional-parameter-current-line-integration-source-history-20261029.json"
		, "docs/evidence/optional-parameter-source-history-20261028.json"
		, "docs/evidence/core-historical-evidence-reuse-live-pin-repair-source-history-20261027.json"
		, "docs/evidence/core-exact-head-hosted-static-repair-source-history-20261027.json"
		, "docs/evidence/core-exact-head-hosted-replay-repair-source-history-20261027.json"
		, "docs/evidence/core-inherited-record-type-surface-batch-source-history-20261027.json"
		, "docs/evidence/core-recursive-callable-evidence-pin-repair-source-history-20261027.json"
		, "docs/evidence/core-recursive-callable-replay-bound-source-history-20261027.json"
		, "docs/evidence/core-legacy-owned-evidence-replay-bound-source-history-20261027.json"
		, "docs/evidence/core-callback-evidence-replay-bound-source-history-20261027.json"
		, "docs/evidence/core-inherited-record-replay-bound-source-history-20261027.json"
		, "docs/evidence/core-replay-integration-endpoint-repair-source-history-20261027.json"
		, "docs/evidence/core-exact-head-replay-repair-source-history-20261027.json"
		, "docs/evidence/recurring-acceptance-documentation-source-history-20261027.json"
		, "docs/evidence/bounded-recurring-acceptance-sweep-source-history-20261027.json"
		, "docs/evidence/core-exact-head-validation-repair-source-history-20261027.json"
		, "docs/evidence/default-branch-ci-trigger-budget-source-history-20261027.json"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nominalPrimitiveSubtypeSparseClosureRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated sparse-closure transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseNominalPrimitiveSubtypeSparseClosureRepairUpdate
	= (source, update) => {
		assert.ok(nominalPrimitiveSubtypeSparseClosureRepairNormalizationPaths
			.includes(update.path), update.path);
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
 * Remove only the authenticated sparse-closure repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNominalPrimitiveSubtypeSparseClosureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nominalPrimitiveSubtypeSparseClosureRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates, record().updates
	]){
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseNominalPrimitiveSubtypeSparseClosureRepairUpdate(
				current, update);
	}
	return current;
};
