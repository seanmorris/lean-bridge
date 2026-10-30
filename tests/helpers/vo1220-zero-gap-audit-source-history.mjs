/**
 * Preserve the final VO #1220 zero-gap audit contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ZeroGapAuditHistoryPath
	= "docs/evidence/vo1220-zero-gap-audit-source-history-20261030.json";
export const vo1220ZeroGapAuditPredecessor
	= "92a7ccbff4e006a61402f7d418e6c28d9a4e1f59";
export const vo1220ZeroGapAuditImplementation
	= "5f5bb564d0cba400fc1cefd5751c4a988c59f919";
export const vo1220ZeroGapAuditImplementationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
]);
export const vo1220ZeroGapAuditImplementationAdditions = Object.freeze([
	"tests/helpers/vo1220-zero-gap-tests.mjs"
	, "tests/helpers/vo1220-zero-gap.mjs"
]);
export const vo1220ZeroGapAuditIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const vo1220ZeroGapAuditHistoryAdditions = Object.freeze([
	"scripts/update-vo1220-zero-gap-audit-source-history.mjs"
	, "tests/helpers/vo1220-zero-gap-audit-source-history-tests.mjs"
	, "tests/helpers/vo1220-zero-gap-audit-source-history.mjs"
]);

const historyUrl = new URL(`../../${vo1220ZeroGapAuditHistoryPath}`
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const vo1220ZeroGapAuditNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: vo1220ZeroGapAuditImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => vo1220ZeroGapAuditImplementationPaths.includes(path)
	|| vo1220ZeroGapAuditIntegrationPaths.includes(path);

/**
 * Reverse one exact #1220 audit transition.
 *
 * @param source - Complete later source.
 * @param update - Exact recorded transition.
 */
export const reverseVo1220ZeroGapAuditUpdate = (source, update) => {
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
 * Remove only the authenticated #1220 zero-gap audit registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeVo1220ZeroGapAuditSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !vo1220ZeroGapAuditNormalizationPaths.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ZeroGapAuditUpdate(current, update);
	}
	return current;
};
