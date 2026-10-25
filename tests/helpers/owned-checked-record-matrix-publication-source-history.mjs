/**
 * Authenticate the owned checked-record matrix publication.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedRecordMatrixPublicationHistoryPath
	= "docs/evidence/owned-checked-record-matrix-publication-source-history-20261025.json";
export const ownedCheckedRecordMatrixPublicationPredecessor
	= "a9cad3b18a244d7e74918e6e8964455e073e2453";
export const ownedCheckedRecordMatrixPublicationImplementation
	= "098df874ba69e667fe220f53b5e13412595193e5";
export const ownedCheckedRecordMatrixPublicationIntegrationBase
	= "098df874ba69e667fe220f53b5e13412595193e5";
export const ownedCheckedRecordMatrixPublicationCommits = Object.freeze([
	"098df874ba69e667fe220f53b5e13412595193e5"
]);
export const ownedCheckedRecordMatrixPublicationChangedPaths = Object.freeze([
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
	, "docs/contributing/testing.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedRecordMatrixPublicationImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-record-promotion-20261024.md"
	, "docs/evidence/owned-checked-record-published-matrix-acceptance-20261025.json"
	, "tests/helpers/owned-checked-record-published-matrix-tests.mjs"
]);
export const ownedCheckedRecordMatrixPublicationImplementationPaths = Object.freeze([
	...ownedCheckedRecordMatrixPublicationChangedPaths
	, ...ownedCheckedRecordMatrixPublicationImplementationAddedPaths
]);
export const ownedCheckedRecordMatrixPublicationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedRecordMatrixPublicationNormalizationPaths = Object.freeze([
	...ownedCheckedRecordMatrixPublicationChangedPaths
	, ...ownedCheckedRecordMatrixPublicationIntegrationPaths
]);
export const ownedCheckedRecordMatrixPublicationHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-record-matrix-publication-source-history.mjs"
	, "tests/helpers/owned-checked-record-matrix-publication-source-history-tests.mjs"
	, "tests/helpers/owned-checked-record-matrix-publication-source-history.mjs"
]);
export const ownedCheckedRecordMatrixPublicationAddedPaths = Object.freeze([
	...ownedCheckedRecordMatrixPublicationImplementationAddedPaths
	, ...ownedCheckedRecordMatrixPublicationHistoryAddedPaths
]);
export const ownedCheckedRecordMatrixPublicationPins = Object.freeze([
	Object.freeze({
		path: "docs/consume/c.md"
		, count: 1
		, previousSha256: "932ba66959bd577f00b329b2589c596ba69269b45dadb754d6fb29053fe25b24"
		, currentSha256: "4676474c965da41bc8cb538d23d7fe8f79753a6004e45cc80d80bfe0552557ff"
	})
	, Object.freeze({
		path: "docs/consume/cpp.md"
		, count: 1
		, previousSha256: "e9910cb2953cc784f7381061e571fe5ca186f05bfd4a9dec882d1f2326cfd715"
		, currentSha256: "faa7d09034465d9861601c6780e032d914bc701c198663d897b4786959a81a09"
	})
	, Object.freeze({
		path: "docs/consume/dotnet.md"
		, count: 5
		, previousSha256: "203dbbc63ca4935350adae9bd4249fcbdba0a0c8abda80f3886d2ee171bb184d"
		, currentSha256: "204a4233e8ab45e41df3d72ba391fb8414da6700e6078299d5dd0477c6792ffb"
	})
	, Object.freeze({
		path: "docs/consume/java.md"
		, count: 5
		, previousSha256: "03163737fd1229f2be5199655743cabc05dc37655db060596dd1c2fb2d886233"
		, currentSha256: "b1feee04d18e4ede9bc1298e7f908f930bb4d0538b4cd88ec88ca60467e7cd4b"
	})
	, Object.freeze({
		path: "docs/consume/kotlin.md"
		, count: 6
		, previousSha256: "170fb62db75dc66d32b130af966b0bf2c3756db24ded7764f1a94dd71250dece"
		, currentSha256: "6e2b14a42e08345ee5724d1faf77f05d44250f0034caadd0e2a8f745e598f911"
	})
	, Object.freeze({
		path: "docs/consume/perl.md"
		, count: 1
		, previousSha256: "2318e2d83c77b754624b01387c1edde90133498f5b5a112a755e28990b1c929d"
		, currentSha256: "bae96fd3215f1c800cbb8beec4f0a09a99db10c6707e983fabaf9eebc9065861"
	})
	, Object.freeze({
		path: "docs/consume/python.md"
		, count: 1
		, previousSha256: "b5550a5e3b1706a4b3bb3d7ee86364e1fd630cc3065a155267cd178dcfd050de"
		, currentSha256: "8bf30095de92afe4fd510e3b154cc5c3189e5955e61f255e0240e4cbc79862cc"
	})
	, Object.freeze({
		path: "docs/consume/ruby.md"
		, count: 1
		, previousSha256: "929347299d8b9c77d68c51d0e4d5fb2b3e11cc3123ccbc81ce4db2967d8726ea"
		, currentSha256: "360e7f03a26df43e98b4b10763e491fb22fa1f600a83c0cb8d83b31781a2d79a"
	})
	, Object.freeze({
		path: "docs/consume/rust.md"
		, count: 1
		, previousSha256: "7e560000ca4c1f6c381ff4fa690cf4a44706fa4408fe7a4d37c9200027ace47a"
		, currentSha256: "ee787dabe61671df8e0025ecd639a01fbba5f8756325d5f3ff5d2e9130072f90"
	})
	, Object.freeze({
		path: "docs/consume/wit-wasi.md"
		, count: 2
		, previousSha256: "80ac2db0997df9d6d00748bf3c64f123a1cef1d7bbe14b5716926f1cafed95b6"
		, currentSha256: "8f27942dd838768f424c2dd7ada7afebf6e651a55e32c225b0a3280a0b340893"
	})
	, Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "000a883b22e63a4a46b7c88929d424bff8a3dce4e14a4d16141f3f19d5cc5a78"
		, currentSha256: "94be66d7e298b22293a773fc641435d008aed29c886f82e428c5cb9dac46c2cb"
	})
	, Object.freeze({
		path: "docs/lean/existing-package.md"
		, count: 18
		, previousSha256: "ddcb45ff701b2e1ea398ca40ee5d452db5097c917a560d691bfec44cbc6b3eda"
		, currentSha256: "c15b6b4fce1001120661ab9d919a279fa16252f45c0f868d3a9cd1afdc106459"
	})
	, Object.freeze({
		path: "docs/lean/export-decisions.md"
		, count: 22
		, previousSha256: "37d1a95e47bf11aefd561b38554819ff4c8e10465d116f8b0f7dbdaa67f614b3"
		, currentSha256: "99cef3dc3654c7f13b18f3b5509c12bdb3e3722a26361181ac6b8b480bb730da"
	})
	, Object.freeze({
		path: "docs/php.md"
		, count: 6
		, previousSha256: "d1264958fab471cb3e64242ac012d96249cd28349b4ee2e1b4d0460050149efd"
		, currentSha256: "2dfdc4e1afc1d87d856453f0aae18761c1b56a6c176c315c95894bca30b577e4"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedRecordMatrixPublicationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedRecordMatrixPublicationUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedRecordMatrixPublicationNormalizationPaths
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
 * Remove only the exact Owned checked-record matrix publication.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedRecordMatrixPublicationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedRecordMatrixPublicationNormalizationPaths.includes(path))
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
		current = reverseOwnedCheckedRecordMatrixPublicationUpdate(current, update);
	}
	return current;
};
