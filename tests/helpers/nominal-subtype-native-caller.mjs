/**
 * Independent C/C++ callers and explicit installed-test selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Select only named C/C++ routes; malformed switches never silently skip tests.
 *
 * @param environment - Explicit environment, also injectable by negative controls.
 */
export const nominalSubtypeNativeSelection = environment => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nominal native TEST");
	const select = (name, permitted) => {
		const selected = environment[prefix + name]?.split(",") ?? permitted;
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nominal native ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nominal native ${name}`);
		return selected;
	};
	return { enabled: flag === "1"
		, profiles: select("PROFILES", ["c", "cpp"])
		, routes: select("ROUTES", ["ordinary", "reviewed"])
		, modes: select("MODES", ["full", "result-only"]) };
};

/**
 * Use identical assertions for both author routes and a standalone result API.
 *
 * @param profile - C or C++.
 * @param route - Ordinary source or reviewed source.
 * @param mode - Full API or constructor-free result-only API.
 */
export const nominalSubtypeNativeCaller = async (profile, route, mode) => {
	assert.ok(["c", "cpp"].includes(profile));
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.ok(["full", "result-only"].includes(mode));
	const source = await readFile(`tests/fixtures/nominal-subtype-consumers/${profile}.${profile}`, "utf8");
	return (mode === "result-only" ? "#define NOMINAL_RESULT_ONLY\n" : "")
		+ (route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1"));
};
