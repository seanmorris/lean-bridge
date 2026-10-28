/**
 * Reverse the complete optional-parameter implementation, pin reconciliation,
 * and central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const optionalParameterHistoryPath
	= "docs/evidence/optional-parameter-source-history-20261028.json";
export const optionalParameterPredecessor
	= "ddc31428d44e92eeabcf8d301bf765c826b8bc0b";
export const optionalParameterFeatureCommit
	= "8983447e75753eed71bb07980cebecc00b966ff8";
export const optionalParameterImplementation
	= "3d92ee3f3a9d7d4c34dca7a80540a7364392ab5d";
export const optionalParameterImplementationCommits = Object.freeze([
	"66c64fd844e1b912fa47dd235bf2f0f13bba2b74"
	, "d02a1fd40c583f30dec7997501b0aa53c4326304"
	, "5e89f6ac199a21c08807ab98a13dc83fbc5a88b4"
	, "36fe61602ddc9107eabae7f0acfa395008d8ca54"
	, "966a747a4f962ebcdf6622ec413bd6f9d9d30163"
	, "1fb89e5fcfedb24a49d81ec674d5431fba8306c5"
	, "95204673d0f52b9d8935b1e57345f6fcb58453d1"
	, "c9f38e5bad5396135c1f6ffe0b194ad373606671"
	, "37872750fde8a248b67b5565c7c634643fe30983"
	, "b52e738c44fb1c314651f8cc28205f5df574710c"
	, "a25d1a6d30af804d06766ec5cc36291cda4a3928"
	, "3387e1329363fc9a3fa7c4d3df36bfc572d3869a"
	, "2d467e633fb242b2f309c2b2b86cb1b55a79249c"
	, "c7682d9a1028a89ae8a303d6fbb4cde12afa908e"
	, "ae88b750461bf4138f2d5b3c079d2865725d8fde"
	, "635dbfb394a140717861d1a61d4e64e1a85ef446"
	, "6f44ff56d66880b27959214759cbdd74696aacd5"
	, "78615fd1a6bdf1f24dc7bdd668930c30a9f23fe6"
	, "a7492cce3e40920fb8a99b3a61e801a48c1c68c3"
	, "5faab47ff3b4da05f9af7ebe71c17e1df0f03229"
	, optionalParameterFeatureCommit, optionalParameterImplementation
]);
export const optionalParameterIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const optionalParameterHistoryAdditions = Object.freeze([
	"scripts/update-optional-parameter-source-history.mjs"
	, "tests/helpers/optional-parameter-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	optionalParameterHistoryPath, "utf8"));
export const optionalParameterNormalizationPaths = Object.freeze([
	...new Set([
		...record().updates.map(item => item.path)
		, ...record().integrationUpdates.map(item => item.path)
	])
].sort());
export const optionalParameterImplementationAdditions = Object.freeze(
	record().implementationAdditions.map(item => item.path));

/**
 * Reverse one exact authenticated optional-parameter source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded path, endpoints and edit spans.
 */
export const reverseOptionalParameterUpdate = (source, update) => {
	assert.ok(optionalParameterNormalizationPaths.includes(update.path));
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
 * Remove recognized optional-parameter transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeOptionalParameterSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !optionalParameterNormalizationPaths.includes(path)) return source;
	let current = source;
	const updates = [...record().integrationUpdates, ...record().updates];
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOptionalParameterUpdate(current, update);
	}
	return current;
};
