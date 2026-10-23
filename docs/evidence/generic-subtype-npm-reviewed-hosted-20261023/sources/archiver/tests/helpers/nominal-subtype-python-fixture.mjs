/**
 * Closed Python selections and independently specified nominal Subtype callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";

export const nominalSubtypePythonRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypePythonModes = Object.freeze(["full", "result-only"]);
export const nominalSubtypePythonMinors = Object.freeze(["3.11", "3.12"]);
export const nominalSubtypePythonPackage = "lean_nominalsubtypes";
export const nominalSubtypePythonCounts = Object.freeze({
	full: Object.freeze({ checks: 4212, rejections: 1032, snapshotControls: 8 })
	, "result-only": Object.freeze({ checks: 2086, rejections: 0, snapshotControls: 8 })
});

/**
 * Reject disabled explicit selections, spelling errors and duplicated runs.
 *
 * @param environment - Explicit, injectable producer environment.
 */
export const nominalSubtypePythonSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHON_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nominal Python TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name], selected = raw?.split(",") ?? permitted;
		if(raw !== undefined) assert.equal(flag, "1", `Explicit nominal Python ${name} requires TEST=1`);
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nominal Python ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nominal Python ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHONS"])
		if(environment[name] !== undefined) assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	return { enabled: flag === "1", routes: select("ROUTES", nominalSubtypePythonRoutes), modes: select("MODES", nominalSubtypePythonModes) };
};

/**
 * Both interpreter floors consume the same independently reproduced wheels.
 *
 * @param raw - Explicit JSON object mapping both minor versions to absolute executables.
 */
export const nominalSubtypePythonExecutables = raw => {
	assert.equal(typeof raw, "string", "Select both Python toolchains explicitly");
	const values = JSON.parse(raw);
	assert.ok(values && typeof values === "object" && !Array.isArray(values));
	assert.deepEqual(Object.keys(values).sort(), nominalSubtypePythonMinors);
	for(const value of Object.values(values))
		assert.ok(typeof value === "string" && isAbsolute(value) && !/[\0\r\n]/u.test(value), "Select absolute Python executables");
	assert.equal(new Set(Object.values(values)).size, 2, "Select distinct Python executables");
	return Object.fromEntries(nominalSubtypePythonMinors.map(minor => [minor, values[minor]]));
};

/**
 * Change only the target of the common independently authored configuration.
 *
 * @param route - Ordinary or reviewed source route.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalSubtypePythonConfiguration = (route, mode) => {
	assert.ok(nominalSubtypePythonModes.includes(mode));
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only")
		, targets: { pypi: { name: "nominalsubtypes", version: "1.0.0" } } };
};

/**
 * Change only reviewed parameter labels, never assertions or API selection.
 *
 * @param route - Explicit source route.
 */
export const nominalSubtypePythonCaller = async route => {
	assert.ok(nominalSubtypePythonRoutes.includes(route));
	const source = await readFile("tests/fixtures/nominal-subtype-consumers/python.py", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

/**
 * Require every check and expected rejection for the selected API.
 *
 * @param stdout - Original complete caller output.
 * @param mode - Independently selected package mode.
 */
export const parseNominalSubtypePythonResult = (stdout, mode) => {
	assert.ok(nominalSubtypePythonModes.includes(mode));
	const result = JSON.parse(stdout); assert.deepEqual(result, nominalSubtypePythonCounts[mode]);
	return result;
};
