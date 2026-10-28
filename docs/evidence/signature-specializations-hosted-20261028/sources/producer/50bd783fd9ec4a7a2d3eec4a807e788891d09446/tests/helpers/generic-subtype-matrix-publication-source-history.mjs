/**
 * Authenticate the generic Subtype matrix publication.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const genericSubtypeMatrixPublicationHistoryPath
	= "docs/evidence/generic-subtype-matrix-publication-source-history-20261024.json";
export const genericSubtypeMatrixPublicationPredecessor
	= "10cc8859e6ef7124c52b147aebcdae92e69a2957";
export const genericSubtypeMatrixPublicationImplementation
	= "0a83fb447cf6a1820898d6be405e218833ec6eae";
export const genericSubtypeMatrixPublicationIntegrationBase
	= "0a83fb447cf6a1820898d6be405e218833ec6eae";
export const genericSubtypeMatrixPublicationCommits = Object.freeze([
	"0a83fb447cf6a1820898d6be405e218833ec6eae"
]);
export const genericSubtypeMatrixPublicationChangedPaths = Object.freeze([
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
export const genericSubtypeMatrixPublicationImplementationAddedPaths = Object.freeze([
	"docs/evidence/generic-subtype-promotion-20261023.md"
	, "docs/evidence/generic-subtype-published-matrix-acceptance-20261024.json"
	, "tests/helpers/generic-subtype-published-matrix-tests.mjs"
]);
export const genericSubtypeMatrixPublicationImplementationPaths = Object.freeze([
	...genericSubtypeMatrixPublicationChangedPaths
	, ...genericSubtypeMatrixPublicationImplementationAddedPaths
]);
export const genericSubtypeMatrixPublicationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const genericSubtypeMatrixPublicationNormalizationPaths = Object.freeze([
	...genericSubtypeMatrixPublicationChangedPaths
	, ...genericSubtypeMatrixPublicationIntegrationPaths
]);
export const genericSubtypeMatrixPublicationHistoryAddedPaths = Object.freeze([
	"scripts/update-generic-subtype-matrix-publication-source-history.mjs"
	, "tests/helpers/generic-subtype-matrix-publication-source-history-tests.mjs"
	, "tests/helpers/generic-subtype-matrix-publication-source-history.mjs"
]);
export const genericSubtypeMatrixPublicationAddedPaths = Object.freeze([
	...genericSubtypeMatrixPublicationImplementationAddedPaths
	, ...genericSubtypeMatrixPublicationHistoryAddedPaths
]);
export const genericSubtypeMatrixPublicationPins = Object.freeze([
	Object.freeze({
		path: "docs/consume/c.md"
		, count: 1
		, previousSha256: "d3a4b5e803e616a45272279f08fd20ad26d62c1edd45e1496640391158e48ed8"
		, currentSha256: "932ba66959bd577f00b329b2589c596ba69269b45dadb754d6fb29053fe25b24"
	})
	, Object.freeze({
		path: "docs/consume/cpp.md"
		, count: 1
		, previousSha256: "290f12160ecc47a5c7576c3c1e0fcb32bbe513fcf6439bfb04ba03db605dc226"
		, currentSha256: "e9910cb2953cc784f7381061e571fe5ca186f05bfd4a9dec882d1f2326cfd715"
	})
	, Object.freeze({
		path: "docs/consume/dotnet.md"
		, count: 5
		, previousSha256: "1901ae9d397d2e86b97a7a971ff934c2cbeb7fa692de67da674a50a17628b52a"
		, currentSha256: "203dbbc63ca4935350adae9bd4249fcbdba0a0c8abda80f3886d2ee171bb184d"
	})
	, Object.freeze({
		path: "docs/consume/java.md"
		, count: 5
		, previousSha256: "19d846902d96414385962ca9ae576b151324bd62183a0d957b134820d2adc079"
		, currentSha256: "03163737fd1229f2be5199655743cabc05dc37655db060596dd1c2fb2d886233"
	})
	, Object.freeze({
		path: "docs/consume/kotlin.md"
		, count: 6
		, previousSha256: "036587b5be4f107cb1cde06748dd9b40e272fd955b8a1508dc5e592d6001a3ff"
		, currentSha256: "170fb62db75dc66d32b130af966b0bf2c3756db24ded7764f1a94dd71250dece"
	})
	, Object.freeze({
		path: "docs/consume/perl.md"
		, count: 1
		, previousSha256: "6427af60a3b07ecbf2c5264de135c50b45c9277e4cbb73a72e3c6f6c9e4855ab"
		, currentSha256: "2318e2d83c77b754624b01387c1edde90133498f5b5a112a755e28990b1c929d"
	})
	, Object.freeze({
		path: "docs/consume/python.md"
		, count: 1
		, previousSha256: "6a9dcae8ab71e84ffd4f672dd1cf0284935289725c9c57ae2392a1856e885b9a"
		, currentSha256: "b5550a5e3b1706a4b3bb3d7ee86364e1fd630cc3065a155267cd178dcfd050de"
	})
	, Object.freeze({
		path: "docs/consume/ruby.md"
		, count: 1
		, previousSha256: "683734efbf8660180650f4eef6e4f2f69fa7e5f981166afe0b8965e3fccd1a15"
		, currentSha256: "929347299d8b9c77d68c51d0e4d5fb2b3e11cc3123ccbc81ce4db2967d8726ea"
	})
	, Object.freeze({
		path: "docs/consume/rust.md"
		, count: 1
		, previousSha256: "bbc5fa01ae6746756a17bb54fe16c42980ea590abfac5d2ec9cb7e77b0a8b208"
		, currentSha256: "7e560000ca4c1f6c381ff4fa690cf4a44706fa4408fe7a4d37c9200027ace47a"
	})
	, Object.freeze({
		path: "docs/consume/wit-wasi.md"
		, count: 2
		, previousSha256: "6cbdf1e47494792a2cfd695e01010033fe2fc2061942ff0ca7339f239f401654"
		, currentSha256: "80ac2db0997df9d6d00748bf3c64f123a1cef1d7bbe14b5716926f1cafed95b6"
	})
	, Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "48077b7f415b4391e798bdede3a0201c0f92101037b65f9825a6ee6e7d4497a4"
		, currentSha256: "3f5ec39ca01c9c0ef813ac2517b503146daa062aad49b608df1e3e1a3d875ae5"
	})
	, Object.freeze({
		path: "docs/lean/existing-package.md"
		, count: 18
		, previousSha256: "7a8f09901de0d46638cb793d86f2bc050d68a8720494631b20d3f0c288a0e4b0"
		, currentSha256: "ddcb45ff701b2e1ea398ca40ee5d452db5097c917a560d691bfec44cbc6b3eda"
	})
	, Object.freeze({
		path: "docs/lean/export-decisions.md"
		, count: 22
		, previousSha256: "6364b4725e177eaa25079b14f2ffb7b3156f0fb8bb9ed89a67027832554563a7"
		, currentSha256: "37d1a95e47bf11aefd561b38554819ff4c8e10465d116f8b0f7dbdaa67f614b3"
	})
	, Object.freeze({
		path: "docs/php.md"
		, count: 6
		, previousSha256: "0ae02f0ef9e568e5bdf469de62b17c0f675333b1c7ea50d86e46d04a21ca0b77"
		, currentSha256: "d1264958fab471cb3e64242ac012d96249cd28349b4ee2e1b4d0460050149efd"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	genericSubtypeMatrixPublicationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseGenericSubtypeMatrixPublicationUpdate = (
	source, update
) => {
	assert.ok(genericSubtypeMatrixPublicationNormalizationPaths
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
 * Remove only the exact Generic Subtype matrix publication.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeGenericSubtypeMatrixPublicationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !genericSubtypeMatrixPublicationNormalizationPaths.includes(path))
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
		current = reverseGenericSubtypeMatrixPublicationUpdate(current, update);
	}
	return current;
};
