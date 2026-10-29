/**
 * Preserve the bounded dependent-signature producer and exact-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentSignatureFocusedCiHistoryPath
	= "docs/evidence/dependent-signature-focused-ci-source-history-20261029.json";
export const dependentSignatureFocusedCiPredecessor
	= "f09dbe71ef6eb660a4912af44da371cf42cb8d7b";
export const dependentSignatureFocusedCiImplementation
	= "5547500cf470a381ed323adc41f87f7b490da2d9";
export const dependentSignatureFocusedCiImplementationPaths = Object.freeze([
	".github/workflows/dependent-checked-record-browser.yml"
	, ".github/workflows/dependent-checked-record-dotnet.yml"
	, ".github/workflows/dependent-checked-record-jvm.yml"
	, ".github/workflows/dependent-checked-record-native.yml"
	, ".github/workflows/dependent-checked-record-perl.yml"
	, ".github/workflows/dependent-checked-record-php-wasm.yml"
	, ".github/workflows/dependent-checked-record-php.yml"
	, ".github/workflows/dependent-checked-record-python.yml"
	, ".github/workflows/dependent-checked-record-ruby.yml"
	, ".github/workflows/dependent-checked-record-rust.yml"
	, ".github/workflows/dependent-checked-record-wit.yml"
	, ".github/workflows/dependent-signature-complete.yml"
	, "scripts/run-dependent-checked-record-browser-ci.sh"
	, "scripts/run-dependent-checked-record-dotnet-ci.sh"
	, "scripts/run-dependent-checked-record-jvm-ci.sh"
	, "scripts/run-dependent-checked-record-native-ci.sh"
	, "scripts/run-dependent-checked-record-perl-ci.sh"
	, "scripts/run-dependent-checked-record-php-ci.sh"
	, "scripts/run-dependent-checked-record-php-wasm-ci.sh"
	, "scripts/run-dependent-checked-record-python-ci.sh"
	, "scripts/run-dependent-checked-record-ruby-ci.sh"
	, "scripts/run-dependent-checked-record-rust-ci.sh"
	, "scripts/run-dependent-checked-record-wit-ci.sh"
	, "tests/helpers/dependent-checked-record-jvm-ci-workflow.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow-tests.mjs"
	, "tests/helpers/dependent-checked-record-wit-ci-workflow.mjs"
	, "tests/helpers/dependent-signature-complete-ci-tests.mjs"
]);
export const dependentSignatureFocusedCiImplementationAdditions = Object.freeze([
	"scripts/reconcile-dependent-signature-matrix.mjs"
	, "tests/helpers/dependent-signature-matrix-receipt-tests.mjs"
	, "tests/helpers/dependent-signature-matrix-receipt.mjs"
]);
export const dependentSignatureFocusedCiIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/direct-proof-erasure-focused-ci-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const dependentSignatureFocusedCiHistoryAdditions = Object.freeze([
	"scripts/update-dependent-signature-focused-ci-source-history.mjs"
	, "tests/helpers/dependent-signature-focused-ci-source-history-tests.mjs"
	, "tests/helpers/dependent-signature-focused-ci-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${dependentSignatureFocusedCiHistoryPath}`, import.meta.url
);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	historyUrl, "utf8"
));
export const dependentSignatureFocusedCiNormalizationPaths = Object.freeze([
	...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: dependentSignatureFocusedCiImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])
].sort());
const allowedPath = path => dependentSignatureFocusedCiImplementationPaths
	.includes(path) || dependentSignatureFocusedCiIntegrationPaths.includes(path);

/**
 * Reverse one exact focused-CI source transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseDependentSignatureFocusedCiUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
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
 * Remove focused dependent-signature integration and implementation changes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeDependentSignatureFocusedCiSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentSignatureFocusedCiNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseDependentSignatureFocusedCiUpdate(current, update);
	}
	return current;
};
