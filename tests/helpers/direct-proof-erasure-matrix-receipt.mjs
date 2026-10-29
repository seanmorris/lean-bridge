/**
 * Reconcile every independently checked direct proof-erasure lane into one
 * deterministic hosted-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	directProofErasureMatrixLanes, directProofErasureMatrixRoutes
	, validateDirectProofErasureMatrixResults
} from "./direct-proof-erasure-matrix.mjs";

export const directProofErasureFocusedWorkflow
	= ".github/workflows/direct-proof-erasure-complete.yml";

/**
 * Name the exact same-run artifact for one lane.
 *
 * @param lane - Closed matrix lane.
 * @param producerCommit - Exact tested revision.
 */
export const directProofErasureMatrixArtifactName = (
	lane, producerCommit
) => {
	assert.ok(directProofErasureMatrixLanes.includes(lane));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	return `${lane.artifactPrefix}-${producerCommit}`;
};

/**
 * Name one canonical checker result inside a downloaded artifact.
 *
 * @param lane - Closed matrix lane.
 * @param route - Ordinary or reviewed route.
 * @param producerCommit - Exact tested revision.
 */
export const directProofErasureMatrixResultPath = (
	lane, route, producerCommit
) => {
	assert.ok(directProofErasureMatrixRoutes.includes(route));
	return `${directProofErasureMatrixArtifactName(lane, producerCommit)}/${route.reportRoute}/verified.json`;
};

const expected = lane => {
	if(lane.checker === "npm") return {
		checks: 1005, executions: 2, rejections: 4, browserProfiles: 3
	};
	if(lane.checker === "native") return {
		checks: 2010, executions: 4, rejectedProofArguments: 2
	};
	if(lane.checker === "php") return {
		checks: 2010, executions: 16, rejectedProofArguments: 28
	};
	if(lane.checker === "language") return {
		checks: 1005, executions: 2, rejectedProofArguments: 1
	};
	if(lane.checker === "managed") return {
		checks: 1005 * lane.profiles.length
		, executions: 2 * lane.profiles.length
		, rejectedProofArguments: lane.profiles.length
	};
	assert.equal(lane.checker, "wit");
	return { checks: 1005, executions: 2, rejectedProofArguments: 1 };
};

const exactResult = (result, lane, route, producerCommit) => {
	const metrics = expected(lane), identity = lane.checker === "language"
		? { profile: lane.profile }
		: lane.checker === "managed" ? { group: lane.group }
			: lane.checker === "wit" ? { profile: "wit-wasi" }
				: { profiles: [...lane.profiles] };
	assert.deepEqual(Object.keys(result).sort(), [
		...Object.keys(identity), "route", "producerCommit"
		, ...Object.keys(metrics)
	].sort());
	assert.equal(result.route, route.reportRoute);
	assert.equal(result.producerCommit, producerCommit);
	assert.deepEqual(Object.fromEntries(Object.keys(identity).map(key => [
		key, result[key]
	])), identity);
	for(const [key, value] of Object.entries(metrics))
		assert.equal(result[key], value, `${lane.key}/${route.reportRoute}/${key}`);
	return Object.freeze({
		lane: lane.key, route: route.reportRoute, producerCommit
		, profiles: [...lane.profiles], ...metrics
	});
};

const total = (results, key) => results.reduce(
	(sum, result) => sum + (result[key] ?? 0), 0
);
const summary = results => Object.freeze({
	reports: results.length, checks: total(results, "checks")
	, executions: total(results, "executions")
	, rejections: total(results, "rejections")
	, rejectedProofArguments: total(results, "rejectedProofArguments")
	, browserProfiles: total(results, "browserProfiles")
});
const identity = ({ repository, workflow, runId, runAttempt, producerCommit }) => {
	assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
	assert.equal(workflow, directProofErasureFocusedWorkflow);
	for(const value of [runId, runAttempt])
		assert.ok(Number.isSafeInteger(value) && value > 0);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	return { repository, workflow, runId, runAttempt, producerCommit };
};

/**
 * Read and authenticate all twenty canonical checker results.
 *
 * @param read - Reader rooted at the artifact download directory.
 * @param options - Exact GitHub run identity.
 */
export const buildDirectProofErasureMatrixReceipt = async (read, options) => {
	const run = identity(options), records = [], results = [];
	for(const lane of directProofErasureMatrixLanes)
		for(const route of directProofErasureMatrixRoutes)
		{
			const path = directProofErasureMatrixResultPath(
				lane, route, run.producerCommit
			);
			const bytes = await read(path);
			assert.ok(Buffer.isBuffer(bytes));
			const original = JSON.parse(bytes);
			assert.equal(bytes.toString(), canonicalJson(original), path);
			const result = exactResult(
				original, lane, route, run.producerCommit
			);
			results.push(result);
			records.push({
				lane: lane.key, route: route.reportRoute
				, artifact: directProofErasureMatrixArtifactName(
					lane, run.producerCommit
				)
				, path, bytes: bytes.length, sha256: sha256(bytes)
				, result: original
			});
		}
	const matrix = validateDirectProofErasureMatrixResults(
		results, run.producerCommit
	);
	return Object.freeze({
		schemaVersion: 1, kind: "direct-proof-erasure-installed-matrix-v1"
		, run, matrix, totals: summary(results), records
	});
};

/**
 * Validate a retained receipt without trusting its derived fields.
 *
 * @param receipt - Parsed direct proof-erasure matrix receipt.
 */
export const validateDirectProofErasureMatrixReceipt = receipt => {
	assert.deepEqual(Object.keys(receipt).sort(), [
		"kind", "matrix", "records", "run", "schemaVersion", "totals"
	]);
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "direct-proof-erasure-installed-matrix-v1");
	const run = identity(receipt.run);
	assert.deepEqual(receipt.run, run);
	assert.equal(receipt.records.length, 20);
	const results = [];
	for(const record of receipt.records)
	{
		assert.deepEqual(Object.keys(record).sort(), [
			"artifact", "bytes", "lane", "path", "result", "route", "sha256"
		]);
		const lane = directProofErasureMatrixLanes.find(item =>
			item.key === record.lane);
		const route = directProofErasureMatrixRoutes.find(item =>
			item.reportRoute === record.route);
		assert.ok(lane); assert.ok(route);
		assert.equal(record.artifact
			, directProofErasureMatrixArtifactName(lane, run.producerCommit));
		assert.equal(record.path, directProofErasureMatrixResultPath(
			lane, route, run.producerCommit
		));
		const bytes = canonicalJson(record.result);
		assert.equal(record.bytes, Buffer.byteLength(bytes));
		assert.equal(record.sha256, sha256(bytes));
		results.push(exactResult(
			record.result, lane, route, run.producerCommit
		));
	}
	assert.deepEqual(receipt.matrix, validateDirectProofErasureMatrixResults(
		results, run.producerCommit
	));
	assert.deepEqual(receipt.totals, summary(results));
	assert.deepEqual(receipt.totals, {
		reports: 20, checks: 26130, executions: 76, rejections: 8
		, rejectedProofArguments: 76, browserProfiles: 6
	});
	return receipt;
};
