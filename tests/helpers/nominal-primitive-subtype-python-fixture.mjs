/**
 * Closed Python selections and independently specified nominal Subtype callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { nominalPrimitiveSubtypeConfiguration } from "./nominal-primitive-subtype-fixture.mjs";

export const nominalPrimitiveSubtypePythonRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalPrimitiveSubtypePythonModes = Object.freeze(["full", "result-only"]);
export const nominalPrimitiveSubtypePythonMinors = Object.freeze(["3.11", "3.12"]);
export const nominalPrimitiveSubtypePythonPackage = "lean_nominalprimitivesubtypes";
export const nominalPrimitiveSubtypePythonCounts = Object.freeze({
	full: Object.freeze({ checks: 1225, rejections: 283, snapshotControls: 9, rounds: 256, wordBits: 64 })
	, "result-only": Object.freeze({ checks: 587, rejections: 0, snapshotControls: 9, rounds: 256, wordBits: 64 })
});

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const nominalPrimitiveSubtypePythonSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid primitive-base nominal Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid primitive-base nominal Python ${name}`);
			assert.equal(flag, "1", `Explicit primitive-base nominal Python ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid primitive-base nominal Python ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate primitive-base nominal Python ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHONS"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	return { enabled: flag === "1", routes: select("ROUTES", nominalPrimitiveSubtypePythonRoutes), modes: select("MODES", nominalPrimitiveSubtypePythonModes) };
};

/**
 * Both interpreter floors consume the same independently reproduced wheels.
 *
 * @param raw - Explicit JSON object mapping both minor versions to absolute executables.
 */
export const nominalPrimitiveSubtypePythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), nominalPrimitiveSubtypePythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value) && !/[\0\r\n]/u.test(value), "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, 2, "Select distinct Python executables");
	return Object.fromEntries(nominalPrimitiveSubtypePythonMinors.map(minor => [minor, values[minor]]));
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypePythonConfiguration = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypePythonModes.includes(mode));
	return { ...nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only")
		, targets: { pypi: { name: "nominalprimitivesubtypes", version: "1.0.0" } } };
};

/**
 * Load the unchanged caller; the runner passes the explicit author route.
 *
 * @param route - Explicit source route.
 */
export const nominalPrimitiveSubtypePythonCaller = async route => {
	assert.ok(nominalPrimitiveSubtypePythonRoutes.includes(route));
	const source = await readFile("tests/fixtures/nominal-primitive-subtype-consumers/python.py", "utf8");
	return source;
};

/**
 * Require every check and expected rejection for the selected API.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected package mode.
 */
export const parseNominalPrimitiveSubtypePythonResult = (stdout, mode) => {
	assert.ok(nominalPrimitiveSubtypePythonModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalPrimitiveSubtypePythonCounts[mode]);
	return result;
};
