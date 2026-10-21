/**
 * Explicit CPAN selections and immutable caller inputs for zero-payload
 * checked records across the complete supported Perl ABI matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadPerlModule = "LeanBridge::ZeroPayloadCheckedRecords";
export const zeroPayloadPerlLeanModule = "ZeroPayloadCheckedRecords";
export const zeroPayloadPerlFixtureRoot
	= "tests/fixtures/onboarding/zero-payload-checked-records";
export const zeroPayloadPerlRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadPerlConfigurations = Object.freeze([
	"5.36.3-threaded", "5.36.3-unthreaded"
	, "5.38.2-threaded", "5.38.2-unthreaded"
]);
export const zeroPayloadPerlInstallModes = Object.freeze([
	"prebuilt-only", "build-xs"
]);
export const zeroPayloadPerlTarget = Object.freeze({
	module: zeroPayloadPerlModule, version: "1.000"
});
export const zeroPayloadPerlCounts = Object.freeze({
	full: Object.freeze({ calls: 30, checks: 81, recoveries: 8, rejections: 8, snapshots: 30 })
	, "result-only": Object.freeze({ calls: 9, checks: 38, recoveries: 0, rejections: 0, snapshots: 9 })
});

/**
 * Return the compact independent-caller receipt for one route.
 *
 * @param route - Closed author/API route.
 */
export const zeroPayloadPerlExpected = route => {
	const { resultOnly } = zeroPayloadPerlSelection(route);
	return zeroPayloadPerlCounts[resultOnly ? "result-only" : "full"];
};

/**
 * Select one exact ordinary/reviewed and full/result-only CPAN package.
 *
 * @param route - Closed author/API route.
 */
export const zeroPayloadPerlSelection = route => {
	assert.ok(zeroPayloadPerlRoutes.includes(route), "Unknown zero-payload Perl route");
	const selection = zeroPayloadBrowserSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { cpan: zeroPayloadPerlTarget }
		}
	};
};

/**
 * Keep the caller byte-identical; pass only route facts as public arguments.
 *
 * @param route - Closed author/API route.
 */
export const zeroPayloadPerlCallerArgs = route => {
	const selection = zeroPayloadPerlSelection(route);
	return [
		...selection.resultOnly ? ["--result-only"] : []
		, ...selection.reviewed ? ["--reviewed"] : []
	];
};

/** Load the independently authored caller without generated package input. */
export const zeroPayloadPerlCaller = () => readFile(
	"tests/fixtures/zero-payload-checked-record-perl/perl.pl", "utf8"
);

/**
 * Require exactly the independent caller receipt for one route.
 *
 * @param stdout - Complete caller stdout.
 * @param route - Closed author/API route.
 */
export const parseZeroPayloadPerlResult = (stdout, route) => {
	assert.equal(typeof stdout, "string");
	assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, zeroPayloadPerlExpected(route));
	return result;
};

/**
 * Close all environment switches before package production starts.
 *
 * @param environment - Explicit process environment.
 */
export const zeroPayloadPerlEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_PERL_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid zero-payload Perl TEST");
	const enabled = flag === "1";
	const selected = environment[prefix + "ROUTES"]?.split(",")
		?? [...zeroPayloadPerlRoutes];
	assert.ok(selected.length && selected.every(route => zeroPayloadPerlRoutes.includes(route))
		&& new Set(selected).size === selected.length, "Invalid zero-payload Perl ROUTES");
	const rawLoad = environment[prefix + "MAX_LOAD"] ?? (environment.CI ? "8" : "12");
	assert.ok(["8", "12", "16", "20"].includes(rawLoad)
		, "Invalid zero-payload Perl MAX_LOAD");
	for(const name of [prefix + "ROUTES", prefix + "OUTPUT"
		, prefix + "MAX_LOAD", "LEAN_BRIDGE_ZERO_PAYLOAD_PERLS"])
		if(environment[name] !== undefined)
			assert.ok(enabled, `Explicit ${name} requires TEST=1`);
	return { enabled, routes: selected, maxLoad: Number(rawLoad) };
};
