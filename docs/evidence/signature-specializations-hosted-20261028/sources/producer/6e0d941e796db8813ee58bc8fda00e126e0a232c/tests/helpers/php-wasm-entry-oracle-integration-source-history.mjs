/**
 * Reverse the two-parent integration of the compiler-derived PHP-Wasm entry
 * oracle while retaining both authenticated repair histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryOracleIntegrationHistoryPath
	= "docs/evidence/php-wasm-entry-oracle-integration-source-history-20261024.json";
export const phpWasmEntryOracleIntegrationCommit
	= "65784039faaa8eff8ac38b274687c4dccad34120";
export const phpWasmEntryOracleIntegrationLeftParent
	= "5f73aa43d0c1e958a3fe70cf48493f542096d214";
export const phpWasmEntryOracleIntegrationRightParent
	= "e2dc67babe104bbdaf98174dbd9966492056b643";
export const phpWasmEntryOracleIntegrationChangedPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/fixtures/php-wasm-refinement-entry/nominal-result-only.php"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-entry-call-targets.mjs"
	, "tests/helpers/php-wasm-entry-probe-deployment-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-callers-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report.mjs"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
]);
export const phpWasmEntryOracleIntegrationAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-oracle-integration-source-history.mjs"
	, "tests/helpers/php-wasm-entry-oracle-integration-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-oracle-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryOracleIntegrationHistoryPath, "utf8"
));

/**
 * Restore one exact parent of the reconciled entry-oracle source.
 *
 * @param source - Complete reconciled source.
 * @param update - Exact two-parent transition.
 * @param parent - Parent route to restore.
 */
export const reversePhpWasmEntryOracleIntegrationUpdate = (
	source, update, parent
) => {
	assert.ok(phpWasmEntryOracleIntegrationChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(["left", "right"].includes(parent));
	const endpoint = update[parent];
	assert.deepEqual(Object.keys(endpoint).sort()
		, ["edits", "previousSha256"]);
	assert.ok(Array.isArray(endpoint.edits));
	if(endpoint.previousSha256 === update.currentSha256)
	{
		assert.deepEqual(endpoint.edits, []);
		return source;
	}
	assert.ok(endpoint.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of endpoint.edits)
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
	assert.equal(sha256(previous), endpoint.previousSha256, update.path);
	return previous;
};

/**
 * Remove the merge reconciliation through the parent that owns the requested
 * historical digest. Digests shared before the fork use the ordered parent.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryOracleIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryOracleIntegrationChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	if(!update) return source;
	assert.ok(Array.isArray(update.rightExpectedSha256));
	const parent = expected === update.left.previousSha256
		? "left"
		: expected === update.right.previousSha256
			? "right"
			: update.rightExpectedSha256.includes(expected)
				? "right" : "left";
	return reversePhpWasmEntryOracleIntegrationUpdate(
		source, update, parent
	);
};
