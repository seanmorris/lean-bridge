/**
 * Cross-package ownership, retirement and process isolation of WIT graphs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("recursive and acyclic installed WIT packages share ownership and retirement rules", {
	skip: process.env.LEAN_BRIDGE_WIT_GRAPH_COMPOSITION_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-composition-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { checkWitGraphComposition } = await import("./helpers/wit-graph-composition.mjs");
	const report = await checkWitGraphComposition(directory, message => t.diagnostic(message));
	await saveLakeFile("build/recursive-wit", "composition.json", canonicalJson(report));
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	for(const run of report.observations) for(const scenario of run.scenarios)
		assert.deepEqual(scenario.observation, scenario.mode === "unopened-peer-fork"
			? { unopenedPeerRejected: true, childStatus: 0 }
			: { sharedRuntime: true, independentResult: true, cleanupAfterBothClosed: true, mode: scenario.mode });
});

test("one prepared recursive release serves the public C and WIT APIs", {
	skip: process.env.LEAN_BRIDGE_WIT_MIXED_PACKAGES_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-mixed-packages-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { checkWitMixedPackages } = await import("./helpers/wit-mixed-packages.mjs");
	const report = await checkWitMixedPackages(directory, message => t.diagnostic(message));
	await saveLakeFile("build/recursive-wit", "mixed-packages.json", canonicalJson(report));
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
});
