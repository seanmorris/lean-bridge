/**
 * Reverse the zero-payload Rust copied-value audit repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const zeroPayloadRustAuditRepairHistoryPath
	= "docs/evidence/zero-payload-rust-audit-repair-source-history-20261021.json";
export const zeroPayloadRustAuditRepairPredecessor
	= "55c5ea683fe94c50bf8d8d77def76c89cb89c110";
export const zeroPayloadRustAuditRepairImplementation
	= "27868ac2d28c646f913e001c404e40a3c5674560";
export const zeroPayloadRustAuditRepairChangedPaths = Object.freeze([
	"src/backends/rust/package-audit.mjs"
	, "tests/helpers/zero-payload-checked-record-rust-fixture-tests.mjs"
]);
export const zeroPayloadRustAuditRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/zero-payload-checked-record-rust.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	zeroPayloadRustAuditRepairHistoryPath, "utf8"
));

/**
 * Authenticate and reverse one exact audit repair.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseZeroPayloadRustAuditRepairUpdate = (
	source, update
) => {
	assert.ok([...zeroPayloadRustAuditRepairChangedPaths
		, ...zeroPayloadRustAuditRepairIntegrationPaths]
		.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only this copied-value audit repair from one exact source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeZeroPayloadRustAuditRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| ![...zeroPayloadRustAuditRepairChangedPaths
			, ...zeroPayloadRustAuditRepairIntegrationPaths].includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = [...record().updates, ...record().integrationUpdates]
		.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseZeroPayloadRustAuditRepairUpdate(source, update)
		: source;
};
