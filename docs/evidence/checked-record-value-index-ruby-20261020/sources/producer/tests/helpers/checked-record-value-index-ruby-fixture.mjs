/**
 * Closed Ruby selections and an independently authored caller for proof-erased
 * checked records whose index values are reduced by Lean before compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexPackage
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexRubyRoutes = checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexRubyTarget = Object.freeze({
	name: checkedRecordValueIndexPackage, version: "1.0.0"
});
export const checkedRecordValueIndexRubyRequirePath
	= `lean_bridge/${checkedRecordValueIndexPackage}`;
export const checkedRecordValueIndexRubyNamespace = "LeanBridge::Checkedrecordvalueindices";
export const checkedRecordValueIndexRubyModes = Object.freeze(["full", "result-only"]);
export const checkedRecordValueIndexRubyCounts = Object.freeze({
	full: Object.freeze({ calls: 28, checks: 65, recoveries: 6, rejections: 6, snapshots: 20 })
	, "result-only": Object.freeze({ calls: 8, checks: 25, recoveries: 0, rejections: 0, snapshots: 0 })
});

/**
 * Reject disabled, duplicate, or partial host selections before any build.
 *
 * @param environment - Explicit host environment.
 */
export const checkedRecordValueIndexRubySelection = environment => {
	const prefix = "LEAN_BRIDGE_VALUE_INDEX_RUBY_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid value-index Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid value-index Ruby ${name}`);
			assert.equal(flag, "1", `Explicit value-index Ruby ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid value-index Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate value-index Ruby ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid value-index Ruby MAX_LOAD");
	const maxLoad = rawLoad === undefined ? environment.CI === "true" ? 8 : 12 : Number(rawLoad);
	assert.ok([8, 12, 16, 20].includes(maxLoad), "Value-index Ruby max load must be 8, 12, 16, or 20");
	assert.equal(environment[prefix + "MODES"], undefined
		, "Value-index Ruby modes are encoded by the selected route");
	return { enabled: flag === "1"
		, routes: select("ROUTES", checkedRecordValueIndexRubyRoutes), maxLoad };
};

/**
 * Select exactly one ordinary/reviewed and full/result-only Ruby gem build.
 *
 * @param route - Exact independent author route.
 */
export const checkedRecordValueIndexRubyConfiguration = route => {
	assert.ok(checkedRecordValueIndexRubyRoutes.includes(route), "Unknown value-index Ruby route");
	const selection = checkedRecordValueIndexBrowserSelection(route);
	return { ...selection.configuration, targets: { rubygems: checkedRecordValueIndexRubyTarget } };
};

/** Load an immutable caller independent of generated Ruby package output. */
export const checkedRecordValueIndexRubyCaller = () => readFile(
	"tests/fixtures/checked-record-value-index-ruby/ruby.rb", "utf8");

/**
 * Preserve only route-derived switches at process launch.
 *
 * @param route - Exact independent author route.
 */
export const checkedRecordValueIndexRubyCallerArgs = route => {
	assert.ok(checkedRecordValueIndexRubyRoutes.includes(route), "Unknown value-index Ruby route");
	const { resultOnly, reviewed } = checkedRecordValueIndexBrowserSelection(route);
	return [...resultOnly ? ["--result-only"] : [], ...reviewed ? ["--reviewed"] : []];
};

/**
 * Require the complete, independent caller receipt for its exact API mode.
 *
 * @param stdout - Complete immutable caller output.
 * @param mode - Full API or constructor-free results only.
 */
export const parseCheckedRecordValueIndexRubyResult = (stdout, mode) => {
	assert.ok(checkedRecordValueIndexRubyModes.includes(mode));
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, checkedRecordValueIndexRubyCounts[mode]);
	return result;
};
