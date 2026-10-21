/**
 * Closed Ruby selections and an independently authored caller for zero-payload
 * checked records: a proof-only Witness, a Unit-bearing Token, a plain empty
 * Marker and a Mark variant, each distinct from Option, nil and default values.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes
	, zeroPayloadBrowserSelection
	, zeroPayloadBrowserName
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadRubyRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadRubyTarget = Object.freeze({
	name: zeroPayloadBrowserName, version: "1.0.0"
});
export const zeroPayloadRubyRequirePath
	= `lean_bridge/${zeroPayloadBrowserName}`;
export const zeroPayloadRubyNamespace = "LeanBridge::Zeropayloadcheckedrecords";
export const zeroPayloadRubyModes = Object.freeze(["full", "result-only"]);
export const zeroPayloadRubyCounts = Object.freeze({
	full: Object.freeze({ calls: 30, checks: 80, recoveries: 8, rejections: 8, snapshots: 30 })
	, "result-only": Object.freeze({ calls: 9, checks: 38, recoveries: 0, rejections: 0, snapshots: 9 })
});

/**
 * Reject disabled, duplicate, or partial host selections before any build.
 *
 * @param environment - Explicit host environment.
 */
export const zeroPayloadRubyEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_RUBY_", flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid zero-payload Ruby TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid zero-payload Ruby ${name}`);
			assert.equal(flag, "1", `Explicit zero-payload Ruby ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid zero-payload Ruby ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate zero-payload Ruby ${name}`);
		return selected;
	};
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const rawLoad = environment[prefix + "MAX_LOAD"];
	if(rawLoad !== undefined) assert.equal(typeof rawLoad, "string", "Invalid zero-payload Ruby MAX_LOAD");
	const maxLoad = rawLoad === undefined ? environment.CI === "true" ? 8 : 12 : Number(rawLoad);
	assert.ok([8, 12, 16, 20].includes(maxLoad), "Zero-payload Ruby max load must be 8, 12, 16, or 20");
	assert.equal(environment[prefix + "MODES"], undefined
		, "Zero-payload Ruby modes are encoded by the selected route");
	return { enabled: flag === "1"
		, routes: select("ROUTES", zeroPayloadRubyRoutes), maxLoad };
};

/**
 * Select exactly one ordinary/reviewed and full/result-only Ruby gem build.
 *
 * @param route - Exact independent author route.
 */
export const zeroPayloadRubyConfiguration = route => {
	assert.ok(zeroPayloadRubyRoutes.includes(route), "Unknown zero-payload Ruby route");
	const selection = zeroPayloadBrowserSelection(route);
	return { ...selection.configuration, targets: { rubygems: zeroPayloadRubyTarget } };
};

/** Load an immutable caller independent of generated Ruby package output. */
export const zeroPayloadRubyCaller = () => readFile(
	"tests/fixtures/zero-payload-checked-record-ruby/ruby.rb", "utf8");

/**
 * Preserve only route-derived switches at process launch.
 *
 * @param route - Exact independent author route.
 */
export const zeroPayloadRubyCallerArgs = route => {
	assert.ok(zeroPayloadRubyRoutes.includes(route), "Unknown zero-payload Ruby route");
	const { resultOnly, reviewed } = zeroPayloadBrowserSelection(route);
	return [...resultOnly ? ["--result-only"] : [], ...reviewed ? ["--reviewed"] : []];
};

/**
 * Require the complete, independent caller receipt for its exact API mode.
 *
 * @param stdout - Complete immutable caller output.
 * @param mode - Full API or constructor-free results only.
 */
export const parseZeroPayloadRubyResult = (stdout, mode) => {
	assert.ok(zeroPayloadRubyModes.includes(mode));
	assert.equal(typeof stdout, "string"); assert.ok(stdout.endsWith("\n"));
	const result = JSON.parse(stdout);
	assert.deepEqual(result, zeroPayloadRubyCounts[mode]);
	return result;
};
