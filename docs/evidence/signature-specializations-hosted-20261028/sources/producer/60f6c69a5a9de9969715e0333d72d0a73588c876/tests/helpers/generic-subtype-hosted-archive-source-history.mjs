/**
 * Preserve the exact generic-Subtype hosted-archive foundation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeHostedArchiveHistoryPath
	= "docs/evidence/generic-subtype-hosted-archive-source-history-20261023.json";
export const genericSubtypeHostedArchivePredecessor
	= "4164a4fd1cc2e634a5f7e228da29650cba330d94";
export const genericSubtypeHostedArchiveImplementation
	= "ad7f427ec71592ec886f3d3076f6fd163ed266b5";
export const genericSubtypeHostedArchiveCommits = Object.freeze([
	"78e50bc360bb3a7194c625791605340b34819346"
	, genericSubtypeHostedArchiveImplementation
]);
export const genericSubtypeHostedArchiveModifiedPaths = Object.freeze([
	"tests/generic-subtype-native-perl.test.mjs"
]);
export const genericSubtypeHostedArchiveImplementationAddedPaths
	= Object.freeze([
		"scripts/archive-generic-subtype-evidence.mjs"
		, "tests/helpers/generic-subtype-hosted-contract-tests.mjs"
		, "tests/helpers/generic-subtype-hosted-contracts.mjs"
		, "tests/helpers/generic-subtype-hosted-evidence-sources.mjs"
		, "tests/helpers/generic-subtype-hosted-evidence.mjs"
		, "tests/helpers/generic-subtype-hosted-output.mjs"
	]);
export const genericSubtypeHostedArchiveImplementationPaths = Object.freeze([
	...genericSubtypeHostedArchiveModifiedPaths
	, ...genericSubtypeHostedArchiveImplementationAddedPaths
]);
export const genericSubtypeHostedArchiveIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const genericSubtypeHostedArchiveNormalizationPaths = Object.freeze([
	...new Set([
		...genericSubtypeHostedArchiveModifiedPaths
		, ...genericSubtypeHostedArchiveIntegrationPaths
	])
]);
export const genericSubtypeHostedArchiveHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-hosted-archive-source-history.mjs"
	, "tests/helpers/generic-subtype-hosted-archive-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-hosted-archive-source-history.mjs"
]);
export const genericSubtypeHostedArchiveAddedPaths = Object.freeze([
	...genericSubtypeHostedArchiveImplementationAddedPaths
	, ...genericSubtypeHostedArchiveHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeHostedArchiveHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseGenericSubtypeHostedArchiveUpdate = (source, update) => {
	assert.ok(genericSubtypeHostedArchiveNormalizationPaths
		.includes(update.path));
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
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove one recognized generic-Subtype hosted-archive layer.
 *
 * The central source-history hub owns the stopping digest. Once this layer
 * recognizes its current digest it must reverse it unconditionally.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stopping digest owned by the central hub.
 */
export const beforeGenericSubtypeHostedArchiveSource = (
	path, source, expected
) => {
	void expected;
	if(typeof source !== "string"
		|| !genericSubtypeHostedArchiveNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypeHostedArchiveUpdate(source, update);
};
