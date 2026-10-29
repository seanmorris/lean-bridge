/**
 * Controls for the same-run optional-parameter aggregate receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	optionalParameterMatrixCases, optionalParameterMatrixLanes
	, optionalParameterMatrixRoutes
} from "./optional-parameter-matrix.mjs";
import {
	buildOptionalParameterMatrixReceipt, optionalParameterMatrixResultPath
	, validateOptionalParameterMatrixReceipt
} from "./optional-parameter-matrix-receipt.mjs";

const producerCommit = "a".repeat(40);
const metrics = lane => lane.key === "npm"
	? { checks: 27, rejections: 7, executions: 2, browserProfiles: 3 }
	: lane.key === "native" ? { checks: 43, rejections: 4, executions: 4 }
		: lane.key === "php" ? { checks: 46, rejections: 44, executions: 16 }
			: lane.key === "managed-jvm" ? { checks: 46, executions: 4 }
				: { checks: 23, executions: 2 };
const result = (lane, route) => ({
	lane: lane.key, route: route.reportRoute, producerCommit
	, profiles: [...lane.profiles], cases: optionalParameterMatrixCases
	, ...metrics(lane)
});
const records = () => new Map(
	optionalParameterMatrixLanes.flatMap(lane =>
		optionalParameterMatrixRoutes.map(route => [
			optionalParameterMatrixResultPath(lane, route, producerCommit)
			, Buffer.from(canonicalJson(result(lane, route)))
		])
	)
);
const build = values => buildOptionalParameterMatrixReceipt(path => {
	assert.ok(values.has(path), path); return values.get(path);
}, {
	repository: "seanmorris/lean-bridge", producerCommit
	, runId: 40700000001, runAttempt: 2
});

test("optional matrix receipt authenticates all twenty same-run reports", async () => {
	const receipt = await build(records());
	assert.equal(validateOptionalParameterMatrixReceipt(receipt), receipt);
	assert.deepEqual(receipt.matrix
		, { lanes: 10, routes: 2, profiles: 17, cells: 34 });
	assert.deepEqual(receipt.totals
		, { reports: 20, checks: 600, executions: 76, rejections: 110 });
	assert.equal(new Set(receipt.records.map(item => item.artifact)).size, 10);
	assert.equal(new Set(receipt.records.map(item => item.path)).size, 20);
});

test("optional matrix receipt rejects absent, noncanonical and drifted reports", async () => {
	const absent = records(); absent.delete(absent.keys().next().value);
	await assert.rejects(build(absent));
	const noncanonical = records(), path = noncanonical.keys().next().value;
	noncanonical.set(path, Buffer.from(JSON.stringify(
		JSON.parse(noncanonical.get(path)), null, 2
	)));
	await assert.rejects(build(noncanonical));
	const drifted = records(), value = JSON.parse(drifted.get(path));
	value.cases.explicitHostNull = false;
	drifted.set(path, Buffer.from(canonicalJson(value)));
	await assert.rejects(build(drifted));
});

test("retained optional matrix receipts reject derived-field substitution", async () => {
	const original = await build(records());
	for(const mutate of [
		value => { value.records.pop(); }
		, value => { value.records[0].sha256 = "0".repeat(64); }
		, value => { value.records[0].result.checks++; }
		, value => { value.totals.executions++; }
		, value => { value.run.producerCommit = "b".repeat(40); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => validateOptionalParameterMatrixReceipt(changed));
	}
});

test("consumer CI downloads, reconciles, retains and enforces the matrix", async () => {
	const workflow = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /^ {2}optional-parameter-matrix:\n/gmu);
	assert.match(workflow
		, /pattern: optional-parameter-\*-\$\{\{ github\.sha \}\}/u);
	assert.match(workflow, /node scripts\/reconcile-optional-parameter-matrix\.mjs \\\n/u);
	assert.match(workflow
		, /name: optional-parameter-matrix-\$\{\{ github\.sha \}\}/u);
	assert.match(workflow
		, /if: needs\.optional-parameter-matrix\.result != 'success'/u);
});
