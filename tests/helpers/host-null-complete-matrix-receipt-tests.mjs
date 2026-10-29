/**
 * Mutation controls for the focused HostNull same-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	hostNullCompleteHostedLanes, hostNullCompletePositions
	, hostNullCompleteRoutes
} from "./host-null-complete-hosted-archive.mjs";
import {
	buildHostNullCompleteMatrixReceipt, hostNullCompleteFocusedWorkflow
	, hostNullCompleteMatrixArtifactName
	, validateHostNullCompleteMatrixReceipt
} from "./host-null-complete-matrix-receipt.mjs";

const producerCommit = "a".repeat(40);
const identity = Object.freeze({
	repository: "seanmorris/lean-bridge"
	, workflow: hostNullCompleteFocusedWorkflow
	, producerCommit, runId: 123, runAttempt: 1
});
const digests = Object.freeze({
	ordinary: "b".repeat(64), reviewed: "c".repeat(64)
});
const fakeVerify = async (lane, root, producer) => {
	assert.equal(root
		, `/tmp/host-null-complete/${hostNullCompleteMatrixArtifactName(
			lane, producerCommit
		)}`);
	assert.equal(producer, producerCommit);
	const routes = hostNullCompleteRoutes.map(route => ({
		route, sourceRoute: route === "ordinary" ? "ordinary-source" : "reviewed-ir"
		, receiptPath: `${route}/package-set-receipt.json`
		, receiptSha256: digests[route]
		, packages: [{ name: `${lane.id}-${route}`, role: "component" }]
		, ...(lane.id === "systems"
			? { rustDependenciesSha256: "d".repeat(64) } : {})
	}));
	return {
		lane: lane.id, profiles: lane.profiles, producerCommit: producer
		, semantic: { accepted: true, lane: lane.id }
		, routes
		, cells: hostNullCompleteRoutes.flatMap(route =>
			lane.profiles.flatMap(profile =>
				hostNullCompletePositions.map(position => ({
					lane: lane.id, route, profile, position
					, receiptSha256: digests[route]
				})
				)
			)
		)
	};
};
const clone = value => JSON.parse(canonicalJson(value));

test("focused HostNull receipt closes all seven lanes and 170 cells", async () => {
	const receipt = await buildHostNullCompleteMatrixReceipt(
		"/tmp/host-null-complete", identity, fakeVerify
	);
	assert.deepEqual(receipt.matrix, {
		lanes: 7, profiles: 17, routes: 14, cells: 170
	});
	assert.equal(receipt.records.length, hostNullCompleteHostedLanes.length);
	assert.equal(validateHostNullCompleteMatrixReceipt(receipt), receipt);
});

test("focused HostNull receipt rejects missing, duplicate and forged claims", async t => {
	const original = await buildHostNullCompleteMatrixReceipt(
		"/tmp/host-null-complete", identity, fakeVerify
	);
	const mutations = [
		receipt => { receipt.records.pop(); }
		, receipt => { receipt.records[0].artifact = "host-null-forged"; }
		, receipt => { receipt.records[0].cells.pop(); }
		, receipt => { receipt.records[0].cells[0].receiptSha256 = "e".repeat(64); }
		, receipt => { receipt.run.producerCommit = "f".repeat(40); }
		, receipt => { receipt.matrix.cells = 169; }
	];
	for(const mutate of mutations)
	{
		const receipt = clone(original);
		mutate(receipt);
		assert.throws(() => validateHostNullCompleteMatrixReceipt(receipt));
	}
	t.diagnostic(`${mutations.length} receipt forgeries refused`);
});
