/**
 * Preserve the direct proof-erasure Core lint repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const proofErasureCoreLintRepairHistoryPath
	= "docs/evidence/proof-erasure-core-lint-repair-source-history-20261029.json";
export const proofErasureCoreLintRepairPredecessor
	= "7f206cdbf35d650c48917572e6344fdc0194aeb7";
export const proofErasureCoreLintRepairImplementation
	= "eb1abb2e29e7a614c61f7e592f8e32fb7599c683";
export const proofErasureCoreLintRepairImplementationPaths = Object.freeze([
	"tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"
	, "tests/helpers/direct-proof-erasure-matrix-receipt-tests.mjs"
]);
export const proofErasureCoreLintRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/dependent-signature-producer-concurrency-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const proofErasureCoreLintRepairHistoryAdditions = Object.freeze([
	"scripts/update-proof-erasure-core-lint-repair-source-history.mjs"
	, "tests/helpers/proof-erasure-core-lint-repair-source-history-tests.mjs"
	, "tests/helpers/proof-erasure-core-lint-repair-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${proofErasureCoreLintRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const proofErasureCoreLintRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: proofErasureCoreLintRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	proofErasureCoreLintRepairImplementationPaths.includes(path)
	|| proofErasureCoreLintRepairIntegrationPaths.includes(path);

/**
 * Reverse one authenticated lint-repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 */
export const reverseProofErasureCoreLintRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
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
 * Remove only the authenticated proof-erasure Core lint repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeProofErasureCoreLintRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !proofErasureCoreLintRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseProofErasureCoreLintRepairUpdate(current, update);
	}
	return current;
};
