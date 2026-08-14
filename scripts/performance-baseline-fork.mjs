#!/usr/bin/env node
/**
 * Runs the performance baseline fork command-line workflow.
 *
 * @file
 */


import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { runPerformanceSuite } from "../src/performance/harness.mjs";
import { runLifecycleStabilitySuite } from "../src/performance/lifecycle.mjs";
import { runNativeOverheadSuite } from "../src/performance/overhead.mjs";
import {
	runScalingSuite,
	scalingGraphCounts,
	scalingProfiles,
} from "../src/performance/scaling.mjs";

const options = { forkId: null, forkIndex: null };
for(let index = 2; index < process.argv.length; index += 1)
{
	const argument = process.argv[index];
	if(argument === "--fork-id") options.forkId = process.argv[++index];
	else if(argument === "--fork-index") options.forkIndex = Number(process.argv[++index]);
  else throw new Error(`unknown performance fork option ${argument}`);
}
if(!options.forkId || !Number.isInteger(options.forkIndex) || options.forkIndex < 0)
{
	throw new Error("--fork-id and a nonnegative --fork-index are required");
}

const rotate = (values, offset) => [
	...values.slice(offset % values.length)
	, ...values.slice(0, offset % values.length)
];
const spatialProfiles = ["lazy", "startup", "final-static", "islands"];
const profileOrder = Object.freeze({
	spatial: Object.freeze(rotate(spatialProfiles, options.forkIndex))
	, scaling: Object.freeze(rotate([...scalingProfiles], options.forkIndex))
});
const suiteNames = rotate(["overhead", "spatial", "lifecycle", "scaling"], options.forkIndex);
const manifest = JSON.parse(await readFile("poc/performance/workloads.v1.json", "utf8"));
const suites = {};
for(const name of suiteNames)
{
	if(name === "overhead") suites.overhead = await runNativeOverheadSuite();
	else if(name === "lifecycle") suites.lifecycle = await runLifecycleStabilitySuite();
	else if(name === "spatial") suites.spatial = await runPerformanceSuite({ manifest, workload: "interactive-clustered-2d", profiles: profileOrder.spatial });
	else if(name === "scaling") suites.scaling = await runScalingSuite({ counts: scalingGraphCounts, profiles: profileOrder.scaling });
}
const source = Object.freeze({
	commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
	, dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0
});
const correctness = Object.freeze({
	accepted: suites.overhead.correctness.accepted
    && suites.lifecycle.correctness.accepted
    && suites.spatial.runs.every(run => run.correctness.accepted)
    && suites.scaling.runs.every(run => run.correctness.accepted)
	, spatialProfiles: suites.spatial.runs.length
	, scalingProfiles: suites.scaling.runs.length
});
process.stdout.write(`${JSON.stringify(Object.freeze({
	schemaVersion: 1
	, kind: "lean-bridge-performance-fork"
	, forkId: options.forkId
	, forkIndex: options.forkIndex
	, recordedAt: new Date().toISOString()
	, source
	, suiteOrder: Object.freeze(suiteNames)
	, profileOrder
	, suites: Object.freeze(suites)
	, correctness
}), null, 2)}\n`);
