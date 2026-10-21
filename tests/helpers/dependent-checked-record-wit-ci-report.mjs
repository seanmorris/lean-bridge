/**
 * Bind fresh dependent checked-record checked-record WIT acceptance to explicit tools and the complete original archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { dependentCheckedRecordSelection } from "./dependent-checked-record-browser-fixture.mjs";
import { dependentCheckedRecordWitModes, dependentCheckedRecordWitRoutes } from "./dependent-checked-record-wit-fixture.mjs";
import { checkDependentCheckedRecordWitReport } from "./dependent-checked-record-wit-report.mjs";
import { assertNominalSubtypeWitToolRecords } from "./nominal-subtype-wit-tool-records.mjs";

/**
 * Name one complete, independently installed package selection.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param mode - Full or result-only API.
 */
export const dependentCheckedRecordWitCiTestName = (route, mode) => {
	assert.ok(dependentCheckedRecordWitRoutes.includes(route)); assert.ok(dependentCheckedRecordWitModes.includes(mode));
	const selection = dependentCheckedRecordSelection(route);
	assert.equal(mode, selection.resultOnly ? "result-only" : "full");
	return `installed dependent checked records reproduce and relocate in WIT for ${route}`;
};

/**
 * Reject partial selections and ambient tool discovery before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseDependentCheckedRecordWitCiArgs = args => {
	const usage = "Usage: check-dependent-checked-record-wit-ci.mjs --route ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --cc /absolute/cc --wasm-tools /absolute/wasm-tools --wasmtime-capi /absolute/capi";
	const allowed = ["route", "mode", "producer", "directory", "tap", "glibc", "cc", "wasm-tools", "wasmtime-capi"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	dependentCheckedRecordWitCiTestName(selected.route, selected.mode);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u); assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	for(const key of ["cc", "wasm-tools", "wasmtime-capi"]) assert.ok(isAbsolute(selected[key]), usage);
	return selected;
};

/**
 * Require the exact successful selection, one terminal plan and zero skipped tests.
 *
 * @param source - Original combined producer output.
 * @param route - Expected author route.
 * @param mode - Expected API selection.
 */
export const assertDependentCheckedRecordWitCiTap = (source, route, mode) => {
	const name = dependentCheckedRecordWitCiTestName(route, mode);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Compare original records with independently inspected current host and archive facts.
 *
 * @param options - Closed source, API, platform floor and tool selection.
 * @param original - Original records and independently measured facts.
 * @param original.tap - Complete producer output.
 * @param original.read - Original byte reader with the archive-authenticated component.
 * @param original.runtime - Current checker platform, architecture and glibc.
 * @param original.tools - Freshly inspected compiler, package tools and Wasmtime C API.
 * @param original.archiveSha256 - Independently verified complete archive digest.
 */
export const checkDependentCheckedRecordWitCiRecords = async (options, { tap, read, runtime, tools, archiveSha256 }) => {
	const selected = parseDependentCheckedRecordWitCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertDependentCheckedRecordWitCiTap(tap, selected.route, selected.mode);
	assertNominalSubtypeWitToolRecords(tools);
	assert.deepEqual(tools.selected, { cc: selected.cc, wasmTools: selected["wasm-tools"], wasmtimeCapi: selected["wasmtime-capi"] });
	assert.deepEqual(JSON.parse(await read("tools.json")), tools);
	const result = await checkDependentCheckedRecordWitReport(read, { route: selected.route
		, mode: selected.mode
		, producerCommit: selected.producer, runtime, floor: selected.glibc });
	assert.equal(result.archiveSha256, archiveSha256);
	return { ...result, tools };
};
