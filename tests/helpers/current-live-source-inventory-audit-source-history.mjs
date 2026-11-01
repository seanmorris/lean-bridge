/**
 * Preserve the current live-source inventory audit repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const currentLiveSourceInventoryAuditHistoryPath
	= "docs/evidence/current-live-source-inventory-audit-source-history-20261101.json";
export const currentLiveSourceInventoryAuditPredecessor
	= "32a0cfc2412163414dc4058bec11b502de6674ff";
export const currentLiveSourceInventoryAuditImplementation
	= "0b5352aeee03f6ac61c58a2962e36f190c918493";
export const currentLiveSourceInventoryAuditImplementationPaths
	= Object.freeze([
		"tests/helpers/final-live-source-pin-repair-source-history-tests.mjs"
	]);
export const currentLiveSourceInventoryAuditIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const currentLiveSourceInventoryAuditHistoryAdditions
	= Object.freeze([
		"scripts/update-current-live-source-inventory-audit-source-history.mjs"
		, "tests/helpers/current-live-source-inventory-audit-source-history-tests.mjs"
		, "tests/helpers/current-live-source-inventory-audit-source-history.mjs"
	]);

/**
 * Assert that the current-state gate reads the current inventory rather than
 * freezing an earlier inventory while hashing today's source files.
 *
 * @param source - Complete current-state gate source.
 */
export const assertCurrentLiveSourceInventoryAudit = source => {
	assert.match(source
		, /const document = JSON[.]parse\(await readFile\(\n\t\t\t"docs\/type-surface[.]v1[.]json", "utf8"\)\);/u);
	assert.equal(source.includes(
		"finalLiveSourcePinRepairImplementation}:docs/type-surface.v1.json")
	, false);
	assert.match(source, /assert[.]deepEqual\(mismatches, \[\]\);/u);
};

const historyUrl = new URL(
	"../../" + currentLiveSourceInventoryAuditHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const currentLiveSourceInventoryAuditNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: currentLiveSourceInventoryAuditImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...currentLiveSourceInventoryAuditImplementationPaths
	, ...currentLiveSourceInventoryAuditIntegrationPaths
].includes(path);

/**
 * Reverse one authenticated current-inventory audit transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseCurrentLiveSourceInventoryAuditUpdate = (source, update) => {
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
 * Remove only the authenticated current-inventory audit transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeCurrentLiveSourceInventoryAuditSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !currentLiveSourceInventoryAuditNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseCurrentLiveSourceInventoryAuditUpdate(current, update);
	}
	return current;
};
