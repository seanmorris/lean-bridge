/**
 * Preserve the exact Perl dependent-refinement rejection correction and its
 * newest-first source-history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlDependentRefinementRejectionHistoryPath
	= "docs/evidence/perl-dependent-refinement-rejection-source-history-20261028.json";
export const perlDependentRefinementRejectionPredecessor
	= "2fd3eda834f1292e8b59cfcd75473214b166b36e";
export const perlDependentRefinementRejectionImplementation
	= "d534d66bd7bc351dd7bb17fd6e9dfe2c04c83164";
export const perlDependentRefinementRejectionCommits = Object.freeze([
	perlDependentRefinementRejectionImplementation
]);
export const perlDependentRefinementRejectionTypeSurfacePath
	= "docs/type-surface.v1.json";
export const perlDependentRefinementRejectionTestPath
	= "tests/perl-native.test.mjs";
export const perlDependentRefinementRejectionPinCount = 2;
export const perlDependentRefinementRejectionImplementationPaths
	= Object.freeze([
		perlDependentRefinementRejectionTypeSurfacePath
		, perlDependentRefinementRejectionTestPath
	]);
export const perlDependentRefinementRejectionIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const perlDependentRefinementRejectionNormalizationPaths
	= Object.freeze([
		...new Set([
			...perlDependentRefinementRejectionImplementationPaths
			, ...perlDependentRefinementRejectionIntegrationPaths
		])
	]);
export const perlDependentRefinementRejectionAddedPaths = Object.freeze([
	"scripts/update-perl-dependent-refinement-rejection-source-history.mjs"
	, "tests/helpers/perl-dependent-refinement-rejection-source-history-tests.mjs"
	, "tests/helpers/perl-dependent-refinement-rejection-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	perlDependentRefinementRejectionHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and current-side edits.
 */
export const reversePerlDependentRefinementRejectionUpdate
	= (source, update) => {
		assert.ok(perlDependentRefinementRejectionNormalizationPaths
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
 * Remove only the recognized Perl correction and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforePerlDependentRefinementRejectionSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !perlDependentRefinementRejectionNormalizationPaths.includes(path))
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
			current = reversePerlDependentRefinementRejectionUpdate(
				current, update);
		}
		return current;
	};
