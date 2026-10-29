/**
 * Preserve the exact historical contract replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historicalContractReplayRepairHistoryPath
	= "docs/evidence/historical-contract-replay-repair-source-history-20261029.json";
export const historicalContractReplayRepairPredecessor
	= "e5271ed7f6048fe9f64fdc0eb0165bcc3ff1672b";
export const historicalContractReplayRepairImplementation
	= "5f532143e41267cc176c322d421d7c8494fc1a07";
export const historicalContractReplayRepairImplementationPaths = Object.freeze([
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
	, "tests/helpers/host-null-complete-perl-evidence-refresh-tests.mjs"
	, "tests/helpers/host-null-focused-archive-input-source-history-tests.mjs"
	, "tests/helpers/host-null-focused-ci-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-dispatch-bridge-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-focused-ci-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-route-binder-repair-source-history-tests.mjs"
	, "tests/helpers/proof-erasure-evidence-audit-source-history-tests.mjs"
	, "tests/helpers/proof-erasure-wit-lint-join-source-history-tests.mjs"
	, "tests/helpers/source-at-fin-history-milestone.mjs"
	, "tests/helpers/zero-payload-rust-producer-replay-tests.mjs"
]);
export const historicalContractReplayRepairIntegrationPaths = Object.freeze([
	"tests/canonical-package-manifest.test.mjs"
]);
export const historicalContractReplayRepairHistoryAdditions = Object.freeze([
	"scripts/update-historical-contract-replay-repair-source-history.mjs"
	, "tests/helpers/historical-contract-replay-repair-source-history-tests.mjs"
	, "tests/helpers/historical-contract-replay-repair-source-history.mjs"
]);

const historyUrl = new URL(
	`../../${historicalContractReplayRepairHistoryPath}`, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const historicalContractReplayRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(item => item.path)
			: historicalContractReplayRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(item => item.path) : [])
	])].sort());
const allowed = path => historicalContractReplayRepairImplementationPaths
	.includes(path) || historicalContractReplayRepairIntegrationPaths
	.includes(path);

/**
 * Reverse one exact replay-repair transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseHistoricalContractReplayRepairUpdate = (source, update) => {
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
export const beforeHistoricalContractReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !historicalContractReplayRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update) current = reverseHistoricalContractReplayRepairUpdate(
			current, update);
	}
	return current;
};
