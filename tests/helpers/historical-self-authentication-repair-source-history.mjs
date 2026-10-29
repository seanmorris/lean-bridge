/**
 * Preserve the exact historical self-authentication repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historicalSelfAuthenticationRepairHistoryPath
	= "docs/evidence/historical-self-authentication-repair-source-history-20261029.json";
export const historicalSelfAuthenticationRepairPredecessor
	= "6160b1847fec87f84fd48c0a63eacf600578f12d";
export const historicalSelfAuthenticationRepairImplementation
	= "1d70513965d2bd7adf4ac4b8071a00baea7b836f";
export const historicalSelfAuthenticationRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/dependent-signature-focused-ci-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-fixture-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-focused-ci-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-language-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-managed-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-native-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-npm-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-package-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-php-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-source-history-tests.mjs"
		, "tests/helpers/direct-proof-erasure-wit-source-history-tests.mjs"
		, "tests/helpers/host-null-focused-archive-input-source-history-tests.mjs"
		, "tests/helpers/host-null-focused-ci-source-history-tests.mjs"
		, "tests/helpers/proof-erasure-evidence-audit-source-history-tests.mjs"
	]);
export const historicalSelfAuthenticationRepairIntegrationPaths
	= Object.freeze(["tests/canonical-package-manifest.test.mjs"]);
export const historicalSelfAuthenticationRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-historical-self-authentication-repair-source-history.mjs"
		, "tests/helpers/historical-self-authentication-repair-source-history-tests.mjs"
		, "tests/helpers/historical-self-authentication-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	`../../${historicalSelfAuthenticationRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const historicalSelfAuthenticationRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: historicalSelfAuthenticationRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => historicalSelfAuthenticationRepairImplementationPaths
	.includes(path) || historicalSelfAuthenticationRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one exact self-authentication transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHistoricalSelfAuthenticationRepairUpdate = (
	source, update
) => {
	assert.ok(allowed(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const pieces = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), [
			"current", "previous", "start"
		]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		pieces.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	pieces.push(source.slice(cursor));
	const previous = pieces.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove the repair from current or historical source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact historical digest.
 */
export const beforeHistoricalSelfAuthenticationRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !historicalSelfAuthenticationRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseHistoricalSelfAuthenticationRepairUpdate(
			current, update);
	}
	return current;
};
