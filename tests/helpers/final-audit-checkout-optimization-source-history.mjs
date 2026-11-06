/**
 * Preserve the final optional-parameter and value-index audit checkout
 * optimizations without changing their retained evidence or support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finalAuditCheckoutOptimizationHistoryPath
	= "docs/evidence/final-audit-checkout-optimization-source-history-20261106.json";
export const finalAuditCheckoutOptimizationPredecessor
	= "b9264805cd5d07fcd59e8e3da1bd1ba9691e2d64";
export const finalAuditCheckoutOptimizationOptionalImplementation
	= "48d87f850f105a62e62de8d0063b24e1c3466d2f";
export const finalAuditCheckoutOptimizationValueIndexImplementation
	= "7ecd1825af8000705c8c521e8a2635a2cfdf398e";
export const finalAuditCheckoutOptimizationPinRefresh
	= "14162831a52c53d9bde88457a01617cd8660789b";
export const finalAuditCheckoutOptimizationCurrentSources = Object.freeze([
	".github/workflows/checked-record-value-index-matrix.yml"
	, ".github/workflows/optional-parameter-complete.yml"
	, "tests/checked-record-value-index-matrix.test.mjs"
	, "tests/helpers/optional-parameter-complete-ci-tests.mjs"
]);
export const finalAuditCheckoutOptimizationImplementationAdditions
	= Object.freeze([
		"tests/helpers/checked-record-value-index-matrix-ci-tests.mjs"
		, "tests/helpers/checked-record-value-index-matrix-ci.mjs"
	]);
export const finalAuditCheckoutOptimizationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/complete-current-source-pin-preflight-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const finalAuditCheckoutOptimizationHistoryAdditions = Object.freeze([
	"scripts/update-final-audit-checkout-optimization-source-history.mjs"
	, "tests/helpers/final-audit-checkout-optimization-source-history-tests.mjs"
	, "tests/helpers/final-audit-checkout-optimization-source-history.mjs"
]);
export const finalAuditCheckoutOptimizationNormalizationPaths
	= Object.freeze([...new Set([
		...finalAuditCheckoutOptimizationCurrentSources
		, ...finalAuditCheckoutOptimizationIntegrationPaths
		, "docs/type-surface.v1.json"
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	finalAuditCheckoutOptimizationHistoryPath, "utf8"));

/**
 * Reverse one authenticated source transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseFinalAuditCheckoutOptimizationUpdate = (
	source, update
) => {
	assert.ok(finalAuditCheckoutOptimizationNormalizationPaths
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
 * Remove integration, pin-refresh and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeFinalAuditCheckoutOptimizationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !finalAuditCheckoutOptimizationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates
		, record().implementationUpdates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseFinalAuditCheckoutOptimizationUpdate(current, update);
	}
	return current;
};
