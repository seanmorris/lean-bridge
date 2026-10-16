/**
 * Independent nested checked-record WIT contracts and the complete public Wasmtime C caller.
 * The wire shapes (Nat limb lists, packet records, list/option/tuple/result carriers and the
 * Choice variant) are the generator's fixed WIT projection; the caller never reads it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordName, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import { nestedCheckedRecordWitLoadCeiling, nestedCheckedRecordWitLoadCeilings } from "./nested-checked-record-wit-resources.mjs";

export const nestedCheckedRecordWitRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordWitModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordWitTarget = Object.freeze({ name: nestedCheckedRecordName, version: "1.0.0" });
/** Independent caller totals; result-only replays only the constructor-free producers. */
export const nestedCheckedRecordWitCounts = Object.freeze({
	full: Object.freeze({ checks: 6008, rejections: 524, hostRejections: 7, recoveries: 256, snapshots: 1826, rounds: 256 })
	, "result-only": Object.freeze({ checks: 1553, rejections: 0, hostRejections: 4, recoveries: 0, snapshots: 516, rounds: 256 })
});

/**
 * Refuse misspelled gates and selections instead of silently skipping packages.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const nestedCheckedRecordWitSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid nested checked-record WIT TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid nested checked-record WIT ${name}`);
			assert.equal(flag, "1", `Explicit nested checked-record WIT ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid nested checked-record WIT ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate nested checked-record WIT ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
	{
		assert.equal(flag, "1", `Explicit ${prefix}OUTPUT requires TEST=1`);
		assert.ok(typeof environment[prefix + "OUTPUT"] === "string" && environment[prefix + "OUTPUT"].length > 0);
	}
	if(environment[prefix + "MAX_LOAD"] !== undefined) assert.equal(flag, "1", `Explicit ${prefix}MAX_LOAD requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined ? nestedCheckedRecordWitLoadCeiling : Number(rawLoad);
	assert.ok(nestedCheckedRecordWitLoadCeilings.includes(maxLoad)
		, `Nested checked-record WIT max load must be one of ${nestedCheckedRecordWitLoadCeilings.join(", ")}`);
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", nestedCheckedRecordWitRoutes)
		, modes: select("MODES", nestedCheckedRecordWitModes)
		, maxLoad
	};
};

/**
 * Keep every nested checked-record identity and per-site constructor decision.
 *
 * @param mode - Full API or standalone constructor-free results.
 */
export const nestedCheckedRecordWitReview = mode => {
	assert.ok(nestedCheckedRecordWitModes.includes(mode)); return nestedCheckedRecordReview(mode);
};

/**
 * Select WIT packaging without deriving ordinary decisions from compiler output.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param mode - Full API or standalone constructor-free results.
 */
export const nestedCheckedRecordWitConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordWitRoutes.includes(route)); assert.ok(nestedCheckedRecordWitModes.includes(mode));
	return { ...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: { "wit-wasi": { ...nestedCheckedRecordWitTarget } } };
};

/**
 * Inline the independent value helpers so consumers need no repository files.
 *
 * @param route - Ordinary or independently reviewed diagnostic names.
 * @param mode - Explicit API selection.
 */
export const nestedCheckedRecordWitCaller = async (route, mode) => {
	assert.ok(nestedCheckedRecordWitRoutes.includes(route)); assert.ok(nestedCheckedRecordWitModes.includes(mode));
	const root = "tests/fixtures/nested-checked-record-consumers/";
	let source = await readFile(root + "wit-wasi.c", "utf8");
	const include = '#include "wit-values.h"'; assert.equal(source.split(include).length, 2);
	const header = await readFile(root + "wit-values.h", "utf8"); source = source.replace(include, () => header);
	return (mode === "result-only" ? "#define NESTED_CHECKED_RECORD_RESULT_ONLY\n" : "")
		+ (route === "reviewed" ? '#define NESTED_PARAMETER_PREFIX "value"\n' : "") + source;
};

/**
 * Refuse incomplete observations, missing refusals or altered caller counts.
 *
 * @param stdout - Complete original caller output.
 * @param mode - Independently selected API mode.
 */
export const parseNestedCheckedRecordWitResult = (stdout, mode) => {
	assert.ok(nestedCheckedRecordWitModes.includes(mode)); const result = JSON.parse(stdout);
	assert.deepEqual(result, nestedCheckedRecordWitCounts[mode]); return result;
};
