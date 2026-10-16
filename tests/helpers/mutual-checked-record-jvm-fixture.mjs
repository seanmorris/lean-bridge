/**
 * Closed Maven selections and exact Java/Kotlin recursive checked-record results.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";

export const mutualCheckedRecordJvmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const mutualCheckedRecordJvmProfiles = Object.freeze(["java", "kotlin"]);
export const mutualCheckedRecordJvmMavenName
	= "org.leanbridge:mutualcheckedrecords";
export const mutualCheckedRecordJvmNamespace
	= "org.leanbridge.mutualcheckedrecords";

const failure = (name, message) => ({ name, message });
const sharedFailures = {
	"outer-subtype": failure("IllegalArgumentException"
		, "arg0.value was rejected by MutualCheckedRecords.plusOne")
	, "late-subtype": failure("IllegalArgumentException"
		, "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne")
	, "outer-record": failure("IllegalArgumentException"
		, "arg0 was rejected by MutualCheckedRecords.mkEnvelope")
	, "outer-fin": failure("IllegalArgumentException"
		, "arg0.mode is not below its Fin 3 bound")
	, "nested-fin": failure("IllegalArgumentException"
		, "arg0.next?.more.packet.mode is not below its Fin 3 bound")
	, "group-late-subtype": failure("IllegalArgumentException"
		, "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne")
	, "echo-group-late-subtype": failure("IllegalArgumentException"
		, "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusTwo")
	, "alternate-subtype": failure("IllegalArgumentException"
		, "arg0.value was rejected by MutualCheckedRecords.plusTwo")
	, depth: failure("Limit", "Copied graph depth or node limit exceeded")
	, "negative-nat": failure("IllegalArgumentException", "Nat cannot be negative")
	, "round late subtype": failure("IllegalArgumentException"
		, "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne")
};

export const mutualCheckedRecordJvmExpected = Object.freeze({
	java: Object.freeze({
		checks: 590, rejections: 72, hostRejections: 5, calls: 290
		, snapshots: 290, recoveries: 77, rounds: 64, wordBits: 64
		, failures: Object.freeze({ ...sharedFailures
			, "null-record": failure("IllegalArgumentException"
				, "Expected copied value of type org.leanbridge.mutualcheckedrecords.Envelope")
			, "null-alias-carrier": failure("IllegalArgumentException"
				, "Expected copied value of type org.leanbridge.mutualcheckedrecords.Option[]")
			, "cycle-construction": failure("CarrierMutation"
				, "Java record fields refuse cycle construction")
		})
	})
	, kotlin: Object.freeze({
		checks: 593, rejections: 72, hostRejections: 6, calls: 292
		, snapshots: 292, recoveries: 78, rounds: 64, wordBits: 64
		, failures: Object.freeze({ ...sharedFailures
			, "null-record": failure("IllegalArgumentException"
				, "Expected copied value of type org.leanbridge.mutualcheckedrecords.kotlin.Envelope")
			, "null-alias-carrier": failure("IllegalArgumentException"
				, "Expected copied value of type org.leanbridge.mutualcheckedrecords.kotlin.Option[]")
			, "null-active-field": failure("IllegalArgumentException"
				, "Expected copied value of type org.leanbridge.mutualcheckedrecords.kotlin.Envelope")
			, cycle: failure("IllegalArgumentException", "Cyclic copied input")
		})
	})
});

/**
 * Reject disabled explicit selections, unknown routes and unsafe load settings.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const mutualCheckedRecordJvmSelection = environment => {
	const prefix = "LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_JVM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid mutual checked-record JVM TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined) assert.equal(flag, "1"
		, "Explicit mutual checked-record JVM routes require TEST=1");
	const routes = raw === undefined ? [...mutualCheckedRecordJvmRoutes]
		: raw.split(",").filter(Boolean);
	assert.ok(routes.length && new Set(routes).size === routes.length
		&& routes.every(route => mutualCheckedRecordJvmRoutes.includes(route))
	, "Invalid mutual checked-record JVM routes");
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1"
			, "Explicit mutual checked-record JVM output requires TEST=1");
	const configured = environment[prefix + "MAX_LOAD"];
	if(configured !== undefined) assert.equal(flag, "1"
		, "Explicit mutual checked-record JVM max load requires TEST=1");
	const maxLoad = configured === undefined ? environment.CI === "true" ? 8 : 12
		: Number(configured);
	assert.ok([6, 8, 10, 12, 16].includes(maxLoad)
		, "Mutual checked-record JVM max load must be 6, 8, 10, 12, or 16");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Add only the Maven coordinate to the shared recursive author contract.
 *
 * @param route - Ordinary analysis or independently reviewed Binding IR.
 */
export const mutualCheckedRecordJvmConfiguration = route => {
	assert.ok(mutualCheckedRecordJvmRoutes.includes(route));
	const configuration = mutualCheckedRecordConfiguration(route);
	return { ...configuration, targets: { ...configuration.targets
		, maven: { name: mutualCheckedRecordJvmMavenName, version: "1.0.0" } } };
};

/**
 * Require the complete independent profile result and all exact failures.
 *
 * @param stdout - Complete original public caller output.
 * @param profile - Java or Kotlin public API.
 */
export const parseMutualCheckedRecordJvmResult = (stdout, profile) => {
	assert.ok(mutualCheckedRecordJvmProfiles.includes(profile));
	const value = JSON.parse(stdout);
	assert.deepEqual(value, mutualCheckedRecordJvmExpected[profile]);
	return value;
};

/** Independently reviewed recursive contract. */
export const mutualCheckedRecordJvmReview = mutualCheckedRecordReview;
