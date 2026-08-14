#!/usr/bin/env node
/**
 * Collects the performance baseline workflow.
 *
 * @file
 */


import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { join, resolve } from "node:path";

import { assemblePerformanceBaseline } from "../src/performance/budgets.mjs";
import {
	collectPerformanceEnvironmentObservation,
	inspectPerformanceEnvironment,
	performanceMethodologySha256,
	validatePerformanceMethodology,
	verifyMethodologyIdentityInputs,
} from "../src/performance/methodology.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const options = {
	environment: "reference-linux-x64-i7-7700k-v1"
	, output: null
	, exclusiveRunner: false
	, networkDisabled: false
};
for(let index = 2; index < process.argv.length; index += 1)
{
	const argument = process.argv[index];
	if(argument === "--environment") options.environment = process.argv[++index];
	else if(argument === "--output") options.output = resolve(process.argv[++index]);
  else if(argument === "--exclusive") options.exclusiveRunner = true;
  else if(argument === "--network-disabled") options.networkDisabled = true;
  else throw new Error(`unknown performance baseline option ${argument}`);
}
if(!options.output) throw new Error("--output is required");

const methodology = validatePerformanceMethodology(JSON.parse(await readFile(
	join(root, "poc/performance/methodology.v1.json"),
	"utf8",
)));
const source = Object.freeze({
	commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
	, dirty: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0
});
if(source.dirty) throw new Error("baseline collection requires a clean committed revision");
const identityInputs = await verifyMethodologyIdentityInputs(methodology, root);
const observation = await collectPerformanceEnvironmentObservation({
	projectRoot: root
	, environmentId: options.environment
	, exclusiveRunner: options.exclusiveRunner
	, networkDisabled: options.networkDisabled
});
const inspected = inspectPerformanceEnvironment(methodology, observation);
const environmentReport = Object.freeze({
	schemaVersion: 1
	, kind: "lean-bridge-performance-environment-report"
	, recordedAt: new Date().toISOString()
	, methodology: Object.freeze({
		id: methodology.id
		, sha256: performanceMethodologySha256(methodology)
	})
	, source
	, identityInputs
	, observation
	, accepted: inspected.accepted
	, classification: inspected.classification
	, baselineEligible: inspected.baselineEligible
	, issues: inspected.issues
	, limitations: inspected.limitations
});
if(!environmentReport.baselineEligible)
{
	throw new Error(`environment is not baseline eligible: ${JSON.stringify(environmentReport.issues)}`);
}

const sha256 = value => createHash("sha256").update(value).digest("hex");
const swapCounters = async () => {
	const text = await readFile("/proc/vmstat", "utf8");
	const values = Object.fromEntries(text.split("\n").filter(Boolean).map(line => line.split(/\s+/)));
	return Number(values.pswpin ?? 0) + Number(values.pswpout ?? 0);
};
const noiseSnapshot = async () => Object.freeze({
	recordedAt: new Date().toISOString()
	, monotonicClockNs: process.hrtime.bigint().toString()
	, loadAveragePerCpu: os.loadavg()[0] / os.cpus().length
	, swapInputOutput: await swapCounters()
});

await mkdir(join(options.output, "forks"), { recursive: true });
await writeFile(join(options.output, "environment.json"), `${JSON.stringify(environmentReport, null, 2)}\n`);
const environmentDefinition = methodology.referenceEnvironments.find(candidate => (
	candidate.id === options.environment
));
const valid = [];
const invalid = [];
const rawForkFiles = [];
let attempt = 0;
while(valid.length < methodology.sampling.validForks)
{
	attempt += 1;
	if(invalid.length > methodology.sampling.maximumInvalidForks)
	{
		throw new Error("baseline collection exceeded the invalid fork allowance");
	}
	const forkId = `fork-${String(valid.length + 1).padStart(2, "0")}`;
	const before = await noiseSnapshot();
	let fork = null;
	let processError = null;
	try
	{
		const output = execFileSync(process.execPath, [
			"--expose-gc"
			, "scripts/performance-baseline-fork.mjs"
			, "--fork-id"
			, forkId
			, "--fork-index"
			, String(valid.length)
		], {
			cwd: root
			, encoding: "utf8"
			, maxBuffer: 128 * 1024 * 1024
			, env: process.env
		});
		fork = JSON.parse(output);
	} catch(error)
	{
		processError = Object.freeze({
			message: error.message
			, status: error.status ?? null
			, stderr: String(error.stderr ?? "").slice(0, 8_192)
		});
	}
	const after = await noiseSnapshot();
	const swapDelta = after.swapInputOutput - before.swapInputOutput;
	const issues = [];
	if(processError) issues.push("process-failure");
	if(before.loadAveragePerCpu > environmentDefinition.constraints.maximumLoadAveragePerCpu)
	{
		issues.push("load-before-limit");
	}
	if(after.loadAveragePerCpu > environmentDefinition.constraints.maximumLoadAveragePerCpu)
	{
		issues.push("load-after-limit");
	}
	if(environmentDefinition.constraints.swapActivity === "zero-delta" && swapDelta !== 0)
	{
		issues.push("swap-activity");
	}
	if(BigInt(after.monotonicClockNs) <= BigInt(before.monotonicClockNs)) issues.push("clock-not-monotonic");
	if(fork && (!fork.correctness.accepted || fork.source.dirty || fork.source.commit !== source.commit))
	{
		issues.push("fork-acceptance");
	}
	const accepted = issues.length === 0;
	const record = Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-performance-raw-fork"
		, attempt
		, accepted
		, issues: Object.freeze(issues)
		, noise: Object.freeze({ before, after, swapInputOutputDelta: swapDelta })
		, processError
		, fork
	});
	const bytes = `${JSON.stringify(record, null, 2)}\n`;
	const fileName = accepted ? `${forkId}.json` : `invalid-attempt-${String(attempt).padStart(2, "0")}.json`;
	const relativePath = `forks/${fileName}`;
	await writeFile(join(options.output, relativePath), bytes);
	const descriptor = Object.freeze({
		id: accepted ? forkId : `invalid-attempt-${attempt}`
		, path: relativePath
		, bytes: Buffer.byteLength(bytes)
		, sha256: sha256(bytes)
	});
	if(accepted)
	{
		valid.push(fork);
		rawForkFiles.push(descriptor);
		process.stderr.write(`accepted ${forkId} of ${methodology.sampling.validForks}\n`);
	} else
	{
		invalid.push(Object.freeze({ ...descriptor, issues: Object.freeze(issues) }));
		process.stderr.write(`rejected attempt ${attempt}: ${issues.join(", ")}\n`);
	}
}

const reproductionCommand = [
	"npm run benchmark:baseline --"
	, `--environment ${options.environment}`
	, "--exclusive"
	, "--network-disabled"
	, `--output ${options.output}`
].join(" ");
const baseline = assemblePerformanceBaseline({
	methodology
	, environmentReport
	, forks: valid
	, invalidForks: invalid
	, rawForkFiles
	, reproductionCommand
});
const baselineBytes = `${JSON.stringify(baseline, null, 2)}\n`;
await writeFile(join(options.output, "baseline.json"), baselineBytes);
process.stdout.write(`${JSON.stringify({
	accepted: true
	, baselineId: baseline.id
	, baselinePath: join(options.output, "baseline.json")
	, baselineSha256: sha256(baselineBytes)
	, metricCount: baseline.metrics.length
	, validForks: valid.length
	, invalidForks: invalid.length
}, null, 2)}\n`);
