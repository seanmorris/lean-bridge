/**
 * Closed NuGet selections for mutually recursive checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";

export const mutualCheckedRecordDotnetRoutes = Object.freeze(["ordinary", "reviewed"]);
export const mutualCheckedRecordDotnetAssembly = "LeanBridge.Mutualcheckedrecords";
export const mutualCheckedRecordDotnetPackage = "Mutualcheckedrecords.Api";

/**
 * Select an explicit ordinary/reviewed acceptance run.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const mutualCheckedRecordDotnetSelection = environment => {
	const prefix = "LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_DOTNET_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid mutual checked-record C# TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined) assert.equal(flag, "1"
		, "Explicit mutual checked-record C# routes require TEST=1");
	const routes = raw === undefined ? [...mutualCheckedRecordDotnetRoutes]
		: raw.split(",").filter(Boolean);
	assert.ok(
		routes.length && new Set(routes).size === routes.length
			&& routes.every(route => mutualCheckedRecordDotnetRoutes.includes(route))
		, "Invalid mutual checked-record C# routes"
	);
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1", "Explicit mutual checked-record C# output requires TEST=1");
	const configured = environment[prefix + "MAX_LOAD"];
	if(configured !== undefined) assert.equal(flag, "1"
		, "Explicit mutual checked-record C# max load requires TEST=1");
	const maxLoad = configured === undefined ? environment.CI === "true" ? 8 : 12
		: Number(configured);
	assert.ok([6, 8, 10, 12, 16].includes(maxLoad)
		, "Mutual checked-record C# max load must be 6, 8, 10, 12, or 16");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Add only the NuGet release coordinate to the shared author configuration.
 *
 * @param route - Ordinary analysis or independently reviewed Binding IR.
 */
export const mutualCheckedRecordDotnetConfiguration = route => {
	assert.ok(mutualCheckedRecordDotnetRoutes.includes(route));
	const configuration = mutualCheckedRecordConfiguration(route);
	return { ...configuration, targets: { ...configuration.targets
		, nuget: { name: mutualCheckedRecordDotnetPackage, version: "1.0.0" } } };
};

/** Independently reviewed recursive contract. */
export const mutualCheckedRecordDotnetReview = mutualCheckedRecordReview;

/**
 * Require the complete immutable caller result rather than a success marker.
 *
 * @param stdout - Complete original public caller output.
 */
export const parseMutualCheckedRecordDotnetResult = stdout => {
	const result = JSON.parse(stdout);
	assert.deepEqual(Object.keys(result).sort(), [
		"calls", "checks", "failures", "hostRejections", "recoveries"
		, "rejections", "rounds", "snapshots", "wordBits"
	]);
	assert.equal(result.rounds, 128); assert.equal(result.wordBits, 64);
	assert.ok(result.checks > 1500); assert.ok(result.calls > 700);
	assert.ok(result.rejections > 130); assert.ok(result.hostRejections > 130);
	assert.ok(result.snapshots > 700); assert.ok(result.recoveries > 140);
	assert.deepEqual(Object.keys(result.failures).sort(), [
		"alternate-subtype", "cycle", "depth", "echo-group-late-subtype"
		, "group-late-subtype", "late-subtype", "negative-nat", "nested-fin"
		, "null-active-field", "null-alias-carrier", "null-record", "outer-fin"
		, "outer-record", "outer-subtype", "round late subtype"
		, "round malformed active field"
	]);
	return result;
};
