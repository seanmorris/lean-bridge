/**
 * Reverse the exact residual-Core ledger pointer replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreResidualLedgerPointerReplayRepairHistoryPath
	= "docs/evidence/core-residual-ledger-pointer-replay-repair-source-history-20261023.json";
export const coreResidualLedgerPointerReplayRepairPredecessor
	= "cc75d3ca37f867291d9ef064978304ee184bce2b";
export const coreResidualLedgerPointerReplayRepairImplementation
	= "a2e52a6fb835be86c7ad797535059f4419e229f8";
export const coreResidualLedgerPointerReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/core-first-run-residual-repair-source-history-tests.mjs"
	, "tests/helpers/core-first-run-residual-repair-source-history.mjs"
]);
export const coreResidualLedgerPointerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreResidualLedgerPointerReplayRepairNormalizationPaths
	= Object.freeze([
		...coreResidualLedgerPointerReplayRepairChangedPaths
		, ...coreResidualLedgerPointerReplayRepairIntegrationPaths
	]);
export const coreResidualLedgerPointerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-core-residual-ledger-pointer-replay-repair-source-history.mjs"
	, "tests/helpers/core-residual-ledger-pointer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/core-residual-ledger-pointer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreResidualLedgerPointerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCoreResidualLedgerPointerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(coreResidualLedgerPointerReplayRepairNormalizationPaths
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
 * Remove only the exact residual-Core ledger pointer replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCoreResidualLedgerPointerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreResidualLedgerPointerReplayRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCoreResidualLedgerPointerReplayRepairUpdate(source, update)
		: source;
};
