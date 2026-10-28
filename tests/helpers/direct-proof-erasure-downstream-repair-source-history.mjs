/**
 * Preserve the downstream refinement repairs and their exact source-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureDownstreamRepairHistoryPath
	= "docs/evidence/direct-proof-erasure-downstream-repair-source-history-20261028.json";
export const directProofErasureDownstreamRepairPredecessor
	= "23bd4fc121b3b1abffbe6ac895aa1d06ecb8fe34";
export const directProofErasureDownstreamRepairImplementation
	= "b05ca7bc17a1ab7eff2d96197773ae570aeea59a";
export const directProofErasureDownstreamRepairCommits = Object.freeze([
	"561e61e4da2f12773ace7b2fa5f7a513445030d9"
	, "a478d3e760bb1c10d04355cdc461f443a4612341"
	, directProofErasureDownstreamRepairImplementation
]);
export const directProofErasureDownstreamRepairImplementationPaths
	= Object.freeze([
		".github/workflows/consumer-matrix.yml"
		, "docs/type-surface.v1.json"
		, "src/analyze/elaborated-metadata.mjs"
		, "src/build/component-structured-callable-lean.mjs"
		, "tests/component-structured-callable-lean.test.mjs"
		, "tests/helpers/owned-perl-callback-result-combined-install.mjs"
		, "tests/helpers/owned-perl-callback-result-packaging-tests.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-packaging-tests.mjs"
		, "tests/helpers/php-wasm-refinement-ci-matrix-tests.mjs"
		, "tests/helpers/php-wasm-refinement-ci-matrix.mjs"
		, "tests/helpers/php-wasm-subtype-entry-build.mjs"
		, "tests/helpers/php-wasm-subtype-entry-report.mjs"
		, "tests/helpers/php-wasm-subtype-fixture.mjs"
		, "tests/helpers/php-wasm-subtype-report.mjs"
		, "tests/helpers/reviewed-subtype-installed-fixture.mjs"
		, "tests/helpers/structural-subtype-installed-fixture.mjs"
		, "tests/helpers/subtype-component-packages.mjs"
		, "tests/php-wasm-fin.test.mjs"
		, "tests/unlocked-component.test.mjs"
	]);
export const directProofErasureDownstreamRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const directProofErasureDownstreamRepairNormalizationPaths
	= Object.freeze([
		...directProofErasureDownstreamRepairImplementationPaths
		, ...directProofErasureDownstreamRepairIntegrationPaths
	]);
export const directProofErasureDownstreamRepairAddedPaths
	= Object.freeze([
		"scripts/update-direct-proof-erasure-downstream-repair-source-history.mjs"
		, "tests/helpers/direct-proof-erasure-downstream-repair-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-downstream-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureDownstreamRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated downstream-repair transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and current-side edits.
 */
export const reverseDirectProofErasureDownstreamRepairUpdate
	= (source, update) => {
		assert.ok(directProofErasureDownstreamRepairNormalizationPaths
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
 * Remove only this repair and its newest-first central registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureDownstreamRepairSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !directProofErasureDownstreamRepairNormalizationPaths
				.includes(path)) return source;
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
			current = reverseDirectProofErasureDownstreamRepairUpdate(
				current, update);
		}
		return current;
	};
