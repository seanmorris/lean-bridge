/**
 * Preserve the exact Perl/Python/Ruby/Rust direct proof-erasure package lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const directProofErasureLanguageHistoryPath
	= "docs/evidence/direct-proof-erasure-language-source-history-20261028.json";
export const directProofErasureLanguagePredecessor
	= "b3dbf400a3d50b1173b0233e689af0fc5138a27b";
export const directProofErasureLanguageImplementation
	= "f4413cc2fdb2bd68ea9df5cbfcade65dd63f0b93";
export const directProofErasureLanguageChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "tests/checked-javascript-partition-11.test.mjs"
]);
export const directProofErasureLanguageIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const directProofErasureLanguageNormalizationPaths = Object.freeze([
	...directProofErasureLanguageChangedPaths
	, ...directProofErasureLanguageIntegrationPaths
]);
export const directProofErasureLanguageImplementationAddedPaths = Object.freeze([
	"scripts/check-direct-proof-erasure-language-ci.mjs"
	, "scripts/run-direct-proof-erasure-language-ci.sh"
	, "tests/direct-proof-erasure-language-installed.test.mjs"
	, "tests/fixtures/direct-proof-erasure-consumers/perl.pl"
	, "tests/fixtures/direct-proof-erasure-consumers/python.py"
	, "tests/fixtures/direct-proof-erasure-consumers/ruby.rb"
	, "tests/fixtures/direct-proof-erasure-consumers/rust.rs"
	, "tests/helpers/direct-proof-erasure-language-report.mjs"
	, "tests/helpers/direct-proof-erasure-language-tests.mjs"
]);
export const directProofErasureLanguageHistoryAddedPaths = Object.freeze([
	"scripts/update-direct-proof-erasure-language-source-history.mjs"
	, "tests/helpers/direct-proof-erasure-language-source-history-tests.mjs"
	, "tests/helpers/direct-proof-erasure-language-source-history.mjs"
]);
export const directProofErasureLanguageAddedPaths = Object.freeze([
	...directProofErasureLanguageImplementationAddedPaths
	, ...directProofErasureLanguageHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	directProofErasureLanguageHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated language-package transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseDirectProofErasureLanguageUpdate = (source, update) => {
	assert.ok(directProofErasureLanguageNormalizationPaths.includes(update.path));
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
 * Remove recognized language-package transitions newest first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeDirectProofErasureLanguageSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !directProofErasureLanguageNormalizationPaths.includes(path))
		return source;
	const updates = [...record().integrationUpdates, ...record().updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseDirectProofErasureLanguageUpdate(current, update);
	}
	return current;
};
