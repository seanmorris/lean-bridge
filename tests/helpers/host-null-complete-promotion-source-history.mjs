/**
 * Preserve the complete hosted HostNull publication transaction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullCompletePromotionHistoryPath
	= "docs/evidence/host-null-complete-promotion-source-history-20261030.json";
export const hostNullCompletePromotionPredecessor
	= "114d249de6e7732316c052b19b0144bcd268a43e";
export const hostNullCompletePromotionImplementation
	= "66d043bdab69a7c5e9636ef0d4e9fa1f1f91c732";
export const hostNullCompletePromotionImplementationPaths = Object.freeze([
	"docs/consume/c.md", "docs/consume/cpp.md", "docs/consume/dotnet.md"
	, "docs/consume/java.md", "docs/consume/kotlin.md"
	, "docs/consume/perl.md", "docs/consume/python.md"
	, "docs/consume/ruby.md", "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md", "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/php.md", "docs/type-surface.v1.json"
	, "scripts/promote-host-null-complete.mjs"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/host-null-complete-documentation-tests.mjs"
	, "tests/helpers/host-null-complete-documentation.mjs"
	, "tests/helpers/host-null-complete-promotion-tests.mjs"
	, "tests/helpers/host-null-complete-promotion-transaction-tests.mjs"
	, "tests/helpers/host-null-complete-promotion.mjs"
	, "tests/helpers/host-null-complete-source-pin-reconciliation-tests.mjs"
	, "tests/helpers/host-null-complete-source-pin-reconciliation.mjs"
]);
export const hostNullCompletePromotionImplementationAdditions = Object.freeze([
	"tests/helpers/host-null-complete-documentation-pin-reconciliation-tests.mjs"
	, "tests/helpers/host-null-complete-documentation-pin-reconciliation.mjs"
]);
export const hostNullCompletePromotionIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullCompletePromotionHistoryAdditions = Object.freeze([
	"scripts/update-host-null-complete-promotion-source-history.mjs"
	, "tests/helpers/host-null-complete-promotion-source-history-tests.mjs"
	, "tests/helpers/host-null-complete-promotion-source-history.mjs"
]);

const historyUrl = new URL(`../../${hostNullCompletePromotionHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const hostNullCompletePromotionNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: hostNullCompletePromotionImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => hostNullCompletePromotionImplementationPaths
	.includes(path) || hostNullCompletePromotionIntegrationPaths.includes(path);

/**
 * Reverse one exact complete HostNull publication transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHostNullCompletePromotionUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove only the authenticated complete HostNull publication.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeHostNullCompletePromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !hostNullCompletePromotionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHostNullCompletePromotionUpdate(current, update);
	}
	return current;
};
