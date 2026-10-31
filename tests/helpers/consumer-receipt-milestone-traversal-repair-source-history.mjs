/**
 * Preserve the exact-milestone traversal repair for the consumer receipt
 * source-history contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerReceiptMilestoneTraversalRepairHistoryPath
	= "docs/evidence/consumer-receipt-milestone-traversal-repair-source-history-20261031.json";
export const consumerReceiptMilestoneTraversalRepairPredecessor
	= "0b992cfbbd749a44291f1d0d50377e3d85c7ed3a";
export const consumerReceiptMilestoneTraversalRepairImplementation
	= "6db91212bd5d52420b0203a545b6823044174246";
export const consumerReceiptMilestoneTraversalRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/consumer-type-surface-receipt-repair-source-history-tests.mjs"
	]);
export const consumerReceiptMilestoneTraversalRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerReceiptMilestoneTraversalRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-consumer-receipt-milestone-traversal-repair-source-history.mjs"
		, "tests/helpers/consumer-receipt-milestone-traversal-repair-source-history-tests.mjs"
		, "tests/helpers/consumer-receipt-milestone-traversal-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + consumerReceiptMilestoneTraversalRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerReceiptMilestoneTraversalRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerReceiptMilestoneTraversalRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	consumerReceiptMilestoneTraversalRepairImplementationPaths.includes(path)
	|| consumerReceiptMilestoneTraversalRepairIntegrationPaths.includes(path);

/**
 * Require the assertion to reconstruct the exact recorded integration state.
 *
 * @param {string} source - Complete implementation source.
 */
export const assertConsumerReceiptMilestoneTraversalRepair = source => {
	assert.doesNotMatch(source
		, /beforeConsumerTypeSurfaceDocumentationContractRepairSource/u);
	assert.match(source, /const integration = history[.]integrationUpdates[.]find/u);
	assert.match(source, /update[.]path === "docs\/type-surface[.]v1[.]json"/u);
	assert.match(source, /let restored = await sourceAtFinHistoryMilestone\(\s*integration[.]path, integration[.]currentSha256\)/u);
	return { exactDigestTraversal: true, restoredPins: 96 };
};

/**
 * Reverse one authenticated exact-milestone traversal repair transition.
 *
 * @param {string} source - Complete later source.
 * @param {object} update - Authenticated reversible transition.
 */
export const reverseConsumerReceiptMilestoneTraversalRepairUpdate = (
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
 * Remove only the authenticated exact-milestone traversal repair.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional exact stopping SHA-256.
 */
export const beforeConsumerReceiptMilestoneTraversalRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerReceiptMilestoneTraversalRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseConsumerReceiptMilestoneTraversalRepairUpdate(
				current, update);
	}
	return current;
};
