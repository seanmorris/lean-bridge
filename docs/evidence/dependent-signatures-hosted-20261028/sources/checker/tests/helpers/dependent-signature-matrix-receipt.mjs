/**
 * Reconcile one exact hosted run of every dependent-signature producer.
 *
 * The four producer routes cover two author routes (ordinary Lean source and
 * independently reviewed Binding IR) across both the full and result-only
 * APIs.  The promoted matrix remains seventeen profiles by two author routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const dependentSignatureFocusedWorkflow
	= ".github/workflows/dependent-signature-complete.yml";
export const dependentSignatureMatrixRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);
export const dependentSignatureMatrixAuthorRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const dependentSignatureMatrixApiModes = Object.freeze([
	"full", "result-only"
]);

const lane = (key, workflowStem, profiles, required) => Object.freeze({
	key, workflowStem, profiles: Object.freeze(profiles)
	, required: Object.freeze(required)
});

export const dependentSignatureMatrixLanes = Object.freeze([
	lane("javascript", "browser", [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	], [
		"npmReportSha256", "browserReportSha256", "nodeExecutions"
		, "browserExecutions", "expected", "receipt", "sourceIdentities"
	])
	, lane("c-family", "native", ["c", "cpp"], [
		"reportSha256", "receipt", "profiles", "checks", "executions"
		, "sourceIdentities"
	])
	, lane("perl", "perl", ["perl"], [
		"configurations", "installModes", "builds", "executions"
		, "reportSha256", "records", "handoff"
	])
	, lane("python", "python", ["python"], [
		"runtime", "floor", "records", "executions", "archiveSha256"
		, "reportSha256"
	])
	, lane("rust", "rust", ["rust"], [
		"mode", "runtime", "floor", "toolchain", "counts", "executions"
		, "loadCeiling", "dispatchObserved"
	])
	, lane("dotnet", "dotnet", ["dotnet"], [
		"consumerCommit", "controls"
	])
	, lane("jvm", "jvm", ["java", "kotlin"], [
		"consumerCommit", "profiles", "counts", "resultOnly", "reviewed"
	])
	, lane("ruby", "ruby", ["ruby"], [
		"runtime", "floor", "rubyVersion", "mode", "executions"
	])
	, lane("php-native", "php", ["php-native"], [
		"runtime", "floor", "phpVersion", "composerVersion", "executions"
	])
	, lane("php-wasm", "php-wasm", ["php-wasm"], [
		"records", "executions", "packageFiles", "counts"
	])
	, lane("wit-wasi", "wit", ["wit-wasi"], [
		"mode", "runtime", "floor", "counts", "executions"
		, "nativeHostRequired", "standaloneWasi"
	])
]);

/**
 * Name the exact same-run artifact for one producer lane.
 *
 * @param laneValue - Closed producer lane.
 * @param producerCommit - Exact tested revision.
 */
export const dependentSignatureMatrixArtifactName = (
	laneValue, producerCommit
) => {
	assert.ok(dependentSignatureMatrixLanes.includes(laneValue));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	return `dependent-checked-record-${laneValue.workflowStem}-${producerCommit}`;
};

/**
 * Name one canonical independent-checker result in a downloaded artifact.
 *
 * @param laneValue - Closed producer lane.
 * @param route - Exact author route and API mode.
 * @param producerCommit - Exact tested revision.
 */
export const dependentSignatureMatrixResultPath = (
	laneValue, route, producerCommit
) => {
	assert.ok(dependentSignatureMatrixRoutes.includes(route));
	return `${dependentSignatureMatrixArtifactName(laneValue, producerCommit)}`
		+ `/dependent-checked-record-${laneValue.workflowStem}-ci`
		+ `/verification/${route}.json`;
};

const authorRoute = route => route.endsWith("ordinary-source")
	? "ordinary-source" : "reviewed-ir";
const apiMode = route => route.startsWith("result-only-")
	? "result-only" : "full";
const object = (value, label) => assert.ok(value
	&& typeof value === "object" && !Array.isArray(value), label);

const exactResult = (result, laneValue, route, producerCommit) => {
	object(result, `${laneValue.key}/${route}`);
	assert.equal(result.route, route, `${laneValue.key}/${route}/route`);
	assert.equal(result.producerCommit, producerCommit
		, `${laneValue.key}/${route}/producerCommit`);
	for(const key of laneValue.required)
		assert.ok(Object.hasOwn(result, key), `${laneValue.key}/${route}/${key}`);
	if(Object.hasOwn(result, "consumerCommit"))
		assert.equal(result.consumerCommit, producerCommit);
	if(Object.hasOwn(result, "sourceIdentities"))
		assert.deepEqual(result.sourceIdentities, {
			producer: producerCommit, checker: producerCommit
		});
	if(Object.hasOwn(result, "profiles"))
		assert.deepEqual(result.profiles, laneValue.profiles);
	if(Object.hasOwn(result, "executions"))
		assert.ok(Number.isSafeInteger(result.executions)
			&& result.executions > 0);
	if(Object.hasOwn(result, "mode"))
		assert.equal(result.mode, apiMode(route));
	if(Object.hasOwn(result, "resultOnly"))
		assert.equal(result.resultOnly, apiMode(route) === "result-only");
	if(Object.hasOwn(result, "reviewed"))
		assert.equal(result.reviewed, authorRoute(route) === "reviewed-ir");
	return Object.freeze({
		lane: laneValue.key, route, authorRoute: authorRoute(route)
		, apiMode: apiMode(route), profiles: [...laneValue.profiles]
	});
};

const runIdentity = ({
	repository, workflow, runId, runAttempt, producerCommit
}) => {
	assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
	assert.equal(workflow, dependentSignatureFocusedWorkflow);
	for(const value of [runId, runAttempt])
		assert.ok(Number.isSafeInteger(value) && value > 0);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	return { repository, workflow, runId, runAttempt, producerCommit };
};

const matrix = records => {
	assert.equal(records.length, 44);
	const selections = new Set(records.map(record =>
		`${record.lane}\0${record.route}`));
	assert.equal(selections.size, records.length);
	for(const laneValue of dependentSignatureMatrixLanes)
		for(const route of dependentSignatureMatrixRoutes)
			assert.ok(selections.has(`${laneValue.key}\0${route}`));
	const profiles = [...new Set(dependentSignatureMatrixLanes.flatMap(
		laneValue => laneValue.profiles))].sort();
	assert.equal(profiles.length, 17);
	return Object.freeze({
		lanes: dependentSignatureMatrixLanes.length, profiles: profiles.length
		, authorRoutes: dependentSignatureMatrixAuthorRoutes.length
		, apiModes: dependentSignatureMatrixApiModes.length
		, reports: records.length
		, cells: profiles.length * dependentSignatureMatrixAuthorRoutes.length
	});
};

/**
 * Read and authenticate all forty-four canonical checker summaries.
 *
 * @param read - Reader rooted at the artifact download directory.
 * @param options - Exact GitHub run identity.
 */
export const buildDependentSignatureMatrixReceipt = async (read, options) => {
	const run = runIdentity(options), records = [];
	for(const laneValue of dependentSignatureMatrixLanes)
		for(const route of dependentSignatureMatrixRoutes)
		{
			const path = dependentSignatureMatrixResultPath(
				laneValue, route, run.producerCommit);
			const bytes = await read(path);
			assert.ok(Buffer.isBuffer(bytes), path);
			const result = JSON.parse(bytes);
			assert.equal(bytes.toString(), canonicalJson(result), path);
			const accepted = exactResult(
				result, laneValue, route, run.producerCommit);
			records.push({
				...accepted
				, artifact: dependentSignatureMatrixArtifactName(
					laneValue, run.producerCommit)
				, path, bytes: bytes.length, sha256: sha256(bytes), result
			});
		}
	return Object.freeze({
		schemaVersion: 1
		, kind: "dependent-signature-installed-matrix-v1"
		, run, matrix: matrix(records), records
	});
};

/**
 * Validate a retained receipt without trusting any derived matrix counts.
 *
 * @param receipt - Parsed dependent-signature matrix receipt.
 */
export const validateDependentSignatureMatrixReceipt = receipt => {
	assert.deepEqual(Object.keys(receipt).sort(), [
		"kind", "matrix", "records", "run", "schemaVersion"
	]);
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "dependent-signature-installed-matrix-v1");
	const run = runIdentity(receipt.run);
	assert.deepEqual(receipt.run, run);
	assert.ok(Array.isArray(receipt.records));
	const accepted = [];
	for(const record of receipt.records)
	{
		assert.deepEqual(Object.keys(record).sort(), [
			"apiMode", "artifact", "authorRoute", "bytes", "lane", "path"
			, "profiles", "result", "route", "sha256"
		]);
		const laneValue = dependentSignatureMatrixLanes.find(value =>
			value.key === record.lane);
		assert.ok(laneValue);
		assert.ok(dependentSignatureMatrixRoutes.includes(record.route));
		assert.equal(record.artifact, dependentSignatureMatrixArtifactName(
			laneValue, run.producerCommit));
		assert.equal(record.path, dependentSignatureMatrixResultPath(
			laneValue, record.route, run.producerCommit));
		const bytes = canonicalJson(record.result);
		assert.equal(record.bytes, Buffer.byteLength(bytes));
		assert.equal(record.sha256, sha256(bytes));
		const result = exactResult(
			record.result, laneValue, record.route, run.producerCommit);
		assert.deepEqual({
			lane: record.lane, route: record.route
			, authorRoute: record.authorRoute, apiMode: record.apiMode
			, profiles: record.profiles
		}, result);
		accepted.push(result);
	}
	assert.deepEqual(receipt.matrix, matrix(accepted));
	assert.deepEqual(receipt.matrix, {
		lanes: 11, profiles: 17, authorRoutes: 2, apiModes: 2
		, reports: 44, cells: 34
	});
	return receipt;
};
