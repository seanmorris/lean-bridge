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
	assert.deepEqual({ ...result, failures: undefined }, {
		checks: 1359, rejections: 136, hostRejections: 134, calls: 676
		, snapshots: 676, recoveries: 142, rounds: 128, wordBits: 64
		, failures: undefined
	});
	const failure = (name, message) => ({ name, message });
	assert.deepEqual(result.failures, {
		"outer-subtype": failure("ArgumentException"
			, "arg0.value was rejected by MutualCheckedRecords.plusOne")
		, "late-subtype": failure("ArgumentException"
			, "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne")
		, "outer-record": failure("ArgumentException"
			, "arg0 was rejected by MutualCheckedRecords.mkEnvelope")
		, "outer-fin": failure("ArgumentException"
			, "arg0.mode is not below its Fin 3 bound")
		, "nested-fin": failure("ArgumentException"
			, "arg0.next?.more.packet.mode is not below its Fin 3 bound")
		, "group-late-subtype": failure("ArgumentException"
			, "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne")
		, "echo-group-late-subtype": failure("ArgumentException"
			, "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusTwo")
		, "alternate-subtype": failure("ArgumentException"
			, "arg0.value was rejected by MutualCheckedRecords.plusTwo")
		, "null-record": failure("ArgumentNullException"
			, "Value cannot be null. (Parameter 'value')")
		, "null-active-field": failure("ArgumentNullException"
			, "Value cannot be null. (Parameter 'value')")
		, "null-alias-carrier": failure("ArgumentNullException"
			, "Value cannot be null. (Parameter 'value')")
		, cycle: failure("ArgumentException", "Cyclic copied input")
		, depth: failure("GraphLimit", "Copied graph depth or node limit exceeded")
		, "negative-nat": failure("ArgumentOutOfRangeException"
			, "Nat cannot be negative (Parameter 'value')")
		, "round late subtype": failure("ArgumentException"
			, "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne")
		, "round malformed active field": failure("ArgumentNullException"
			, "Value cannot be null. (Parameter 'value')")
	});
	return result;
};
