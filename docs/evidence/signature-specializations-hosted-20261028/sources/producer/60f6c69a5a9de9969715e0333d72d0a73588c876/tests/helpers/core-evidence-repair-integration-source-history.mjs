/**
 * Reverse the two-parent integration of historical Core evidence repairs while
 * retaining the independently authenticated documentation and repair histories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreEvidenceRepairIntegrationHistoryPath
	= "docs/evidence/core-evidence-repair-integration-source-history-20261024.json";
export const coreEvidenceRepairIntegrationCommit
	= "60230d8d5ae3fe33084dc1b6d282c525cb74b6b9";
export const coreEvidenceRepairIntegrationLeftParent
	= "89b8bcc6072491094f22b53f826dadcbc246d227";
export const coreEvidenceRepairIntegrationRightParent
	= "da24819c68be266459dfc78b4f3c4cdb8ea2f7b8";
export const coreEvidenceRepairIntegrationChangedPaths = Object.freeze([
	"tests/checked-javascript.test.mjs"
	, "tests/component-structured-callable-evidence.test.mjs"
	, "tests/copied-fixture-source-history.test.mjs"
	, "tests/dotnet-recursive-callable-evidence.test.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-promotion-source-history-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-promotion-source-history-tests.mjs"
	, "tests/helpers/dotnet-recursive-callable-evidence.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/npm-structured-callable-evidence.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-source-history-tests.mjs"
	, "tests/helpers/owned-dotnet-evidence.mjs"
	, "tests/helpers/owned-dotnet-process-evidence.mjs"
	, "tests/helpers/owned-host-evidence.mjs"
	, "tests/helpers/wit-structured-callable-evidence.mjs"
	, "tests/owned-aggregate-evidence.test.mjs"
	, "tests/owned-analysis-evidence.test.mjs"
	, "tests/owned-callback-result-history.test.mjs"
	, "tests/owned-cpp-callback-result-history.test.mjs"
	, "tests/owned-dotnet-evidence.test.mjs"
	, "tests/owned-dotnet-process-evidence.test.mjs"
	, "tests/owned-host-evidence.test.mjs"
	, "tests/owned-javascript-npm-evidence.test.mjs"
	, "tests/owned-javascript-publication-evidence.test.mjs"
	, "tests/owned-javascript-transfer-evidence.test.mjs"
	, "tests/owned-perl-package-evidence.test.mjs"
	, "tests/owned-ruby-callback-result-history.test.mjs"
	, "tests/owned-rust-callback-result-history.test.mjs"
	, "tests/owned-wasm32-evidence.test.mjs"
	, "tests/owned-zend-bailout-repair.test.mjs"
	, "tests/ruby-structured-callable-evidence.test.mjs"
	, "tests/wit-structured-callable-evidence.test.mjs"
]);
// These left-parent files did not change in the merge. Their existing receipt
// already supplies the exact right-parent route, including the large inventory.
export const coreEvidenceRepairIntegrationRetainedPaths = Object.freeze([
	"docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/lean-author-documentation.test.mjs"
]);
export const coreEvidenceRepairIntegrationRetainedHistoryPath
	= "docs/evidence/author-refinement-guidance-repair-source-history-20261024.json";
export const coreEvidenceRepairIntegrationAddedPaths = Object.freeze([
	"scripts/update-core-evidence-repair-integration-source-history.mjs"
	, "tests/helpers/core-evidence-repair-integration-source-history-tests.mjs"
	, "tests/helpers/core-evidence-repair-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreEvidenceRepairIntegrationHistoryPath, "utf8"
));

/**
 * Restore one exact parent of the reconciled evidence source.
 *
 * @param source - Complete reconciled source.
 * @param update - Exact two-parent transition.
 * @param parent - Parent route to restore.
 */
export const reverseCoreEvidenceRepairIntegrationUpdate = (
	source, update, parent
) => {
	assert.ok(coreEvidenceRepairIntegrationChangedPaths.includes(update.path));
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
export const beforeCoreEvidenceRepairIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreEvidenceRepairIntegrationChangedPaths.includes(path))
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
	return reverseCoreEvidenceRepairIntegrationUpdate(
		source, update, parent
	);
};
