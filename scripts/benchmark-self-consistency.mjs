#!/usr/bin/env node
/**
 * Benchmarks the self consistency workflow.
 *
 * @file
 */


import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, resolve } from "node:path";

import { runPerformanceSuite, performanceProfiles } from "../src/performance/harness.mjs";
import { analyzePerformanceSelfConsistency } from "../src/performance/reproducibility.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!name?.startsWith("--") || value === undefined) throw new Error(`invalid option ${name ?? ""}`);
	options.set(name, value);
}
const repetitions = Number(options.get("--repetitions") ?? 3);
if(!Number.isInteger(repetitions) || repetitions < 2) throw new Error("--repetitions must be at least two");
const workload = options.get("--workload") ?? "interactive-clustered-2d";
const manifest = JSON.parse(await readFile("poc/performance/workloads.v1.json", "utf8"));
const suites = [];
for(let index = 0; index < repetitions; index += 1)
{
	suites.push(await runPerformanceSuite({ manifest, workload, profiles: performanceProfiles }));
}
const analysis = analyzePerformanceSelfConsistency(suites);
const result = Object.freeze({
	schemaVersion: 1
	, kind: "lean-bridge-performance-self-consistency"
	, recordedAt: new Date().toISOString()
	, source: Object.freeze({
		commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
		, dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0
	})
	, environment: Object.freeze({
		node: process.version
		, platform: `${os.platform()} ${os.release()}`
		, architecture: os.arch()
		, cpu: os.cpus()[0]?.model ?? "unknown"
		, logicalCpuCount: os.cpus().length
	})
	, workload
	, profiles: performanceProfiles
	, ...analysis
	, limitations: Object.freeze([
		"Semantic identity must match exactly across repetitions."
		, "Timing variance is reported without a failure threshold until the methodology and budget phases approve one."
		, "Repetitions share one process and a warm filesystem cache. Clean artifact rebuild comparison is a separate gate."
	])
});
const output = `${JSON.stringify(result, null, 2)}\n`;
if(options.has("--output"))
{
	const path = resolve(options.get("--output"));
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, output);
} else process.stdout.write(output);
