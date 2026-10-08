/**
 * Require owned JVM acceptance, nonempty observations and retained CI artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedJvmEnforced, ownedJvmStep, ownedJvmUpload } from "./owned-jvm-job.mjs";

export const ownedJvmCiGroups = [
	["owned-jvm-runtime", "owned-jvm-values", "owned-jvm-layout"
		, "owned-jvm-kotlin", "owned-jvm-conversions"]
	, ["owned-jvm-calls", "verified-jvm-assets", "owned-jvm-package"]
	, ["owned-jvm-packaging", "owned-jvm-coexistence", "owned-jvm-documentation"]
];
export const ownedJvmCiReports = Object.entries({
	"owned-jvm-runtime": ["ordinary", "reviewed"], "owned-jvm-values": ["public"]
	, "owned-jvm-layout": ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed"]
	, "owned-jvm-kotlin": ["composed", "scalars"]
	, "owned-jvm-conversions": ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed"]
	, "owned-jvm-calls": ["values-ordinary", "values-reviewed", "scalars-ordinary"
		, "scalars-reviewed", "signatures-ordinary", "signatures-reviewed"]
	, "owned-jvm-packaging": ["callbacks-ordinary", "callbacks-reviewed"
		, "scalars-ordinary", "scalars-reviewed", "coexistence", "documentation"]
}).flatMap(([directory, names]) => names.map(name => "build/" + directory + "/" + name + ".json"));

/**
 * Validate live acceptance commands in the owned JVM job and its mandatory summary enforcement.
 *
 * @param workflow - Complete current workflow text.
 */
export const assertOwnedJvmCi = workflow => {
	const step = ownedJvmStep(workflow);
	assert.ok(step);
	assertOwnedJvmEnforced(workflow);
	// The managed JVM record lists only its own job's commands; owned layers run in their own job.
	const route = workflow.split('if [ "$consumer" = jvm ]; then\n')[1]?.split('if [ "$consumer" = ruby ]; then\n')[0];
	assert.ok(route);
	for(const group of ownedJvmCiGroups)
	{
		const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 "
			+ group.map(name => "tests/" + name + ".test.mjs").join(" ");
		assert.ok(step.includes("          " + command + "\n"), group.join(","));
		assert.ok(!route.includes(command), group.join(","));
	}
	const upload = ownedJvmUpload(workflow);
	assert.ok(upload);
	for(const path of ownedJvmCiReports)
	{
		assert.ok(step.includes("          test -s " + path + "\n"), path);
		assert.ok(upload.includes("            " + path.slice(0, path.lastIndexOf("/") + 1) + "\n"), path);
	}
	return { testFiles: ownedJvmCiGroups.flat().length
		, requiredReports: ownedJvmCiReports.length, artifactDirectories: 7
		, recordedRouteMatches: true, realExecutionRequired: true };
};
