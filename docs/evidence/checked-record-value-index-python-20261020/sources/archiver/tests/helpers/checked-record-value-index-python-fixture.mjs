/**
 * Explicit Python selections for proof-erased checked records with closed
 * compiler-derived value indices.
 *
 * This is a source foundation only. Installed wheel acceptance belongs to the
 * dedicated Python value-index lane; do not treat this helper as host support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexPackage
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexPythonRoutes
	= checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexPythonTarget = Object.freeze({
	name: checkedRecordValueIndexPackage, version: "1.0.0"
});
export const checkedRecordValueIndexPythonPackage
	= `lean_${checkedRecordValueIndexPackage}`;
export const checkedRecordValueIndexPythonMinors = Object.freeze(["3.11", "3.12"]);

/**
 * Reject disabled partial selections and ambient Python fallbacks before any
 * author build or consumer install starts.
 *
 * @param environment - Explicit host environment.
 */
export const checkedRecordValueIndexPythonRunSelection = environment => {
	const prefix = "LEAN_BRIDGE_VALUE_INDEX_PYTHON_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid value-index Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid value-index Python ${name}`);
			assert.equal(flag, "1", `Explicit value-index Python ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid value-index Python ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate value-index Python ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_VALUE_INDEX_PYTHONS"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", checkedRecordValueIndexPythonRoutes)
	};
};

/**
 * Bind both declared CPython floors to distinct absolute executables.
 *
 * @param raw - JSON object mapping every declared minor to an executable.
 */
export const checkedRecordValueIndexPythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), checkedRecordValueIndexPythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value) && !/[\0\r\n]/u.test(value), "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, checkedRecordValueIndexPythonMinors.length, "Select distinct Python executables");
	return Object.fromEntries(checkedRecordValueIndexPythonMinors.map(minor => [minor, values[minor]]));
};

/**
 * Independent installed-caller totals, separate from package implementation.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPythonExpected = route => {
	const { resultOnly } = checkedRecordValueIndexPythonSelection(route);
	return resultOnly
		? { calls: 8, checks: 25, recoveries: 0, rejections: 0, snapshots: 0 }
		: { calls: 28, checks: 65, recoveries: 6, rejections: 6, snapshots: 20 };
};

/** Load the immutable Python caller without consulting generated package output. */
export const checkedRecordValueIndexPythonCaller = () => readFile(
	"tests/fixtures/checked-record-value-index-python/python.py", "utf8"
);

/**
 * Preserve only route-derived switches; the installed caller source is shared.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPythonCallerArgs = route => {
	const selection = checkedRecordValueIndexPythonSelection(route);
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
export const parseCheckedRecordValueIndexPythonResult = (stdout, route) => {
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, checkedRecordValueIndexPythonExpected(route));
	return result;
};

/**
 * Preserve the independently authored ordinary/reviewed route while changing
 * only the consumer coordinate. The Binding IR remains compiler authority.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexPythonSelection = route => {
	assert.ok(checkedRecordValueIndexPythonRoutes.includes(route)
		, "Unknown value-index Python route");
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return {
		...selection
		, configuration: {
			...selection.configuration
			, targets: { pypi: checkedRecordValueIndexPythonTarget }
		}
	};
};
