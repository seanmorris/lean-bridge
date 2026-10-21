/**
 * Explicit Python selections, immutable caller and exact totals for zero-payload
 * checked records: a proof-only Witness, a Unit-bearing Token, a plain empty
 * Marker and a Mark variant, each distinct from Option, None and default values.
 *
 * This is a source foundation only. Installed wheel acceptance belongs to the
 * hosted Python zero-payload lane; do not treat this helper as host support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import {
	zeroPayloadBrowserRoutes
	, zeroPayloadBrowserSelection
	, zeroPayloadBrowserName
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadPythonRoutes
	= zeroPayloadBrowserRoutes;
export const zeroPayloadPythonTarget = Object.freeze({
	name: zeroPayloadBrowserName, version: "1.0.0"
});
export const zeroPayloadPythonPackage
	= `lean_${zeroPayloadBrowserName}`;
export const zeroPayloadPythonMinors = Object.freeze(["3.11", "3.12"]);

/**
 * Reject disabled partial selections and ambient Python fallbacks before any
 * author build or consumer install starts.
 *
 * @param environment - Explicit host environment.
 */
export const zeroPayloadPythonEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_PYTHON_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid zero-payload Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid zero-payload Python ${name}`);
			assert.equal(flag, "1", `Explicit zero-payload Python ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid zero-payload Python ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate zero-payload Python ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_ZERO_PAYLOAD_PYTHONS"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", zeroPayloadPythonRoutes)
	};
};

/**
 * Bind both declared CPython floors to distinct absolute executables.
 *
 * @param raw - JSON object mapping every declared minor to an executable.
 */
export const zeroPayloadPythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), zeroPayloadPythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value) && !/[\0\r\n]/u.test(value), "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, zeroPayloadPythonMinors.length, "Select distinct Python executables");
	return Object.fromEntries(zeroPayloadPythonMinors.map(minor => [minor, values[minor]]));
};

/**
 * Independent installed-caller totals, separate from package implementation.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadPythonExpected = route => {
	const { resultOnly } = zeroPayloadPythonSelection(route);
	return resultOnly
		? { calls: 9, checks: 39, recoveries: 0, rejections: 0, snapshots: 9 }
		: { calls: 30, checks: 81, recoveries: 8, rejections: 8, snapshots: 30 };
};

/** Load the immutable Python caller without consulting generated package output. */
export const zeroPayloadPythonCaller = () => readFile(
	"tests/fixtures/zero-payload-checked-record-python/python.py", "utf8"
);

/**
 * Preserve only route-derived switches; the installed caller source is shared.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadPythonCallerArgs = route => {
	const selection = zeroPayloadPythonSelection(route);
	return [
		...selection.resultOnly ? ["--result-only"] : []
		, ...selection.reviewed ? ["--reviewed"] : []
	];
};

/**
 * Require exactly the independent installed-caller receipt for a route.
 *
 * @param stdout - Complete process stdout.
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const parseZeroPayloadPythonResult = (stdout, route) => {
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, zeroPayloadPythonExpected(route));
	return result;
};

/**
 * Preserve the independently authored ordinary/reviewed route while changing
 * only the consumer coordinate. The Binding IR remains compiler authority.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadPythonSelection = route => {
	assert.ok(zeroPayloadPythonRoutes.includes(route)
		, "Unknown zero-payload Python route");
	const selection = zeroPayloadBrowserSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { pypi: zeroPayloadPythonTarget }
		}
	};
};
