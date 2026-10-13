/**
 * Bind fresh nominal WIT acceptance to explicit tools and the complete original archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { nominalSubtypeWitRoutes, nominalSubtypeWitModes } from "./nominal-subtype-wit-fixture.mjs";
import { checkNominalSubtypeWitReport } from "./nominal-subtype-wit-report.mjs";
import { assertNominalSubtypeWitToolRecords } from "./nominal-subtype-wit-tool-records.mjs";

/**
 * Name one complete, independently installed package selection.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param mode - Full or result-only API.
 */
export const nominalSubtypeWitCiTestName = (route, mode) => {
	assert.ok(nominalSubtypeWitRoutes.includes(route)); assert.ok(nominalSubtypeWitModes.includes(mode));
	return `installed nominal WIT packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject partial selections and ambient tool discovery before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseNominalSubtypeWitCiArgs = args => {
	const usage = "Usage: check-nominal-subtype-wit-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --cc /absolute/cc --wasm-tools /absolute/wasm-tools --wasmtime-capi /absolute/capi";
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
	nominalSubtypeWitCiTestName(selected.route, selected.mode);
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
export const assertNominalSubtypeWitCiTap = (source, route, mode) => {
	const name = nominalSubtypeWitCiTestName(route, mode);
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
export const checkNominalSubtypeWitCiRecords = async (options, { tap, read, runtime, tools, archiveSha256 }) => {
	const selected = parseNominalSubtypeWitCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalSubtypeWitCiTap(tap, selected.route, selected.mode);
	assertNominalSubtypeWitToolRecords(tools);
	assert.deepEqual(tools.selected, { cc: selected.cc, wasmTools: selected["wasm-tools"], wasmtimeCapi: selected["wasmtime-capi"] });
	assert.deepEqual(JSON.parse(await read("tools.json")), tools);
	const result = await checkNominalSubtypeWitReport(read, { route: selected.route
		, mode: selected.mode
		, producerCommit: selected.producer, runtime, floor: selected.glibc });
	assert.equal(result.archiveSha256, archiveSha256);
	return { ...result, tools };
};
