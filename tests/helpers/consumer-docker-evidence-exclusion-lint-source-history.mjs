/**
 * Preserve the Docker evidence-exclusion lint repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerDockerEvidenceExclusionLintHistoryPath
	= "docs/evidence/consumer-docker-evidence-exclusion-lint-source-history-20261031.json";
export const consumerDockerEvidenceExclusionLintPredecessor
	= "0983650a9bd41db3f4d52d64f6297eb6fd89058d";
export const consumerDockerEvidenceExclusionLintImplementation
	= "cf29ece10de8cd905ffa8e12140b9840f95e2ba5";
export const consumerDockerEvidenceExclusionLintImplementationPaths
	= Object.freeze([
		"scripts/update-consumer-docker-evidence-exclusion-source-history.mjs"
		, "tests/docker-consumer-ci.test.mjs"
		, "tests/helpers/consumer-docker-evidence-exclusion-source-history-tests.mjs"
	]);
export const consumerDockerEvidenceExclusionLintIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerDockerEvidenceExclusionLintHistoryAdditions
	= Object.freeze([
		"scripts/update-consumer-docker-evidence-exclusion-lint-source-history.mjs"
		, "tests/helpers/consumer-docker-evidence-exclusion-lint-source-history-tests.mjs"
		, "tests/helpers/consumer-docker-evidence-exclusion-lint-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + consumerDockerEvidenceExclusionLintHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerDockerEvidenceExclusionLintNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerDockerEvidenceExclusionLintImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	consumerDockerEvidenceExclusionLintImplementationPaths.includes(path)
	|| consumerDockerEvidenceExclusionLintIntegrationPaths.includes(path);

/**
 * Reverse one exact lint-only transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseConsumerDockerEvidenceExclusionLintUpdate = (
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
 * Remove only the authenticated lint-only transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeConsumerDockerEvidenceExclusionLintSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerDockerEvidenceExclusionLintNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerDockerEvidenceExclusionLintUpdate(
				current, update);
	}
	return current;
};
