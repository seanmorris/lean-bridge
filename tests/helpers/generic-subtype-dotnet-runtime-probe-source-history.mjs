/**
 * Preserve the exact generic Subtype .NET runtime probe transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeDotnetRuntimeProbeHistoryPath
	= "docs/evidence/generic-subtype-dotnet-runtime-probe-source-history-20261023.json";
export const genericSubtypeDotnetRuntimeProbePredecessor
	= "23ae28e37befcdf245e94f5f841ed50254fc869c";
export const genericSubtypeDotnetRuntimeProbeImplementation
	= "a032f45a3c86ca84eaedf9ee0a13679a5ebc8532";
export const genericSubtypeDotnetRuntimeProbeIntegrationBase
	= "bdbea979e2c9ffc27b3603c6f3c7f9008f3f5cbd";
export const genericSubtypeDotnetRuntimeProbeApplied
	= "48983aa13ef6852a1866647a1cd4da5293fd56af";
export const genericSubtypeDotnetRuntimeProbeModifiedPaths
	= Object.freeze([
		"tests/fixtures/generic-subtype-consumers/dotnet.cs"
	]);
export const genericSubtypeDotnetRuntimeProbeIntegrationPaths
	= Object.freeze([
		"tests/generic-subtype-managed-wit.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const genericSubtypeDotnetRuntimeProbeNormalizationPaths
	= Object.freeze([...new Set([
		...genericSubtypeDotnetRuntimeProbeModifiedPaths
		, ...genericSubtypeDotnetRuntimeProbeIntegrationPaths
	])]);
export const genericSubtypeDotnetRuntimeProbeAddedPaths
	= Object.freeze([
		"scripts/update-generic-subtype-dotnet-runtime-probe-source-history.mjs"
		, "tests/helpers/generic-subtype-dotnet-runtime-probe-source-history-tests.mjs"
		, "tests/helpers/generic-subtype-dotnet-runtime-probe-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeDotnetRuntimeProbeHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseGenericSubtypeDotnetRuntimeProbeUpdate = (source, update) => {
	assert.ok(genericSubtypeDotnetRuntimeProbeNormalizationPaths.includes(update.path));
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
 * Remove one authenticated transition of this layer. A recognized update is
 * always reversed; the central hub decides where an expected historical
 * digest stops and re-enters for any further transition.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeGenericSubtypeDotnetRuntimeProbeSource = (path, source, expected) => {
	void expected;
	if(typeof source !== "string"
		|| !genericSubtypeDotnetRuntimeProbeNormalizationPaths.includes(path)) return source;
	const value = record();
	const digest = sha256(source);
	const update = [...value.integrationUpdates, ...value.updates].find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseGenericSubtypeDotnetRuntimeProbeUpdate(source, update);
};
