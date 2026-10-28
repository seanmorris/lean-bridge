/**
 * Authenticate the complete owned matrix evidence and documentation refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedMatrixRefreshHistoryPath
	= "docs/evidence/owned-matrix-refresh-source-history-20261025.json";
export const ownedMatrixRefreshPredecessor
	= "b9d158f03ffc5316fc1c977d39c9aeeddef77188";
export const ownedMatrixRefreshImplementation
	= "ceeead2d6ea88cfee078075bdf0a96e432c4e914";
export const ownedMatrixRefreshIntegrationBase
	= "ceeead2d6ea88cfee078075bdf0a96e432c4e914";
export const ownedMatrixRefreshCommits = Object.freeze([
	"84390cb492a71e94232d9fc7ee689e8246dbd7dc"
	, "ceeead2d6ea88cfee078075bdf0a96e432c4e914"
]);
export const ownedMatrixRefreshChangedPaths = Object.freeze([
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
	, "tests/helpers/type-surface-promotion-io-tests.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
]);
export const ownedMatrixRefreshImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-record-matrix-v2-publication-20261025.json"
	, "docs/evidence/owned-checked-record-promotion-20261025.md"
	, "scripts/refresh-owned-checked-record-evidence.mjs"
]);
export const ownedMatrixRefreshImplementationPaths = Object.freeze([
	...ownedMatrixRefreshChangedPaths
	, ...ownedMatrixRefreshImplementationAddedPaths
]);
export const ownedMatrixRefreshIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedMatrixRefreshNormalizationPaths = Object.freeze([
	...ownedMatrixRefreshChangedPaths
	, ...ownedMatrixRefreshIntegrationPaths
]);
export const ownedMatrixRefreshHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-matrix-refresh-source-history.mjs"
	, "tests/helpers/owned-matrix-refresh-source-history-tests.mjs"
	, "tests/helpers/owned-matrix-refresh-source-history.mjs"
]);
export const ownedMatrixRefreshAddedPaths = Object.freeze([
	...ownedMatrixRefreshImplementationAddedPaths
	, ...ownedMatrixRefreshHistoryAddedPaths
]);
export const ownedMatrixRefreshPins = Object.freeze([
	Object.freeze({
		path: "docs/consume/c.md"
		, count: 1, alreadyCurrent: 0
		, previousSha256: "4676474c965da41bc8cb538d23d7fe8f79753a6004e45cc80d80bfe0552557ff"
		, currentSha256: "3ca3d47ca3c51788d9ec94ba5f41a14bf5dd34e9b23e3d47fc724246047985ff"
	})
	, Object.freeze({
		path: "docs/consume/cpp.md"
		, count: 1, alreadyCurrent: 0
		, previousSha256: "faa7d09034465d9861601c6780e032d914bc701c198663d897b4786959a81a09"
		, currentSha256: "c17271115bc670f643836bcb7289173a5fef1186c14d1ab75ea40639c536371a"
	})
	, Object.freeze({
		path: "docs/consume/dotnet.md"
		, count: 5, alreadyCurrent: 0
		, previousSha256: "204a4233e8ab45e41df3d72ba391fb8414da6700e6078299d5dd0477c6792ffb"
		, currentSha256: "58c3d43b7e61e946386762a2007a4f681dc9b7bf2f59c32e10b90df12e12d1f0"
	})
	, Object.freeze({
		path: "docs/consume/java.md"
		, count: 5, alreadyCurrent: 0
		, previousSha256: "b1feee04d18e4ede9bc1298e7f908f930bb4d0538b4cd88ec88ca60467e7cd4b"
		, currentSha256: "ea6191fa75426cc95f3768645038d4e049acc18aaa8c91399d36567926a45976"
	})
	, Object.freeze({
		path: "docs/consume/kotlin.md"
		, count: 6, alreadyCurrent: 0
		, previousSha256: "6e2b14a42e08345ee5724d1faf77f05d44250f0034caadd0e2a8f745e598f911"
		, currentSha256: "19ab2a19b0a7d8cd3eb76218b528db9153b3b273617a8c3aa059e0c0cc2b5d56"
	})
	, Object.freeze({
		path: "docs/consume/perl.md"
		, count: 1, alreadyCurrent: 0
		, previousSha256: "bae96fd3215f1c800cbb8beec4f0a09a99db10c6707e983fabaf9eebc9065861"
		, currentSha256: "24925f276f4187a75622c50e7965b16de5774535294ef259ba50bb310ffa78f4"
	})
	, Object.freeze({
		path: "docs/consume/python.md"
		, count: 1, alreadyCurrent: 0
		, previousSha256: "8bf30095de92afe4fd510e3b154cc5c3189e5955e61f255e0240e4cbc79862cc"
		, currentSha256: "f2b19805b249dab6d81691d3c8a6ac9ddbb6cf3840c0842737d57fbd50debcc4"
	})
	, Object.freeze({
		path: "docs/consume/ruby.md"
		, count: 1, alreadyCurrent: 0
		, previousSha256: "360e7f03a26df43e98b4b10763e491fb22fa1f600a83c0cb8d83b31781a2d79a"
		, currentSha256: "9dde7184e97b9a316a004ceac45f38f33ef7c0a3d130afe16b0d92f027eabc2f"
	})
	, Object.freeze({
		path: "docs/consume/rust.md"
		, count: 1, alreadyCurrent: 0
		, previousSha256: "ee787dabe61671df8e0025ecd639a01fbba5f8756325d5f3ff5d2e9130072f90"
		, currentSha256: "62bd264acdf3d31a832d24decb5c3f72635df0dd7f9f5fde00eefbe97422f15e"
	})
	, Object.freeze({
		path: "docs/consume/wit-wasi.md"
		, count: 2, alreadyCurrent: 0
		, previousSha256: "8f27942dd838768f424c2dd7ada7afebf6e651a55e32c225b0a3280a0b340893"
		, currentSha256: "602faa0bf52394d661fd21c5af1c403515dc93b387e08d0e7d4453a12481b20a"
	})
	, Object.freeze({
		path: "docs/javascript-typescript.md"
		, count: 0, alreadyCurrent: 0
		, previousSha256: "7a4ed8c67a792af19f53578da94939a1607d57b54fcae73806115aa8238e3752"
		, currentSha256: "36eba591463101f46e776d1fbb393ed88aa1d48f96b28d85fe735d371ea8bfbf"
	})
	, Object.freeze({
		path: "docs/lean/existing-package.md"
		, count: 18, alreadyCurrent: 0
		, previousSha256: "6f2c73fb18712ee023f122375f20c425d84d2bde39fec106003942d8f0be9f8d"
		, currentSha256: "22f73f360ba0244adb41b53c7f7ee741d5a583c5c12a275cbd06f21563b7f455"
	})
	, Object.freeze({
		path: "docs/lean/export-decisions.md"
		, count: 22, alreadyCurrent: 0
		, previousSha256: "99cef3dc3654c7f13b18f3b5509c12bdb3e3722a26361181ac6b8b480bb730da"
		, currentSha256: "ba50af0a22c5c3cf5b2df19ebf818111ec20cdc31c5b3586262e4171a676c2e3"
	})
	, Object.freeze({
		path: "docs/php.md"
		, count: 6, alreadyCurrent: 0
		, previousSha256: "e16ef39494f582377027c07204be4ac60d5f111f43dd2a04d8f2a0b2e2f74ae8"
		, currentSha256: "1b2cb29b63e93734b794c7d981678200d3c2c670111fe7dbbdfb71b516fceda9"
	})
	, Object.freeze({
		path: "docs/reference/types.md"
		, count: 0, alreadyCurrent: 0
		, previousSha256: "5c557be1a574b299e591210822466c47d58b4bd9ea4db854e2db3b2b20891470"
		, currentSha256: "972c3e9ca8a463a822d4d437fd646784a58c9a24ad28971bf9b5ed3bbf99b88b"
	})
	, Object.freeze({
		path: "scripts/generate-type-docs.mjs"
		, count: 110, alreadyCurrent: 11
		, previousSha256: "baefd01b62e6472fb758391fdf768a10b5755b9b3e90283dd99eeaccc9d55759"
		, currentSha256: "5e2b3b19bcc541ced724b1dbf5a0ed371afc1c9ca0d8d5987548c5a06efb01e3"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-documentation.mjs"
		, count: 0, alreadyCurrent: 11
		, previousSha256: "7bdc1f987b511b227a922e5db3c3a8ac4bb2b0a71a458837063416558c5f4927"
		, currentSha256: "a5a12a4f74494e1d8763acdbe1f8b6097a21e48c24529e8507657a4c9c294b4e"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-promotion-tests.mjs"
		, count: 0, alreadyCurrent: 11
		, previousSha256: "95409c9e76c5476d07f61f2061fbe47d6bc328c845988df406943347dce8b92b"
		, currentSha256: "cf59c07fa898a0a6287bc4e190acb4d99972b50f0e6f0116f74d35f24df70189"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-promotion.mjs"
		, count: 0, alreadyCurrent: 11
		, previousSha256: "6ae3fc3a16a5f7159ff457269e21548dd40547d6e2bd358393ffb32d4de21ef6"
		, currentSha256: "be6eb1bc37a315040a9e859ae36773929a1c90a23cca64f9e000463eb7fbe76b"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-published-matrix-tests.mjs"
		, count: 0, alreadyCurrent: 0
		, previousSha256: "14ad48ca02657e1ba87aa9989657c37e3f17bf77c73a8a1638fd40c9c5382448"
		, currentSha256: "2808910e7cb95d1809514c920bc2291fd54e553c727aaed39f905f88fb4958d5"
	})
	, Object.freeze({
		path: "tests/helpers/type-surface-promotion-io-tests.mjs"
		, count: 0, alreadyCurrent: 0
		, previousSha256: "ddc6c95d0b497fdc83e1492b2dabc99080d4d0d66fe368fb5bb766a665f8cdf6"
		, currentSha256: "0ccee78de5105afc9e310ee3a4ae5cb77f5f6368a1475610037ec98f3a493e1c"
	})
	, Object.freeze({
		path: "tests/helpers/type-surface-promotion-io.mjs"
		, count: 12, alreadyCurrent: 11
		, previousSha256: "2af32697fb2d47799926eee99ee726f43e78ee80053e89ef8777ebedc1703c98"
		, currentSha256: "89c4b392fbf482e453e48552de977790a783691ee7f28dba07bf58ec5c0db296"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedMatrixRefreshHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedMatrixRefreshUpdate = (
	source, update
) => {
	assert.ok(ownedMatrixRefreshNormalizationPaths
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
 * Remove only the exact Owned matrix refresh.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedMatrixRefreshSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedMatrixRefreshNormalizationPaths.includes(path))
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
		current = reverseOwnedMatrixRefreshUpdate(current, update);
	}
	return current;
};
