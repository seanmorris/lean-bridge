/**
 * Bind fresh zero-payload checked-record WIT acceptance to explicit tools and the complete original archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { zeroPayloadBrowserSelection } from "./zero-payload-checked-record-browser-fixture.mjs";
import { zeroPayloadWitModes, zeroPayloadWitRoutes } from "./zero-payload-checked-record-wit-fixture.mjs";
import { checkZeroPayloadWitReport } from "./zero-payload-checked-record-wit-report.mjs";
import { assertNominalSubtypeWitToolRecords } from "./nominal-subtype-wit-tool-records.mjs";

/**
 * Name one complete, independently installed package selection.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param mode - Full or result-only API.
 */
export const zeroPayloadWitCiTestName = (route, mode) => {
	assert.ok(zeroPayloadWitRoutes.includes(route)); assert.ok(zeroPayloadWitModes.includes(mode));
	const selection = zeroPayloadBrowserSelection(route);
	assert.equal(mode, selection.resultOnly ? "result-only" : "full");
	return `installed zero-payload records reproduce and relocate in WIT for ${route}`;
};

/**
 * Reject partial selections and ambient tool discovery before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseZeroPayloadWitCiArgs = args => {
	const usage = "Usage: check-zero-payload-checked-record-wit-ci.mjs --route ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --cc /absolute/cc --wasm-tools /absolute/wasm-tools --wasmtime-capi /absolute/capi";
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
	zeroPayloadWitCiTestName(selected.route, selected.mode);
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
export const assertZeroPayloadWitCiTap = (source, route, mode) => {
	const name = zeroPayloadWitCiTestName(route, mode);
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
export const checkZeroPayloadWitCiRecords = async (options, { tap, read, runtime, tools, archiveSha256 }) => {
	const selected = parseZeroPayloadWitCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertZeroPayloadWitCiTap(tap, selected.route, selected.mode);
	assertNominalSubtypeWitToolRecords(tools);
	assert.deepEqual(tools.selected, { cc: selected.cc, wasmTools: selected["wasm-tools"], wasmtimeCapi: selected["wasmtime-capi"] });
	assert.deepEqual(JSON.parse(await read("tools.json")), tools);
	const result = await checkZeroPayloadWitReport(read, { route: selected.route
		, mode: selected.mode
		, producerCommit: selected.producer, runtime, floor: selected.glibc });
	assert.equal(result.archiveSha256, archiveSha256);
	return { ...result, tools };
};
