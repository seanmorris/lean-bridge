/**
 * Preserve the workflow-wide Nix consumer source-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerNixSourceClosureAuditHistoryPath
	= "docs/evidence/consumer-nix-source-closure-audit-source-history-20261031.json";
export const consumerNixSourceClosureAuditPredecessor
	= "6581667c0b51e780f48f3a9c7ab8a0158c4fd332";
export const consumerNixSourceClosureAuditImplementation
	= "01004d6e181c3c29a707962c324d52f4762d5860";
export const consumerNixSourceClosureAuditImplementationUpdates
	= Object.freeze([
		".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
		, "tests/docker-consumer-ci.test.mjs"
	]);
export const consumerNixSourceClosureAuditImplementationAdditions
	= Object.freeze(["scripts/check-consumer-source-closure.sh"]);
export const consumerNixSourceClosureAuditIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerNixSourceClosureAuditHistoryAdditions
	= Object.freeze([
		"scripts/update-consumer-nix-source-closure-audit-source-history.mjs"
		, "tests/helpers/consumer-nix-source-closure-audit-source-history-tests.mjs"
		, "tests/helpers/consumer-nix-source-closure-audit-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + consumerNixSourceClosureAuditHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerNixSourceClosureAuditNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerNixSourceClosureAuditImplementationUpdates)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	consumerNixSourceClosureAuditImplementationUpdates.includes(path)
	|| consumerNixSourceClosureAuditIntegrationPaths.includes(path);

/**
 * Reverse one exact source-closure transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseConsumerNixSourceClosureAuditUpdate = (
	source, update
) => {
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
 * Remove only the authenticated workflow-wide source-closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeConsumerNixSourceClosureAuditSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerNixSourceClosureAuditNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerNixSourceClosureAuditUpdate(
				current, update);
	}
	return current;
};
