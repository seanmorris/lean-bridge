/**
 * Preserve the exact direct proof-erasure test-profile registration and its
 * type-surface pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureTestRegistrationHistoryPath
	= "docs/evidence/direct-proof-erasure-test-registration-source-history-20261028.json";
export const directProofErasureTestRegistrationPredecessor
	= "8fadd04d8b5de9a85d02864b154d8cc2dd41198b";
export const directProofErasureTestRegistrationImplementation
	= "5f3b8768ab7687e9af84044b1621d8f802ac2f35";
export const directProofErasureTestRegistrationCommits = Object.freeze([
	directProofErasureTestRegistrationImplementation
]);
export const directProofErasureTestRegistrationTypeSurfacePath
	= "docs/type-surface.v1.json";
export const directProofErasureTestRegistrationProfilePath
	= "src/adoption/test-profiles.mjs";
export const directProofErasureTestRegistrationPinCount = 98;
export const directProofErasureTestRegistrationAddedTests = Object.freeze([
	"direct-proof-erasure"
	, "direct-proof-erasure-language-installed"
	, "direct-proof-erasure-managed-installed"
	, "direct-proof-erasure-native-installed"
	, "direct-proof-erasure-npm-installed"
	, "direct-proof-erasure-php-installed"
	, "direct-proof-erasure-wit-installed"
]);
export const directProofErasureTestRegistrationImplementationPaths
	= Object.freeze([
		directProofErasureTestRegistrationTypeSurfacePath
		, directProofErasureTestRegistrationProfilePath
	]);
export const directProofErasureTestRegistrationIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
		, "tests/helpers/proof-erasure-wit-lint-join-source-history-tests.mjs"
	]);
export const directProofErasureTestRegistrationNormalizationPaths
	= Object.freeze([
		...directProofErasureTestRegistrationImplementationPaths
		, ...directProofErasureTestRegistrationIntegrationPaths
	]);
export const directProofErasureTestRegistrationAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-test-registration-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-test-registration-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-test-registration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureTestRegistrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and current-side edits.
 */
export const reverseDirectProofErasureTestRegistrationUpdate
	= (source, update) => {
		assert.ok(directProofErasureTestRegistrationNormalizationPaths
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
 * Remove only the recognized registration, pin refresh and history wiring.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureTestRegistrationSource
	= (path, source, expected) => {
		if(typeof source !== "string"
			|| !directProofErasureTestRegistrationNormalizationPaths.includes(path))
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
			current = reverseDirectProofErasureTestRegistrationUpdate(
				current, update);
		}
		return current;
	};
