/**
 * Controls for the complete direct proof-erasure package matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	closeDirectProofErasureMatrix
	, directProofErasureMatrixLaneFor
	, directProofErasureMatrixLanes
	, directProofErasureMatrixProducer
	, directProofErasureMatrixRoutes
	, validateDirectProofErasureMatrixResults
} from "./direct-proof-erasure-matrix.mjs";
import {
	auditProofErasureEvidence, proofErasureEvidenceAuditReport
} from "./proof-erasure-evidence-audit.mjs";
import { readTypeSurfaceContracts } from "./type-surface-contracts.mjs";

const inventoryPromise = readFile("docs/type-surface.v1.json", "utf8")
	.then(JSON.parse);
const auditPromise = Promise.all([
	inventoryPromise, readTypeSurfaceContracts()
]).then(([inventory, contracts]) => proofErasureEvidenceAuditReport(
	auditProofErasureEvidence(inventory, contracts)
));
const result = (lane, route) => ({
	lane: lane.key, route: route.reportRoute
	, producerCommit: directProofErasureMatrixProducer
	, profiles: [...lane.profiles]
});
const results = () => directProofErasureMatrixLanes.flatMap(lane =>
	directProofErasureMatrixRoutes.map(route => result(lane, route)));

test("direct proof matrix assigns all seventeen profiles to ten hosted lanes", () => {
	assert.equal(directProofErasureMatrixLanes.length, 10);
	assert.deepEqual(directProofErasureMatrixRoutes, [
		{ authorPath: "ordinary-source", reportRoute: "ordinary" }
		, { authorPath: "reviewed-ir", reportRoute: "reviewed" }
	]);
	const profiles = directProofErasureMatrixLanes.flatMap(lane =>
		lane.profiles);
	assert.equal(profiles.length, 17);
	assert.equal(new Set(profiles).size, 17);
	for(const profile of profiles)
		assert.ok(directProofErasureMatrixLaneFor(profile).profiles.includes(profile));
	assert.throws(() => directProofErasureMatrixLaneFor("unknown"));
});

test("direct proof matrix closes all 204 cells without overclaiming results", async () => {
	const closure = closeDirectProofErasureMatrix(await auditPromise);
	assert.deepEqual(closure.counts, {
		cells: 204, retainedInstalled: 102
		, directInstalled: 68, explicitRefusals: 34
	});
	const positionCounts = Object.fromEntries([
		"parameter", "result", "field", "callback-parameter"
		, "callback-result", "signature"
	].map(position => [
		position
		, closure.dispositions.filter(item =>
			item.cell.endsWith(`/${position}`)).length
	]));
	assert.deepEqual(positionCounts, {
		parameter: 34, result: 34, field: 34
		, "callback-parameter": 34, "callback-result": 34, signature: 34
	});
	assert.ok(closure.dispositions.filter(item =>
		item.cell.endsWith("/result")).every(item =>
		item.disposition === "explicit-refusal"
		&& item.reason === "proof-valued-export-has-no-runtime-api"
		&& item.control.diagnostic === "proof-only"));
	assert.ok(closure.dispositions.filter(item =>
		item.disposition === "direct-installed").every(item =>
		item.route === "ordinary" || item.route === "reviewed"));
});

test("direct proof matrix requires every lane, route, profile and producer", () => {
	const original = results();
	assert.deepEqual(validateDirectProofErasureMatrixResults(original), {
		lanes: 10, routes: 2, profiles: 17, cells: 34
	});
	for(const mutate of [
		value => { value.pop(); }
		, value => { value[0].route = "missing"; }
		, value => { value[0].producerCommit = "0".repeat(40); }
		, value => { value[0].profiles = ["c"]; }
		, value => { value[1] = structuredClone(value[0]); }
	]) {
		const changed = structuredClone(original);
		mutate(changed);
		assert.throws(() => validateDirectProofErasureMatrixResults(changed));
	}
});

test("direct proof matrix rejects retained-audit drift", async () => {
	const original = await auditPromise;
	for(const mutate of [
		value => { value.counts.cells--; }
		, value => { value.bindings.pop(); }
		, value => { value.residual[0].cell = "unknown"; }
		, value => { value.residual[0].cell
			= value.residual[1].cell; }
	]) {
		const changed = structuredClone(original);
		mutate(changed);
		assert.throws(() => closeDirectProofErasureMatrix(changed));
	}
});
