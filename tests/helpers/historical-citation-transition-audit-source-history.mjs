/**
 * Preserve the historical citation-transition audit repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historicalCitationTransitionAuditHistoryPath
	= "docs/evidence/historical-citation-transition-audit-source-history-20261101.json";
export const historicalCitationTransitionAuditPredecessor
	= "0d805a33c3a6b1eb6850498a47beb3349eb7bde5";
export const historicalCitationTransitionAuditImplementation
	= "f01067c7899a1abb2e66b547fb4ec7fcdff8653a";
export const historicalCitationTransitionAuditImplementationPaths
	= Object.freeze([
		"tests/helpers/consumer-type-surface-documentation-contract-repair-source-history-tests.mjs"
	]);
export const historicalCitationTransitionAuditIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const historicalCitationTransitionAuditHistoryAdditions
	= Object.freeze([
		"scripts/update-historical-citation-transition-audit-source-history.mjs"
		, "tests/helpers/historical-citation-transition-audit-source-history-tests.mjs"
		, "tests/helpers/historical-citation-transition-audit-source-history.mjs"
	]);

/**
 * Assert that historical pin counts are checked at their recorded transition,
 * independently of later current-state changes.
 *
 * @param source - Complete historical citation test source.
 */
export const assertHistoricalCitationTransitionAudit = source => {
	assert.match(source
		, /const update = history[.]integrationUpdates[.]find\(item =>\n\t\t\titem[.]path === "docs\/type-surface[.]v1[.]json"\);/u);
	assert.match(source
		, /const current = await sourceAtFinHistoryMilestone\(/u);
	assert.match(source
		, /reverseConsumerTypeSurfaceDocumentationContractRepairUpdate\(/u);
	assert.doesNotMatch(source
		, /await readFile\("docs\/type-surface[.]v1[.]json", "utf8"\)/u);
};

const historyUrl = new URL(
	"../../" + historicalCitationTransitionAuditHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const historicalCitationTransitionAuditNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl)
			? record().updates.map(update => update.path)
			: historicalCitationTransitionAuditImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path => [
	...historicalCitationTransitionAuditImplementationPaths
	, ...historicalCitationTransitionAuditIntegrationPaths
].includes(path);

/**
 * Reverse one authenticated historical-citation audit transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseHistoricalCitationTransitionAuditUpdate = (
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
 * Remove only the authenticated historical-citation audit transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeHistoricalCitationTransitionAuditSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !historicalCitationTransitionAuditNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHistoricalCitationTransitionAuditUpdate(
				current, update);
	}
	return current;
};
