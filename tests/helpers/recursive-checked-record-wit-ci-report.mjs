/**
 * Bind fresh recursive checked-record WIT acceptance to explicit tools and the complete original archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { recursiveCheckedRecordWitFixtures, recursiveCheckedRecordWitRoutes } from "./recursive-checked-record-wit-fixture.mjs";
import { checkRecursiveCheckedRecordWitControls } from "./recursive-checked-record-wit-controls.mjs";
import { checkRecursiveCheckedRecordWitReport } from "./recursive-checked-record-wit-report.mjs";
import { assertNominalSubtypeWitToolRecords } from "./nominal-subtype-wit-tool-records.mjs";

/**
 * Name one complete, independently installed package selection.
 *
 * @param route - Ordinary or independently reviewed source.
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordWitCiTestName = (route, fixture) => {
	assert.ok(recursiveCheckedRecordWitRoutes.includes(route)); assert.ok(recursiveCheckedRecordWitFixtures.includes(fixture));
	return `installed recursive checked-record WIT packages reproduce and relocate ${route} ${fixture}`;
};

/**
 * Reject partial selections and ambient tool discovery before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseRecursiveCheckedRecordWitCiArgs = args => {
	const usage = "Usage: check-recursive-checked-record-wit-ci.mjs --route ordinary|reviewed --fixture recursive|mutual --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --cc /absolute/cc --wasm-tools /absolute/wasm-tools --wasmtime-capi /absolute/capi";
	const allowed = ["route", "fixture", "producer", "directory", "tap", "glibc", "cc", "wasm-tools", "wasmtime-capi"], selected = {};
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
	assert.ok(recursiveCheckedRecordWitRoutes.includes(selected.route), usage);
	assert.ok(recursiveCheckedRecordWitFixtures.includes(selected.fixture), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u, usage); assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	for(const key of ["cc", "wasm-tools", "wasmtime-capi"]) assert.ok(isAbsolute(selected[key]), usage);
	return selected;
};

/**
 * Require the exact successful selection, one terminal plan and zero skipped tests.
 *
 * @param source - Original combined producer output.
 * @param route - Expected author route.
 * @param fixture - Expected module.
 */
export const assertRecursiveCheckedRecordWitCiTap = (source, route, fixture) => {
	const name = recursiveCheckedRecordWitCiTestName(route, fixture);
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
 * Compare original records with independently inspected current host and archive facts,
 * then require every corruption control to refuse.
 *
 * @param options - Closed source, module, platform floor and tool selection.
 * @param original - Original records and independently measured facts.
 * @param original.tap - Complete producer output.
 * @param original.read - Original byte reader with the archive-authenticated component.
 * @param original.runtime - Current checker platform, architecture and glibc.
 * @param original.tools - Freshly inspected compiler, package tools and Wasmtime C API.
 * @param original.archiveSha256 - Independently verified complete archive digest.
 */
export const checkRecursiveCheckedRecordWitCiRecords = async (options, { tap, read, runtime, tools, archiveSha256 }) => {
	const selected = parseRecursiveCheckedRecordWitCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertRecursiveCheckedRecordWitCiTap(tap, selected.route, selected.fixture);
	assertNominalSubtypeWitToolRecords(tools);
	assert.deepEqual(tools.selected, { cc: selected.cc, wasmTools: selected["wasm-tools"], wasmtimeCapi: selected["wasmtime-capi"] });
	assert.deepEqual(JSON.parse(await read("tools.json")), tools);
	const scope = { route: selected.route, fixture: selected.fixture
		, producerCommit: selected.producer, runtime, floor: selected.glibc };
	const result = await checkRecursiveCheckedRecordWitReport(read, scope);
	assert.equal(result.archiveSha256, archiveSha256);
	const controls = await checkRecursiveCheckedRecordWitControls(read, scope);
	return { ...result, tools, controls };
};
