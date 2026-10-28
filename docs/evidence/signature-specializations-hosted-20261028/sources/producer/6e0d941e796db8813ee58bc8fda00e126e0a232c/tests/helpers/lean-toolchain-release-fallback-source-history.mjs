/**
 * Preserve the checksummed Lean release fallback and its focused contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const leanToolchainReleaseFallbackHistoryPath
	= "docs/evidence/lean-toolchain-release-fallback-source-history-20261028.json";
export const leanToolchainReleaseFallbackPredecessor
	= "e3f88c89a4f9c6c6e6f2ad6b6acc708668a4e343";
export const leanToolchainReleaseFallbackImplementation
	= "5d5ffbc79ea9ca711b4f29622515791b2f7c82f1";
export const leanToolchainReleaseFallbackImplementationPaths = Object.freeze([
	"scripts/bootstrap-toolchains.sh"
	, "tests/performance-ci-report.test.mjs"
]);
export const leanToolchainReleaseFallbackIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const leanToolchainReleaseFallbackAddedPaths = Object.freeze([
	"scripts/update-lean-toolchain-release-fallback-source-history.mjs"
	, "tests/helpers/lean-toolchain-release-fallback-source-history-tests.mjs"
	, "tests/helpers/lean-toolchain-release-fallback-source-history.mjs"
]);
export const leanToolchainReleaseFallbackNormalizationPaths = Object.freeze([
	...leanToolchainReleaseFallbackImplementationPaths
	, ...leanToolchainReleaseFallbackIntegrationPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	leanToolchainReleaseFallbackHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseLeanToolchainReleaseFallbackUpdate = (source, update) => {
	assert.ok(leanToolchainReleaseFallbackNormalizationPaths
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
 * Remove only the authenticated Lean release fallback transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeLeanToolchainReleaseFallbackSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !leanToolchainReleaseFallbackNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseLeanToolchainReleaseFallbackUpdate(current, update);
	}
	return current;
};
