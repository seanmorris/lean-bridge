/**
 * Controls for the same-run direct proof-erasure aggregate receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	directProofErasureMatrixLanes, directProofErasureMatrixRoutes
} from "./direct-proof-erasure-matrix.mjs";
import {
	buildDirectProofErasureMatrixReceipt
	, directProofErasureFocusedWorkflow
	, directProofErasureMatrixResultPath
	, validateDirectProofErasureMatrixReceipt
} from "./direct-proof-erasure-matrix-receipt.mjs";

const producerCommit = "a".repeat(40);
const metrics = lane => lane.checker === "npm"
	? { checks: 1005, executions: 2, rejections: 4, browserProfiles: 3 }
	: lane.checker === "native"
		? { checks: 2010, executions: 4, rejectedProofArguments: 2 }
		: lane.checker === "php"
			? { checks: 2010, executions: 16, rejectedProofArguments: 28 }
			: lane.checker === "language"
				? { checks: 1005, executions: 2, rejectedProofArguments: 1 }
				: lane.checker === "managed"
					? { checks: 1005 * lane.profiles.length
						, executions: 2 * lane.profiles.length
						, rejectedProofArguments: lane.profiles.length }
					: { checks: 1005, executions: 2, rejectedProofArguments: 1 };
const result = (lane, route) => ({
	...lane.checker === "language" ? { profile: lane.profile }
		: lane.checker === "managed" ? { group: lane.group }
			: lane.checker === "wit" ? { profile: "wit-wasi" }
				: { profiles: [...lane.profiles] }
	, route: route.reportRoute, producerCommit, ...metrics(lane)
});
const records = () => new Map(directProofErasureMatrixLanes.flatMap(lane =>
	directProofErasureMatrixRoutes.map(route => [
		directProofErasureMatrixResultPath(lane, route, producerCommit)
		, Buffer.from(canonicalJson(result(lane, route)))
	])));
const build = values => buildDirectProofErasureMatrixReceipt(path => {
	assert.ok(values.has(path), path); return values.get(path);
}, {
	repository: "seanmorris/lean-bridge"
	, workflow: directProofErasureFocusedWorkflow
	, producerCommit, runId: 40800000001, runAttempt: 1
});

test("direct proof-erasure receipt authenticates all twenty same-run reports", async () => {
	const receipt = await build(records());
	assert.equal(validateDirectProofErasureMatrixReceipt(receipt), receipt);
	assert.deepEqual(receipt.matrix
		, { lanes: 10, routes: 2, profiles: 17, cells: 34 });
	assert.deepEqual(receipt.totals, {
		reports: 20, checks: 26130, executions: 76, rejections: 8
		, rejectedProofArguments: 76, browserProfiles: 6
	});
	assert.equal(new Set(receipt.records.map(item => item.artifact)).size, 10);
});

test("direct proof-erasure receipt rejects absent and substituted reports", async () => {
	const absent = records(); absent.delete(absent.keys().next().value);
	await assert.rejects(build(absent));
	const changed = records(), path = changed.keys().next().value;
	const value = JSON.parse(changed.get(path)); value.checks++;
	changed.set(path, Buffer.from(canonicalJson(value)));
	await assert.rejects(build(changed));
	const receipt = await build(records());
	receipt.records[0].sha256 = "0".repeat(64);
	assert.throws(() => validateDirectProofErasureMatrixReceipt(receipt));
});
