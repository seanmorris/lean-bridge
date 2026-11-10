/**
 * Authenticate the legacy Perl callback asset-expectation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220PerlCallbackAssetExpectationRepairHistoryPath
	= "docs/evidence/vo1220-perl-callback-asset-expectation-repair-source-history-20261110.json";
export const vo1220PerlCallbackAssetExpectationRepairPredecessor
	= "2b5ab8f322c58a7710e8147504dc5fcbafa677cc";
export const vo1220PerlCallbackAssetExpectationRepairImplementation
	= "a96c894b2fb2e807d9ed41b4afdf1f109685b6f6";
export const vo1220PerlCallbackAssetExpectationRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/owned-perl-callback-result-ci.mjs"
	]);
export const vo1220PerlCallbackAssetExpectationRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-12.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220PerlCallbackAssetExpectationRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-vo1220-perl-callback-asset-expectation-repair-source-history.mjs"
		, "tests/helpers/vo1220-perl-callback-asset-expectation-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-perl-callback-asset-expectation-repair-source-history.mjs"
	]);
export const vo1220PerlCallbackAssetExpectationRepairBehavior
	= Object.freeze({
		changedSupportCells: 0, runtimeSemanticChanges: 0
		, packageSemanticChanges: 0, productionCodeChanges: 0
		, currentAssetContract: "download-pinned-release-asset.sh kotlin-compiler"
		, legacyAssetContract: "kotlin-compiler-2.2.0.zip"
		, currentTests: 41, legacyTests: 37
		, currentEvidenceTests: 16, legacyEvidenceTests: 14
	});

const historyUrl = new URL(
	`../../${vo1220PerlCallbackAssetExpectationRepairHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220PerlCallbackAssetExpectationRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220PerlCallbackAssetExpectationRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: vo1220PerlCallbackAssetExpectationRepairIntegrationPaths)
	])].sort());
const allowedPath = path =>
	vo1220PerlCallbackAssetExpectationRepairNormalizationPaths.includes(path);

/**
 * Require the exact expectation split.
 *
 * @param sources - Exact implementation source by repository path.
 */
export const assertVo1220PerlCallbackAssetExpectationRepair = sources => {
	for(const path of
		vo1220PerlCallbackAssetExpectationRepairImplementationPaths)
		assert.equal(typeof sources[path], "string", path);
	const source = sources["tests/helpers/owned-perl-callback-result-ci.mjs"];
	assert.match(source
		, /const kotlin = legacy \? "kotlin-compiler-2\.2\.0\.zip"/u);
	assert.match(source
		, /: "download-pinned-release-asset\.sh kotlin-compiler";/u);
	assert.match(source
		, /for\(const value of \[\.\.\.tools, \.\.\.setup, kotlin, browsers\]\)/u);
	return { ...vo1220PerlCallbackAssetExpectationRepairBehavior };
};

/**
 * Reverse one authenticated expectation transition.
 *
 * @param source - Exact later source.
 * @param update - Exact transition for the same path.
 */
export const reverseVo1220PerlCallbackAssetExpectationRepairUpdate = (
	source, update
) => {
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
 * Remove only the authenticated expectation repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220PerlCallbackAssetExpectationRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string" || !allowedPath(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220PerlCallbackAssetExpectationRepairUpdate(
				current, update);
	}
	return current;
};
