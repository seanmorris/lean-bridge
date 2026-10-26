/**
 * Authenticate canonical publication of the aligned owned checked-record matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedAlignedPublicationHistoryPath
	= "docs/evidence/owned-checked-record-aligned-publication-source-history-20261026.json";
export const ownedCheckedAlignedPublicationPredecessor
	= "893900f481e37b3b8e329f07e106dcc23d38cb8c";
export const ownedCheckedAlignedPublicationImplementation
	= "60eb34279f796d08f1c5f806c0bce664895419de";
export const ownedCheckedAlignedPublicationIntegrationBase
	= "60eb34279f796d08f1c5f806c0bce664895419de";
export const ownedCheckedAlignedPublicationCommits = Object.freeze([
	"47e91bbe8334729de6b4734f9ad8679633af03a4"
	, "60eb34279f796d08f1c5f806c0bce664895419de"
]);
export const ownedCheckedAlignedPublicationChangedPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/perl.md"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/consume/wit-wasi.md"
	, "docs/contributing/testing.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/owned-checked-record-documentation.mjs"
	, "tests/helpers/owned-checked-record-promotion-tests.mjs"
	, "tests/helpers/owned-checked-record-promotion.mjs"
	, "tests/helpers/owned-checked-record-published-matrix-tests.mjs"
]);
export const ownedCheckedAlignedPublicationImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-record-aligned-publication-20261026.json"
	, "docs/evidence/owned-checked-record-promotion-20261026-aligned.md"
]);
export const ownedCheckedAlignedPublicationImplementationPaths = Object.freeze([
	...ownedCheckedAlignedPublicationChangedPaths
	, ...ownedCheckedAlignedPublicationImplementationAddedPaths
]);
export const ownedCheckedAlignedPublicationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedAlignedPublicationNormalizationPaths = Object.freeze([
	...ownedCheckedAlignedPublicationChangedPaths
	, ...ownedCheckedAlignedPublicationIntegrationPaths
]);
export const ownedCheckedAlignedPublicationHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-aligned-publication-source-history.mjs"
	, "tests/helpers/owned-checked-record-aligned-publication-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-aligned-publication-source-history.mjs"
]);
export const ownedCheckedAlignedPublicationAddedPaths = Object.freeze([
	...ownedCheckedAlignedPublicationImplementationAddedPaths
	, ...ownedCheckedAlignedPublicationHistoryAddedPaths
]);
export const ownedCheckedAlignedPublicationPins = Object.freeze([
	Object.freeze({ path: "docs/contributing/testing.md", count: 11, previousSha256: "a86b9930713d226b7cb2b8dc6cef6ba67936fdeba3626c427c51b88dd3e964ad", currentSha256: "1530571f2c11e74a373611c8acba76b4d4c1ec09efbc40d3495327f686087f7a" })
	, Object.freeze({ path: "scripts/generate-type-docs.mjs", count: 129, previousSha256: "92311b9d1695fdb6181461ef41edffa9757df8c64e05d3e4ff50af2bc07eeadf", currentSha256: "53b9b30cc84168656cc19d56e3f28ba4d6b5b55a85fdbab51ba5b40be99ce0ca" })
	, Object.freeze({ path: "tests/helpers/owned-checked-record-documentation.mjs", count: 11, previousSha256: "a5a12a4f74494e1d8763acdbe1f8b6097a21e48c24529e8507657a4c9c294b4e", currentSha256: "21a1470811f3e400eb2e697644c832e911c740ef7d78f6943ca36f9a4e36514c" })
	, Object.freeze({ path: "tests/helpers/owned-checked-record-promotion-tests.mjs", count: 11, previousSha256: "110f77e526558c4feeb4c3afe844d6f63b5120e9de202e7d2fa5f47d3e052200", currentSha256: "8c5d1ad50217f3302018883392aa08704044aa880a2de157f2c1e1776017a2a7" })
	, Object.freeze({ path: "tests/helpers/owned-checked-record-promotion.mjs", count: 11, previousSha256: "e22e5b30baa39fb2c2a38542a45aed63fa3de6aff1912f7ed687ec76f82d87da", currentSha256: "0f408cf25462d16b71dfcab67039f8f877ef3e9fa659130d9a9e503a6a15cc83" })
	, Object.freeze({ path: "tests/helpers/owned-checked-record-published-matrix-tests.mjs", count: 0, previousSha256: "7a239fc5fe0a7c96dc72fe290ceb7a3062139a09dd953cd635aeb83463a975eb", currentSha256: "9ad8e58539a4343760f6cb412dc621e1d85f1b672e11964ea1bceb1d61bae9dc" })
	, Object.freeze({ path: "docs/consume/c.md", count: 1, previousSha256: "279ec116aeb218a90bd0ceee5e095d4646464eebc3abd2035999382ea56b23b0", currentSha256: "c83a611277c2292c350b4ac75dbacf85fd4c399b015c1401e304db1c747d709c" })
	, Object.freeze({ path: "docs/consume/cpp.md", count: 1, previousSha256: "83e3a140faa9ee83374a6fb6333d2d5d23584952e523ff1ce0c6e20bc5f56321", currentSha256: "127d7044d45e47783f790e70df6829068644a4ca5545fbce4d17f5e2aa58c5af" })
	, Object.freeze({ path: "docs/consume/dotnet.md", count: 5, previousSha256: "ded51e955df934508d4b771c828d7754021aa10df039ed311761eebb9edf0917", currentSha256: "62a23b6e6b113012389b42f1b4e65f48e541d787079c2bc6c8df2e083eebd214" })
	, Object.freeze({ path: "docs/consume/java.md", count: 5, previousSha256: "8ce3dcf20aa8423de1098dc7a81bedfbe2b40027cc201f7b348241faa12c1160", currentSha256: "0173c1fc44a698f75989c4624d09ff0795124003d4ec0ebbc01991d434681328" })
	, Object.freeze({ path: "docs/consume/kotlin.md", count: 6, previousSha256: "7c21a25b5492fe5c80339d23582116876221184e214f786137375e8b8cb430cd", currentSha256: "0875ef45fc415e6413411e90d22668091ef58f4a8dd8ac73578bb16c97090fbf" })
	, Object.freeze({ path: "docs/consume/perl.md", count: 1, previousSha256: "da69fdfb5b1e85e93a5b8a936202d6f46849380ad3b153f99f36325c9335427b", currentSha256: "37252bfa2362bc562cb0b256bd5e64df3a99b4c0fa116bba14786d3ce70a6bbb" })
	, Object.freeze({ path: "docs/consume/python.md", count: 1, previousSha256: "6b4b81e9639cb57ab0a5238c1bcba418498ecebc1a58e910592044f63f04bbd5", currentSha256: "f516292d5d72f5466d5863aab92845cd288dce11fc617e086b87bb9bd304177d" })
	, Object.freeze({ path: "docs/consume/ruby.md", count: 1, previousSha256: "0d8c8133bc9777717e002393578db4d56e4b4a2cab7d36319e8349ab7e64c60a", currentSha256: "aa5ac5856564bfe518233aa0b55356e712ed3130c156da736794eb89f13bc7a8" })
	, Object.freeze({ path: "docs/consume/rust.md", count: 1, previousSha256: "22e213dbe141e2ff99ae8be99db5a8eac012c7ce54295fc9b45aa5249d007260", currentSha256: "c9c330b7a90de3499a83910da18a1fd809eac1416c8b9dcaf77406f9b7be70cf" })
	, Object.freeze({ path: "docs/consume/wit-wasi.md", count: 2, previousSha256: "7fc695c7ffc7bbdf665a9754435a25ab828c5cfa1b0c77ab1e2a74c8b6e919cd", currentSha256: "d889bd4f493138856d4a525d17e5276352879fcb10f1539ed9e7eaa026bd5f53" })
	, Object.freeze({ path: "docs/javascript-typescript.md", count: 0, previousSha256: "26fcc38fd6dbb34cc6cdfd8b269e32d715fdfbf9e769da66ba90ca7f3b754780", currentSha256: "77142135cb1d647c1ee56717f6479fa40c15e30365d7497bb6a91abc967f5a03" })
	, Object.freeze({ path: "docs/lean/existing-package.md", count: 18, previousSha256: "4a3337349ba80b02b76f67784833fea3d800dc6523ace8a614816af72a1be81f", currentSha256: "0966a145bd1bdda391e63ca43f3d74aaaab1fcee3bb1cd60dbaa693204f1744d" })
	, Object.freeze({ path: "docs/lean/export-decisions.md", count: 22, previousSha256: "188aa879d25be9d97d8d3b469bfc9b3a28d10b7914bed902da84ff8ff85dffba", currentSha256: "d0fb1f12331a4b4668555fabc48a2d539e3f4175a4803bf06829db82fcbc1e0e" })
	, Object.freeze({ path: "docs/php.md", count: 6, previousSha256: "f81aa0299c0aecbb773ccec45dcb595405febcc0e6c6608abc0fcc7262db048d", currentSha256: "f9fe98890b3d5421c171be5959e9a7197b04ba8d5ee301b03601949af21416a0" })
	, Object.freeze({ path: "docs/reference/types.md", count: 0, previousSha256: "3f4c188132103062e1aaa3cc0775ff7b192c38f55e4f165f3fd8187d0f19f326", currentSha256: "e509605b0a75c8997e7d4f23b1568d0f410ccb99af42d138d07c0aa394b8b3db" })
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedAlignedPublicationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedAlignedPublicationUpdate = (source, update) => {
	assert.ok(ownedCheckedAlignedPublicationNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse only the authenticated aligned publication.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedAlignedPublicationSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ownedCheckedAlignedPublicationNormalizationPaths.includes(path)) return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCheckedAlignedPublicationUpdate(current, update);
	}
	return current;
};
