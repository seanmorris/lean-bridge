/**
 * Explicit Python selections for proof-erased dependent checked records.
 *
 * This is a source foundation only. Installed wheel acceptance belongs to the
 * dedicated Python dependent checked-record lane; do not treat this helper as host support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import {
	dependentCheckedRecordFixture
	, dependentCheckedRecordName
	, dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordPythonRoutes
	= dependentCheckedRecordRoutes;
export const dependentCheckedRecordPythonFixtureRoot
	= dependentCheckedRecordFixture;
export const dependentCheckedRecordPythonLeanModule = "DependentRecords";
export const dependentCheckedRecordPythonTarget = Object.freeze({
	name: dependentCheckedRecordName, version: "1.0.0"
});
export const dependentCheckedRecordPythonPackage
	= `lean_${dependentCheckedRecordName}`;
export const dependentCheckedRecordPythonMinors = Object.freeze(["3.11", "3.12"]);

/**
 * Reject disabled partial selections and ambient Python fallbacks before any
 * author build or consumer install starts.
 *
 * @param environment - Explicit host environment.
 */
export const dependentCheckedRecordPythonRunSelection = environment => {
	const prefix = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHON_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid dependent checked-record Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid dependent checked-record Python ${name}`);
			assert.equal(flag, "1", `Explicit dependent checked-record Python ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid dependent checked-record Python ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate dependent checked-record Python ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PYTHONS"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", dependentCheckedRecordPythonRoutes)
	};
};

/**
 * Bind both declared CPython floors to distinct absolute executables.
 *
 * @param raw - JSON object mapping every declared minor to an executable.
 */
export const dependentCheckedRecordPythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), dependentCheckedRecordPythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value) && !/[\0\r\n]/u.test(value), "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, dependentCheckedRecordPythonMinors.length, "Select distinct Python executables");
	return Object.fromEntries(dependentCheckedRecordPythonMinors.map(minor => [minor, values[minor]]));
};

/**
 * Independent installed-caller totals, separate from package implementation.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordPythonExpected = route => {
	const { resultOnly } = dependentCheckedRecordPythonSelection(route);
	return resultOnly
		? { calls: 513, checks: 516, recoveries: 0
			, rejections: 0, snapshots: 513 }
		: { calls: 1289, checks: 2326, recoveries: 258
			, rejections: 258, snapshots: 1289 };
};

/** Load the immutable Python caller without consulting generated package output. */
export const dependentCheckedRecordPythonCaller = () => readFile(
	"tests/fixtures/dependent-checked-record-consumers/python.py", "utf8"
);

/**
 * Preserve only route-derived switches; the installed caller source is shared.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordPythonCallerArgs = route => {
	const selection = dependentCheckedRecordPythonSelection(route);
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
export const parseDependentCheckedRecordPythonResult = (stdout, route) => {
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, dependentCheckedRecordPythonExpected(route));
	return result;
};

/**
 * Preserve the independently authored ordinary/reviewed route while changing
 * only the consumer coordinate. The Binding IR remains compiler authority.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordPythonSelection = route => {
	assert.ok(dependentCheckedRecordPythonRoutes.includes(route)
		, "Unknown dependent checked-record Python route");
	const selection = dependentCheckedRecordSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { pypi: dependentCheckedRecordPythonTarget }
		}
	};
};
