/**
 * Preserve the bounded Docker consumer source-closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerDockerSourceClosureHistoryPath
	= "docs/evidence/consumer-docker-source-closure-source-history-20261031.json";
export const consumerDockerSourceClosurePredecessor
	= "a1ff4d73b3f522c44058af313f62192b762d6579";
export const consumerDockerSourceClosureImplementation
	= "dde52906c114db89e7d3c9e0a127fdf00c632732";
export const consumerDockerSourceClosureImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
	, "tests/documentation.test.mjs"
	, "tests/helpers/core-final-test-registration-source-history-tests.mjs"
	, "tests/helpers/core-php-ci-input-repair-source-history-tests.mjs"
	, "tests/helpers/dependent-fin-compiler-contract-repair-source-history-tests.mjs"
	, "tests/helpers/proof-erasure-evidence-audit-tests.mjs"
]);
export const consumerDockerSourceClosureImplementationAdditions
	= Object.freeze([
		"scripts/refresh-consumer-docker-source-closure-pins.mjs"
	]);
export const consumerDockerSourceClosureIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const consumerDockerSourceClosureHistoryAdditions = Object.freeze([
	"scripts/update-consumer-docker-source-closure-source-history.mjs"
	, "tests/helpers/consumer-docker-source-closure-source-history-tests.mjs"
	, "tests/helpers/consumer-docker-source-closure-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + consumerDockerSourceClosureHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerDockerSourceClosureNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerDockerSourceClosureImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => consumerDockerSourceClosureImplementationPaths
	.includes(path) || consumerDockerSourceClosureIntegrationPaths.includes(path);

/**
 * Reverse one exact Docker source-closure transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseConsumerDockerSourceClosureUpdate = (source, update) => {
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
 * Remove only the authenticated Docker source-closure transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeConsumerDockerSourceClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerDockerSourceClosureNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerDockerSourceClosureUpdate(current, update);
	}
	return current;
};
