/**
 * Reconcile every independently checked optional-parameter lane into one
 * deterministic hosted-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	optionalParameterMatrixCases, optionalParameterMatrixLanes
	, optionalParameterMatrixRoutes, optionalParameterMatrixWorkflow
	, validateOptionalParameterMatrixResults
} from "./optional-parameter-matrix.mjs";

const laneMetrics = lane => {
	if(lane.key === "npm") return {
		checks: 27, rejections: 7, executions: 2, browserProfiles: 3
	};
	if(lane.key === "native") return {
		checks: 43, rejections: 4, executions: 4
	};
	if(lane.key === "php") return {
		checks: 46, rejections: 44, executions: 16
	};
	if(lane.key === "managed-jvm") return { checks: 46, executions: 4 };
	return { checks: 23, executions: 2 };
};

/**
 * Name the exact same-run artifact for one lane.
 *
 * @param lane - Closed matrix lane.
 * @param producerCommit - Exact tested revision.
 */
export const optionalParameterMatrixArtifactName = (lane, producerCommit) => {
	assert.ok(optionalParameterMatrixLanes.includes(lane));
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
export const optionalParameterMatrixResultPath = (
	lane, route, producerCommit
) => {
	assert.ok(optionalParameterMatrixRoutes.includes(route));
	return `${optionalParameterMatrixArtifactName(lane, producerCommit)}/${route.reportRoute}/verified.json`;
};

const exactResult = (result, lane, route, producerCommit) => {
	const metrics = laneMetrics(lane);
	assert.deepEqual(Object.keys(result).sort(), [
		"cases", "checks", "executions", "lane", "producerCommit", "profiles"
		, "route", ...Object.hasOwn(metrics, "rejections") ? ["rejections"] : []
		, ...Object.hasOwn(metrics, "browserProfiles")
			? ["browserProfiles"] : []
	].sort());
	assert.equal(result.lane, lane.key);
	assert.equal(result.route, route.reportRoute);
	assert.equal(result.producerCommit, producerCommit);
	assert.deepEqual(result.profiles, [...lane.profiles]);
	assert.deepEqual(result.cases, optionalParameterMatrixCases);
	for(const [key, value] of Object.entries(metrics))
		assert.equal(result[key], value, `${lane.key}/${route.reportRoute}/${key}`);
	return result;
};

const total = (results, key) => results.reduce(
	(sum, result) => sum + (result[key] ?? 0), 0
);

const summary = results => Object.freeze({
	reports: results.length, checks: total(results, "checks")
	, executions: total(results, "executions")
	, rejections: total(results, "rejections")
});

const identity = ({ repository, runId, runAttempt, producerCommit }) => {
	assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
	for(const value of [runId, runAttempt])
		assert.ok(Number.isSafeInteger(value) && value > 0);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	return {
		repository, workflow: optionalParameterMatrixWorkflow
		, runId, runAttempt, producerCommit
	};
};

/**
 * Read and authenticate the twenty canonical checker results.
 *
 * @param read - Reader rooted at the artifact download directory.
 * @param options - Exact GitHub run identity.
 */
export const buildOptionalParameterMatrixReceipt = async (read, options) => {
	const run = identity(options), records = [], results = [];
	for(const lane of optionalParameterMatrixLanes)
		for(const route of optionalParameterMatrixRoutes)
		{
			const path = optionalParameterMatrixResultPath(
				lane, route, run.producerCommit
			);
			const bytes = await read(path);
			assert.ok(Buffer.isBuffer(bytes));
			const result = JSON.parse(bytes);
			assert.equal(bytes.toString(), canonicalJson(result), path);
			exactResult(result, lane, route, run.producerCommit);
			results.push(result);
			records.push({
				lane: lane.key, route: route.reportRoute
				, artifact: optionalParameterMatrixArtifactName(
					lane, run.producerCommit
				)
				, path, bytes: bytes.length, sha256: sha256(bytes), result
			});
		}
	const matrix = validateOptionalParameterMatrixResults(
		results, run.producerCommit
	);
	return Object.freeze({
		schemaVersion: 1, kind: "optional-parameter-installed-matrix-v1"
		, run, matrix, cases: optionalParameterMatrixCases
		, totals: summary(results), records
	});
};

/**
 * Validate a retained receipt without trusting its derived fields.
 *
 * @param receipt - Parsed optional-parameter matrix receipt.
 */
export const validateOptionalParameterMatrixReceipt = receipt => {
	assert.deepEqual(Object.keys(receipt).sort(), [
		"cases", "kind", "matrix", "records", "run", "schemaVersion", "totals"
	]);
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "optional-parameter-installed-matrix-v1");
	const run = identity(receipt.run);
	assert.deepEqual(receipt.run, run);
	assert.deepEqual(receipt.cases, optionalParameterMatrixCases);
	assert.equal(receipt.records.length, 20);
	const results = [];
	for(const record of receipt.records)
	{
		assert.deepEqual(Object.keys(record).sort(), [
			"artifact", "bytes", "lane", "path", "result", "route", "sha256"
		]);
		const lane = optionalParameterMatrixLanes.find(item =>
			item.key === record.lane);
		const route = optionalParameterMatrixRoutes.find(item =>
			item.reportRoute === record.route);
		assert.ok(lane); assert.ok(route);
		assert.equal(record.artifact
			, optionalParameterMatrixArtifactName(lane, run.producerCommit));
		assert.equal(record.path, optionalParameterMatrixResultPath(
			lane, route, run.producerCommit
		));
		exactResult(record.result, lane, route, run.producerCommit);
		const bytes = canonicalJson(record.result);
		assert.equal(record.bytes, Buffer.byteLength(bytes));
		assert.equal(record.sha256, sha256(bytes));
		results.push(record.result);
	}
	const matrix = validateOptionalParameterMatrixResults(
		results, run.producerCommit
	);
	assert.deepEqual(receipt.matrix, matrix);
	assert.deepEqual(receipt.totals, summary(results));
	assert.deepEqual(receipt.totals, {
		reports: 20, checks: 600, executions: 76, rejections: 110
	});
	return receipt;
};
