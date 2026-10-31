/**
 * Preserve the evidence-free Docker consumer source repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerDockerEvidenceExclusionHistoryPath
	= "docs/evidence/consumer-docker-evidence-exclusion-source-history-20261031.json";
export const consumerDockerEvidenceExclusionPredecessor
	= "2c6f762125be5fd3e66f35ce6d0caa93ef22ea49";
export const consumerDockerEvidenceExclusionImplementation
	= "83f380aa83596f083eed3303da7ce4021f0ddc62";
export const consumerDockerEvidenceExclusionImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"
		, "scripts/test-docker-consumer-ci.sh"
		, "tests/docker-consumer-ci.test.mjs"
	]);
export const consumerDockerEvidenceExclusionIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerDockerEvidenceExclusionHistoryAdditions
	= Object.freeze([
		"scripts/update-consumer-docker-evidence-exclusion-source-history.mjs"
		, "tests/helpers/consumer-docker-evidence-exclusion-source-history-tests.mjs"
		, "tests/helpers/consumer-docker-evidence-exclusion-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + consumerDockerEvidenceExclusionHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerDockerEvidenceExclusionNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerDockerEvidenceExclusionImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => consumerDockerEvidenceExclusionImplementationPaths
	.includes(path) || consumerDockerEvidenceExclusionIntegrationPaths
	.includes(path);

/**
 * Reverse one exact evidence-exclusion transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseConsumerDockerEvidenceExclusionUpdate = (
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
 * Remove only the authenticated evidence-exclusion transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeConsumerDockerEvidenceExclusionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerDockerEvidenceExclusionNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerDockerEvidenceExclusionUpdate(
				current, update);
	}
	return current;
};
