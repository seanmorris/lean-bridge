/**
 * Preserve the exact PHP direct proof-erasure package acceptance lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasurePhpHistoryPath
	= "docs/evidence/direct-proof-erasure-php-source-history-20261028.json";
export const directProofErasurePhpPredecessor
	= "82772252f87774db6255d186785afe59345f5ed9";
export const directProofErasurePhpImplementation
	= "b30ee85ef3cad39a603b034a26fd7f370ac066cd";
export const directProofErasurePhpChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
	, "tests/direct-proof-erasure.test.mjs"
	, "tests/helpers/direct-proof-erasure-fixture.mjs"
]);
export const directProofErasurePhpIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/direct-proof-erasure-native-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasurePhpNormalizationPaths = Object.freeze([
	...directProofErasurePhpChangedPaths
	, ...directProofErasurePhpIntegrationPaths
]);
export const directProofErasurePhpImplementationAddedPaths = Object.freeze([
	"scripts/check-direct-proof-erasure-php-ci.mjs"
	, "scripts/run-direct-proof-erasure-php-ci.sh"
	, "tests/direct-proof-erasure-php-installed.test.mjs"
	, "tests/fixtures/direct-proof-erasure-consumers/php.php"
	, "tests/helpers/direct-proof-erasure-php-report.mjs"
	, "tests/helpers/direct-proof-erasure-php-tests.mjs"
]);
export const directProofErasurePhpHistoryAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-php-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-php-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-php-source-history.mjs"
]);
export const directProofErasurePhpAddedPaths = Object.freeze([
	...directProofErasurePhpImplementationAddedPaths
	, ...directProofErasurePhpHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasurePhpHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated PHP acceptance transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasurePhpUpdate = (source, update) => {
	assert.ok(directProofErasurePhpNormalizationPaths.includes(update.path));
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
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove recognized PHP package transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasurePhpSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !directProofErasurePhpNormalizationPaths.includes(path)) return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasurePhpUpdate(current, update);
	}
	return current;
};
