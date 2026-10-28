/**
 * Authenticate the owned Subtype matrix publication.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedSubtypeMatrixPublicationHistoryPath
	= "docs/evidence/owned-subtype-matrix-publication-source-history-20261025.json";
export const ownedSubtypeMatrixPublicationPredecessor
	= "2b551be77be7638bb7979522c30cbc418800d179";
export const ownedSubtypeMatrixPublicationImplementation
	= "c447fbd2edadda605d98012d15c52550bfc5d2b5";
export const ownedSubtypeMatrixPublicationIntegrationBase
	= "c447fbd2edadda605d98012d15c52550bfc5d2b5";
export const ownedSubtypeMatrixPublicationCommits = Object.freeze([
	"c447fbd2edadda605d98012d15c52550bfc5d2b5"
]);
export const ownedSubtypeMatrixPublicationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedSubtypeMatrixPublicationImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-subtype-promotion-20261023.md"
	, "docs/evidence/owned-subtype-published-matrix-acceptance-20261025.json"
	, "tests/helpers/owned-subtype-published-matrix-tests.mjs"
]);
export const ownedSubtypeMatrixPublicationImplementationPaths = Object.freeze([
	...ownedSubtypeMatrixPublicationChangedPaths
	, ...ownedSubtypeMatrixPublicationImplementationAddedPaths
]);
export const ownedSubtypeMatrixPublicationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedSubtypeMatrixPublicationNormalizationPaths = Object.freeze([
	...ownedSubtypeMatrixPublicationChangedPaths
	, ...ownedSubtypeMatrixPublicationIntegrationPaths
]);
export const ownedSubtypeMatrixPublicationHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-subtype-matrix-publication-source-history.mjs"
	, "tests/helpers/owned-subtype-matrix-publication-source-history-tests.mjs"
	, "tests/helpers/owned-subtype-matrix-publication-source-history.mjs"
]);
export const ownedSubtypeMatrixPublicationAddedPaths = Object.freeze([
	...ownedSubtypeMatrixPublicationImplementationAddedPaths
	, ...ownedSubtypeMatrixPublicationHistoryAddedPaths
]);
export const ownedSubtypeMatrixPublicationPins = Object.freeze([
	Object.freeze({
		path: "docs/consume/c.md"
		, count: 1
		, previousSha256: "3ca3d47ca3c51788d9ec94ba5f41a14bf5dd34e9b23e3d47fc724246047985ff"
		, currentSha256: "279ec116aeb218a90bd0ceee5e095d4646464eebc3abd2035999382ea56b23b0"
	})
	, Object.freeze({
		path: "docs/consume/cpp.md"
		, count: 1
		, previousSha256: "c17271115bc670f643836bcb7289173a5fef1186c14d1ab75ea40639c536371a"
		, currentSha256: "83e3a140faa9ee83374a6fb6333d2d5d23584952e523ff1ce0c6e20bc5f56321"
	})
	, Object.freeze({
		path: "docs/consume/dotnet.md"
		, count: 5
		, previousSha256: "58c3d43b7e61e946386762a2007a4f681dc9b7bf2f59c32e10b90df12e12d1f0"
		, currentSha256: "ded51e955df934508d4b771c828d7754021aa10df039ed311761eebb9edf0917"
	})
	, Object.freeze({
		path: "docs/consume/java.md"
		, count: 5
		, previousSha256: "ea6191fa75426cc95f3768645038d4e049acc18aaa8c91399d36567926a45976"
		, currentSha256: "8ce3dcf20aa8423de1098dc7a81bedfbe2b40027cc201f7b348241faa12c1160"
	})
	, Object.freeze({
		path: "docs/consume/kotlin.md"
		, count: 6
		, previousSha256: "19ab2a19b0a7d8cd3eb76218b528db9153b3b273617a8c3aa059e0c0cc2b5d56"
		, currentSha256: "7c21a25b5492fe5c80339d23582116876221184e214f786137375e8b8cb430cd"
	})
	, Object.freeze({
		path: "docs/consume/perl.md"
		, count: 1
		, previousSha256: "24925f276f4187a75622c50e7965b16de5774535294ef259ba50bb310ffa78f4"
		, currentSha256: "da69fdfb5b1e85e93a5b8a936202d6f46849380ad3b153f99f36325c9335427b"
	})
	, Object.freeze({
		path: "docs/consume/python.md"
		, count: 1
		, previousSha256: "f2b19805b249dab6d81691d3c8a6ac9ddbb6cf3840c0842737d57fbd50debcc4"
		, currentSha256: "6b4b81e9639cb57ab0a5238c1bcba418498ecebc1a58e910592044f63f04bbd5"
	})
	, Object.freeze({
		path: "docs/consume/ruby.md"
		, count: 1
		, previousSha256: "9dde7184e97b9a316a004ceac45f38f33ef7c0a3d130afe16b0d92f027eabc2f"
		, currentSha256: "0d8c8133bc9777717e002393578db4d56e4b4a2cab7d36319e8349ab7e64c60a"
	})
	, Object.freeze({
		path: "docs/consume/rust.md"
		, count: 1
		, previousSha256: "62bd264acdf3d31a832d24decb5c3f72635df0dd7f9f5fde00eefbe97422f15e"
		, currentSha256: "22e213dbe141e2ff99ae8be99db5a8eac012c7ce54295fc9b45aa5249d007260"
	})
	, Object.freeze({
		path: "docs/consume/wit-wasi.md"
		, count: 2
		, previousSha256: "8289583edab34ef75320b8db5e936adef156c86f3d16c17b27b9329a4802d1aa"
		, currentSha256: "7fc695c7ffc7bbdf665a9754435a25ab828c5cfa1b0c77ab1e2a74c8b6e919cd"
	})
	, Object.freeze({
		path: "docs/lean/existing-package.md"
		, count: 18
		, previousSha256: "22f73f360ba0244adb41b53c7f7ee741d5a583c5c12a275cbd06f21563b7f455"
		, currentSha256: "4a3337349ba80b02b76f67784833fea3d800dc6523ace8a614816af72a1be81f"
	})
	, Object.freeze({
		path: "docs/lean/export-decisions.md"
		, count: 22
		, previousSha256: "ba50af0a22c5c3cf5b2df19ebf818111ec20cdc31c5b3586262e4171a676c2e3"
		, currentSha256: "188aa879d25be9d97d8d3b469bfc9b3a28d10b7914bed902da84ff8ff85dffba"
	})
	, Object.freeze({
		path: "docs/php.md"
		, count: 6
		, previousSha256: "1b2cb29b63e93734b794c7d981678200d3c2c670111fe7dbbdfb71b516fceda9"
		, currentSha256: "f81aa0299c0aecbb773ccec45dcb595405febcc0e6c6608abc0fcc7262db048d"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedSubtypeMatrixPublicationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedSubtypeMatrixPublicationUpdate = (
	source, update
) => {
	assert.ok(ownedSubtypeMatrixPublicationNormalizationPaths
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
 * Remove only the exact Owned Subtype matrix publication.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedSubtypeMatrixPublicationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedSubtypeMatrixPublicationNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedSubtypeMatrixPublicationUpdate(current, update);
	}
	return current;
};
