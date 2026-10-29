/**
 * Reconcile every independently checked HostNull lane into one deterministic
 * exact-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	hostNullCompleteCells, hostNullCompleteHostedLanes
	, hostNullCompletePositions, hostNullCompleteProfiles
	, hostNullCompleteRoutes, verifyHostNullCompleteExtractedLane
} from "./host-null-complete-hosted-archive.mjs";

export const hostNullCompleteFocusedWorkflow
	= ".github/workflows/host-null-complete.yml";

/**
 * Name the exact same-run artifact for one lane.
 *
 * @param lane - Closed HostNull lane.
 * @param producerCommit - Exact tested revision.
 */
export const hostNullCompleteMatrixArtifactName = (lane, producerCommit) => {
	assert.ok(hostNullCompleteHostedLanes.includes(lane));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	return `${lane.artifactPrefix}-${producerCommit}`;
};

const identity = ({ repository, workflow, runId, runAttempt, producerCommit }) => {
	assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
	assert.equal(workflow, hostNullCompleteFocusedWorkflow);
	for(const value of [runId, runAttempt])
		assert.ok(Number.isSafeInteger(value) && value > 0);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	return { repository, workflow, runId, runAttempt, producerCommit };
};

const copyPackages = packages => {
	assert.ok(Array.isArray(packages) && packages.length > 0);
	return JSON.parse(canonicalJson(packages));
};

const normalizeRoute = route => {
	assert.ok(hostNullCompleteRoutes.includes(route.route));
	assert.ok(typeof route.sourceRoute === "string" && route.sourceRoute.length > 0);
	assert.ok(typeof route.receiptPath === "string" && route.receiptPath.length > 0);
	assert.match(route.receiptSha256, /^[a-f0-9]{64}$/u);
	const dependency = route.rustDependenciesSha256 ?? null;
	if(dependency !== null) assert.match(dependency, /^[a-f0-9]{64}$/u);
	return Object.freeze({
		route: route.route, sourceRoute: route.sourceRoute
		, receiptPath: route.receiptPath, receiptSha256: route.receiptSha256
		, rustDependenciesSha256: dependency
		, packages: copyPackages(route.packages)
	});
};

const expectedLaneCells = lane => hostNullCompleteRoutes.flatMap(route =>
	lane.profiles.flatMap(profile => hostNullCompletePositions.map(position => ({
		lane: lane.id, route, profile, position
	})
	)
	)
);

const normalizeCapture = (lane, accepted, producerCommit) => {
	assert.equal(accepted.lane, lane.id);
	assert.deepEqual(accepted.profiles, lane.profiles);
	assert.equal(accepted.producerCommit, producerCommit);
	assert.ok(accepted.semantic && typeof accepted.semantic === "object"
		&& !Array.isArray(accepted.semantic));
	const routes = accepted.routes.map(normalizeRoute);
	assert.deepEqual(routes.map(route => route.route), hostNullCompleteRoutes);
	const routeDigests = new Map(routes.map(route => [
		route.route, route.receiptSha256
	]));
	const expected = expectedLaneCells(lane);
	assert.deepEqual(accepted.cells.map(cell => ({
		lane: cell.lane, route: cell.route, profile: cell.profile
		, position: cell.position
	})), expected);
	const cells = accepted.cells.map(cell => {
		assert.deepEqual(Object.keys(cell).sort(), [
			"lane", "position", "profile", "receiptSha256", "route"
		]);
		assert.equal(cell.receiptSha256, routeDigests.get(cell.route));
		return Object.freeze({ ...cell });
	});
	return Object.freeze({
		lane: lane.id
		, artifact: hostNullCompleteMatrixArtifactName(lane, producerCommit)
		, profiles: [...lane.profiles], routes, cells
		, semanticSha256: sha256(canonicalJson(accepted.semantic))
	});
};

const matrixSummary = records => {
	const profiles = records.flatMap(record => record.profiles);
	const cells = records.flatMap(record => record.cells);
	assert.deepEqual([...profiles].sort(), [...hostNullCompleteProfiles].sort());
	assert.equal(new Set(profiles).size, 17);
	assert.equal(cells.length, hostNullCompleteCells.length);
	assert.equal(new Set(cells.map(cell =>
		`${cell.route}:${cell.profile}:${cell.position}`)).size, 170);
	return Object.freeze({ lanes: 7, profiles: 17, routes: 14, cells: 170 });
};

/**
 * Replay all seven downloaded artifacts and build one exact-run receipt.
 *
 * @param root - Absolute actions/download-artifact extraction directory.
 * @param options - Exact GitHub run identity.
 * @param verifyLane - Injected only by mutation controls.
 */
export const buildHostNullCompleteMatrixReceipt = async (
	root, options, verifyLane = verifyHostNullCompleteExtractedLane
) => {
	assert.ok(isAbsolute(root) && resolve(root) === root);
	assert.equal(typeof verifyLane, "function");
	const run = identity(options), records = [];
	for(const lane of hostNullCompleteHostedLanes)
	{
		const artifact = hostNullCompleteMatrixArtifactName(
			lane, run.producerCommit
		);
		const accepted = await verifyLane(
			lane, join(root, artifact), run.producerCommit
		);
		records.push(normalizeCapture(lane, accepted, run.producerCommit));
	}
	return Object.freeze({
		schemaVersion: 1, kind: "host-null-complete-installed-matrix-v1"
		, run, matrix: matrixSummary(records), records
	});
};

/**
 * Validate a retained exact-run receipt without trusting its derived matrix.
 *
 * @param receipt - Parsed HostNull complete matrix receipt.
 */
export const validateHostNullCompleteMatrixReceipt = receipt => {
	assert.deepEqual(Object.keys(receipt).sort(), [
		"kind", "matrix", "records", "run", "schemaVersion"
	]);
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "host-null-complete-installed-matrix-v1");
	const run = identity(receipt.run);
	assert.deepEqual(receipt.run, run);
	assert.equal(receipt.records.length, hostNullCompleteHostedLanes.length);
	const normalized = [];
	for(const lane of hostNullCompleteHostedLanes)
	{
		const matches = receipt.records.filter(record => record.lane === lane.id);
		assert.equal(matches.length, 1, lane.id);
		const record = matches[0];
		assert.deepEqual(Object.keys(record).sort(), [
			"artifact", "cells", "lane", "profiles", "routes"
			, "semanticSha256"
		]);
		assert.equal(record.artifact
			, hostNullCompleteMatrixArtifactName(lane, run.producerCommit));
		assert.deepEqual(record.profiles, lane.profiles);
		assert.match(record.semanticSha256, /^[a-f0-9]{64}$/u);
		assert.equal(record.routes.length, 2);
		const routes = record.routes.map(route => {
			assert.deepEqual(Object.keys(route).sort(), [
				"packages", "receiptPath", "receiptSha256", "route"
				, "rustDependenciesSha256", "sourceRoute"
			]);
			return normalizeRoute(route);
		});
		assert.deepEqual(routes.map(route => route.route), hostNullCompleteRoutes);
		const routeDigests = new Map(routes.map(route => [
			route.route, route.receiptSha256
		]));
		const expected = expectedLaneCells(lane);
		assert.equal(record.cells.length, expected.length);
		for(let index = 0; index < record.cells.length; index += 1)
		{
			const cell = record.cells[index];
			assert.deepEqual(Object.keys(cell).sort(), [
				"lane", "position", "profile", "receiptSha256", "route"
			]);
			assert.deepEqual({
				lane: cell.lane, route: cell.route, profile: cell.profile
				, position: cell.position
			}, expected[index]);
			assert.equal(cell.receiptSha256, routeDigests.get(cell.route));
		}
		normalized.push(Object.freeze({
			lane: lane.id, profiles: [...lane.profiles]
			, cells: record.cells
		}));
	}
	assert.deepEqual(receipt.matrix, matrixSummary(normalized));
	return receipt;
};
