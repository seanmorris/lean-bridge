/**
 * Require complete hosted inherited checked-record npm and browser records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordNpmRoutes,
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";
import {
	checkInheritedCheckedRecordBrowserReport,
	inheritedCheckedRecordBrowserRecordPaths
} from "./inherited-checked-record-browser-report.mjs";

const usage = "Usage: check-inherited-checked-record-browser-ci.mjs --route <ordinary-full|ordinary-result-only|reviewed-full|reviewed-result-only> --producer <commit> --npm-checker <commit> --consumer <commit> --checker <commit> --directory <records> --npm-tap <tap> --browser-tap <tap> --controls-tap <tap> --runtime <json>";

/**
 * Require a complete terminal node:test TAP stream.
 *
 * @param source - Original TAP bytes as text.
 * @param tests - Exact test count.
 * @param skipped - Exact skipped count.
 */
export const assertInheritedCheckedRecordBrowserTap = (source, tests, skipped = 0) => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:not ok|Bail out!)/gmu);
	assert.match(source, new RegExp(
		`\\n1\\.\\.${tests}\\n# tests ${tests}\\n# suites 0\\n# pass ${tests - skipped}\\n# fail 0\\n# cancelled 0\\n# skipped ${skipped}\\n# todo 0\\n# duration_ms [0-9]+(?:\\.[0-9]+)?\\n$`, "u"));
};

/**
 * Refuse ambiguous CLI selections before reading records.
 *
 * @param args - Command arguments following the script name.
 */
export const parseInheritedCheckedRecordBrowserCiArgs = args => {
	const allowed = ["route", "producer", "npm-checker", "consumer"
		, "checker", "directory", "npm-tap", "browser-tap"
		, "controls-tap", "runtime"];
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	const selected = {};
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(inheritedCheckedRecordNpmRoutes.includes(selected.route), usage);
	for(const key of ["producer", "npm-checker", "consumer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	return selected;
};

/**
 * Reconcile original TAP, runtime, file inventory, reports and control receipts.
 *
 * @param options - Explicit route and source identities.
 * @param original - Original hosted observations.
 * @param original.npmTap - Complete npm producer TAP.
 * @param original.browserTap - Complete browser consumer TAP.
 * @param original.controlsTap - Complete destructive-control TAP.
 * @param original.runtime - Independently observed Node runtime.
 * @param original.paths - Complete retained regular-file inventory.
 * @param original.read - Closed reader for retained files.
 */
export const checkInheritedCheckedRecordBrowserCiRecords = async (
	options, original
) => {
	const { npmTap, browserTap, controlsTap, runtime, paths, read } = original;
	const selected = parseInheritedCheckedRecordBrowserCiArgs(Object.entries(options)
		.flatMap(([key, value]) => ["--" + key, value]));
	assertInheritedCheckedRecordBrowserTap(npmTap, 1);
	assertInheritedCheckedRecordBrowserTap(browserTap, 2);
	assertInheritedCheckedRecordBrowserTap(controlsTap, 1);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "node", "platform"]);
	const npm = JSON.parse(await read("report.json"));
	const expected = [
		...inheritedCheckedRecordBrowserRecordPaths(
			inheritedCheckedRecordNpmSelection(selected.route).mode, npm.receipt)
		, "controls.json", "browser-controls.json"
	].sort();
	assert.equal(new Set(expected).size, expected.length);
	assert.deepEqual(paths, expected);
	const accepted = await checkInheritedCheckedRecordBrowserReport(read, {
		route: selected.route, producerCommit: selected.producer
		, consumerCommit: selected.consumer, runtime
	});
	const npmControls = JSON.parse(await read("controls.json"));
	const browserControls = JSON.parse(await read("browser-controls.json"));
	assert.equal(npmControls.checkerCommit, selected["npm-checker"]);
	assert.equal(browserControls.checkerCommit, selected.checker);
	assert.deepEqual(browserControls.accepted, accepted);
	assert.deepEqual({
		record: browserControls.recordControls
		, npmReport: browserControls.npmReportControls
		, npmAdapter: browserControls.npmAdapterControls
		, browser: browserControls.browserControls
	}, {
		record: 170, npmReport: 10
		, npmAdapter: inheritedCheckedRecordNpmSelection(selected.route).resultOnly ? 4 : 8
		, browser: 165
	});
	return { ...accepted, controls: {
		record: browserControls.recordControls
		, npmReport: browserControls.npmReportControls
		, npmAdapter: browserControls.npmAdapterControls
		, browser: browserControls.browserControls
	} };
};
