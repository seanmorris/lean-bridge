/**
 * Preserve the reviewed-corpus documentation contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const consumerTypeSurfaceDocumentationContractRepairHistoryPath
	= "docs/evidence/consumer-type-surface-documentation-contract-repair-source-history-20261031.json";
export const consumerTypeSurfaceDocumentationContractRepairPredecessor
	= "6b6e049f018f9525f0f64a5d1f41f195305aa5da";
export const consumerTypeSurfaceDocumentationContractRepairImplementation
	= "6834dd438c3982bc732733bc647fd82e7a6e0af6";
export const consumerTypeSurfaceDocumentationContractRepairImplementationPaths
	= Object.freeze(["tests/documentation.test.mjs"]);
export const consumerTypeSurfaceDocumentationContractRepairIntegrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/consumer-type-surface-receipt-repair-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const consumerTypeSurfaceDocumentationContractRepairHistoryAdditions
	= Object.freeze([
		"scripts/update-consumer-type-surface-documentation-contract-repair-source-history.mjs"
		, "tests/helpers/consumer-type-surface-documentation-contract-repair-source-history-tests.mjs"
		, "tests/helpers/consumer-type-surface-documentation-contract-repair-source-history.mjs"
	]);

const historyUrl = new URL(
	"../../" + consumerTypeSurfaceDocumentationContractRepairHistoryPath
	, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const consumerTypeSurfaceDocumentationContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: consumerTypeSurfaceDocumentationContractRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path)
			: consumerTypeSurfaceDocumentationContractRepairIntegrationPaths)
	])].sort());
const allowedPath = path =>
	consumerTypeSurfaceDocumentationContractRepairImplementationPaths.includes(
		path)
	|| consumerTypeSurfaceDocumentationContractRepairIntegrationPaths.includes(
		path);

/**
 * Assert the bounded reviewed-corpus checkout and receipt contract.
 *
 * @param job - Complete reviewed-ir-admission workflow job.
 */
export const assertReviewedCorpusReceiptContract = job => {
	assert.match(job, /^ {4}needs: type-surface-authentication$/mu);
	assert.match(job, /^ {4}timeout-minutes: 60$/mu);
	assert.match(job
		, /fetch-depth: 1\n {10}persist-credentials: false\n {10}sparse-checkout: \$\{\{ env[.]LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT \}\}\n {10}sparse-checkout-cone-mode: false/u);
	assert.doesNotMatch(job, /fetch-depth: 0/u);
	assert.match(job
		, /uses: actions\/download-artifact@v8\n {8}with:\n {10}name: consumer-type-surface-\$\{\{ github[.]sha \}\}\n {10}path: build\/consumer-type-surface/u);
	assert.match(job
		, /LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT=\$GITHUB_WORKSPACE\/build\/consumer-type-surface\/receipt[.]json/u);
	assert.equal(job.split(
		"Restore the authenticated type-surface receipt").length - 1, 1);
	assert.equal(job.split(
		"Bind the authenticated type-surface receipt").length - 1, 1);
	const restore = job.indexOf(
		"Restore the authenticated type-surface receipt");
	const bind = job.indexOf("Bind the authenticated type-surface receipt");
	const execute = job.indexOf("npm run test:type-corpus:reviewed");
	assert.ok(restore >= 0 && restore < bind);
	assert.ok(bind < execute);
};

/**
 * Reverse one exact reviewed-corpus documentation transition.
 *
 * @param source - Complete later source.
 * @param update - Exact reversible transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseConsumerTypeSurfaceDocumentationContractRepairUpdate = (
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
 * Remove only the reviewed-corpus documentation contract repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 * @returns {string} Normalized source.
 */
export const beforeConsumerTypeSurfaceDocumentationContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !consumerTypeSurfaceDocumentationContractRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current
				= reverseConsumerTypeSurfaceDocumentationContractRepairUpdate(
					current, update);
	}
	return current;
};
