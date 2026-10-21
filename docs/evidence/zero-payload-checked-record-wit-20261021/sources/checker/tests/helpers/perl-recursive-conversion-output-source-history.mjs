/**
 * Preserve the immutable Perl recursive-conversion receipt while binding the
 * current generator output through one exact, reversible repair milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const perlRecursiveConversionOutputHistoryPath
	= "docs/evidence/perl-recursive-conversion-output-source-history-20261018.json";
export const perlRecursiveConversionOutputPredecessor
	= "68b5d31fdcb5b6da0debcedc5528ebc066bff19c";
export const perlRecursiveConversionOutputDraftParent
	= "68b5d31fdcb5b6da0debcedc5528ebc066bff19c";
export const perlRecursiveConversionOutputChangedPaths = Object.freeze([
	"tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/perl-copied-graph-conversions.test.mjs"
]);
export const perlRecursiveConversionOutputAddedPaths = Object.freeze([
	"scripts/update-perl-recursive-conversion-output-source-history.mjs"
	, "tests/helpers/perl-recursive-conversion-output-source-history.mjs"
]);
export const perlRecursiveConversionOutputInputPaths = Object.freeze([
	"src/backends/c/copied-graph-layout.mjs"
	, "src/backends/perl/copied-graph-conversions.mjs"
	, "src/backends/perl/copied-graph-runtime.mjs"
	, "src/backends/perl/copied-graph-values.mjs"
	, "src/backends/perl/copied-graph-xs.mjs"
	, "tests/helpers/native-recursive-reviewed.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	perlRecursiveConversionOutputHistoryPath, "utf8"));

/**
 * Reverse one exact source transition from this repair.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition for the same path.
 */
export const reversePerlRecursiveConversionOutputUpdate = (source, update) => {
	assert.ok(perlRecursiveConversionOutputChangedPaths.includes(update.path));
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
 * Remove only this exact output-repair layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePerlRecursiveConversionOutputSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !perlRecursiveConversionOutputChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reversePerlRecursiveConversionOutputUpdate(source, update)
		: source;
};

/**
 * Bind the old receipt hash and the current deterministic output without
 * mutating historical evidence.
 *
 * @param receiptPath - Immutable receipt path.
 * @param receipt - Parsed immutable receipt.
 * @param compiled - Deterministic output from the current generator.
 */
export const assertPerlRecursiveConversionOutputTransition = (
	receiptPath, receipt, compiled
) => {
	const transition = record().outputTransition;
	assert.deepEqual(Object.keys(transition).sort(), [
		"currentSourceSha256", "inputs", "previousSourceSha256"
		, "receiptPath", "receiptSha256", "stableValuesSha256"
		, "stableXsSha256"
	]);
	assert.equal(transition.receiptPath, receiptPath);
	assert.equal(sha256(readFileSync(receiptPath)), transition.receiptSha256);
	assert.deepEqual([...new Set(receipt.native.observations.map(
		item => item.sourceSha256))], [transition.previousSourceSha256]);
	assert.notEqual(transition.currentSourceSha256
		, transition.previousSourceSha256);
	assert.equal(sha256(compiled.source), transition.currentSourceSha256);
	assert.deepEqual([...new Set(receipt.native.observations.map(
		item => item.xsSha256))], [transition.stableXsSha256]);
	assert.deepEqual([...new Set(receipt.native.observations.map(
		item => item.valuesSha256))], [transition.stableValuesSha256]);
	assert.equal(sha256(compiled.xs), transition.stableXsSha256);
	assert.equal(sha256(compiled.valuesSource), transition.stableValuesSha256);
	assert.deepEqual(transition.inputs.map(item => item.path)
		, perlRecursiveConversionOutputInputPaths);
	for(const input of transition.inputs)
	{
		assert.deepEqual(Object.keys(input).sort()
			, ["currentSha256", "path", "previousSha256"]);
		assert.equal(input.previousSha256, receipt.sourceHashes[input.path]
			, input.path);
		assert.equal(sha256(readFileSync(input.path)), input.currentSha256
			, input.path);
	}
};
