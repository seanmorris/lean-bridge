/**
 * Preserve the complete history-hub fixed-point repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoryHubFixedPointHistoryPath
	= "docs/evidence/core-history-hub-fixed-point-source-history-20261031.json";
export const coreHistoryHubFixedPointPredecessor
	= "2acd7f6ddbf7b775384a028952e8beb1fea3007e";
export const coreHistoryHubFixedPointImplementation
	= "40f0ca02accfda7a815137b81bf6d197b0bf2572";
export const coreHistoryHubFixedPointImplementationPaths = Object.freeze([
	"tests/helpers/callback-code-ci-repair-source-history-tests.mjs"
	, "tests/helpers/closure-history-ci-repair-source-history-tests.mjs"
	, "tests/helpers/core-final-audit-normalization-source-history-tests.mjs"
	, "tests/helpers/fin-product-arrays-source-history-tests.mjs"
	, "tests/helpers/fin-products-ci-source-history-tests.mjs"
	, "tests/helpers/fin-products-floors-source-history-tests.mjs"
	, "tests/helpers/fin-record-wit-format-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/fin-wit-archive-source-history-tests.mjs"
	, "tests/helpers/native-fin-callback-admission-source-history-tests.mjs"
	, "tests/helpers/native-fin-callback-archive-source-history-tests.mjs"
	, "tests/helpers/native-fin-records-source-history-tests.mjs"
	, "tests/helpers/native-fin-reply-archive-source-history-tests.mjs"
	, "tests/helpers/native-fin-reply-promotion-source-history-tests.mjs"
	, "tests/helpers/native-fin-reply-source-history-tests.mjs"
	, "tests/helpers/native-reply-refusal-source-history-tests.mjs"
	, "tests/helpers/native-reply-review-source-history-tests.mjs"
	, "tests/helpers/native-reply-symbol-fix-source-history-tests.mjs"
	, "tests/helpers/perl-fin-archive-source-history-tests.mjs"
	, "tests/helpers/perl-fin-xs-audit-source-history-tests.mjs"
	, "tests/helpers/perl-relocated-consumer-source-history-tests.mjs"
	, "tests/helpers/reviewed-api-promotion-source-history-tests.mjs"
	, "tests/helpers/reviewed-instantiation-archive-source-history-tests.mjs"
	, "tests/helpers/reviewed-instantiation-source-history-tests.mjs"
	, "tests/helpers/reviewed-npm-snapshot-source-history-tests.mjs"
	, "tests/helpers/reviewed-specialization-admission-source-history-tests.mjs"
	, "tests/helpers/reviewed-specialization-archive-source-history-tests.mjs"
	, "tests/helpers/reviewed-specialization-ci-hotfix-source-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-archive-source-history-tests.mjs"
	, "tests/helpers/reviewed-subtype-harness-source-history-tests.mjs"
]);
export const coreHistoryHubFixedPointIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreHistoryHubFixedPointHistoryAdditions = Object.freeze([
	"scripts/update-core-history-hub-fixed-point-source-history.mjs"
	, "tests/helpers/core-history-hub-fixed-point-source-history-tests.mjs"
	, "tests/helpers/core-history-hub-fixed-point-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + coreHistoryHubFixedPointHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const coreHistoryHubFixedPointNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: coreHistoryHubFixedPointImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => coreHistoryHubFixedPointImplementationPaths
	.includes(path) || coreHistoryHubFixedPointIntegrationPaths.includes(path);

/**
 * Reverse one exact history-hub transition.
 *
 * @param source - Current source text.
 * @param update - Authenticated reversible transition.
 */
export const reverseCoreHistoryHubFixedPointUpdate = (source, update) => {
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
 * Remove only the authenticated history-hub fixed-point transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Current source text.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCoreHistoryHubFixedPointSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoryHubFixedPointNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCoreHistoryHubFixedPointUpdate(current, update);
	}
	return current;
};
