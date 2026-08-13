#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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
	, exclusiveRunner: false
	, networkDisabled: false
	, output: null
};
for(let index = 2; index < process.argv.length; index += 1)
{
	const argument = process.argv[index];
	if(argument === "--environment") options.environment = process.argv[++index];
	else if(argument === "--exclusive") options.exclusiveRunner = true;
  else if(argument === "--network-disabled") options.networkDisabled = true;
  else if(argument === "--output") options.output = resolve(process.argv[++index]);
  else throw new Error(`unknown performance methodology option ${argument}`);
}

const methodology = validatePerformanceMethodology(JSON.parse(await readFile(
	new URL("../poc/performance/methodology.v1.json", import.meta.url),
	"utf8",
)));
const identityInputs = await verifyMethodologyIdentityInputs(methodology, root);
const observation = await collectPerformanceEnvironmentObservation({
	projectRoot: root
	, environmentId: options.environment
	, exclusiveRunner: options.exclusiveRunner
	, networkDisabled: options.networkDisabled
});
const environment = inspectPerformanceEnvironment(methodology, observation);
const source = Object.freeze({
	commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
	, dirty: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0
});
const issues = [
	...environment.issues
	, ...(source.dirty ? [{ path: "source.dirty", expected: false, actual: true }] : [])
];
const accepted = issues.length === 0;
const baselineEligible = accepted && environment.baselineEligible;
const result = Object.freeze({
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
	, accepted
	, classification: !accepted
		? "rejected"
		: baselineEligible ? "budget-eligible" : "informational-only"
	, baselineEligible
	, issues: Object.freeze(issues)
	, limitations: environment.limitations
});
const output = `${JSON.stringify(result, null, 2)}\n`;
if(options.output)
{
	await mkdir(dirname(options.output), { recursive: true });
	await writeFile(options.output, output);
} else process.stdout.write(output);
if(!accepted) process.exitCode = 1;
