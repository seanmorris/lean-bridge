/**
 * Require complete hosted zero-payload npm and browser records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	zeroPayloadBrowserRoutes
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	checkZeroPayloadBrowserReport
	, checkZeroPayloadNpmReport
	, zeroPayloadBrowserRecordPaths
} from "./zero-payload-checked-record-browser-report.mjs";

const usage = "Usage: check-zero-payload-checked-record-browser-ci.mjs --route <ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir> --producer <commit> --npm-checker <commit> --consumer <commit> --checker <commit> --directory <records> --acceptance-tap <tap> --controls-tap <tap> --runtime <json>";

/**
 * Require one complete terminal node:test TAP stream.
 *
 * @param source - Original TAP text.
 * @param options - Required count boundaries.
 * @param options.tests - Exact test count, when supplied.
 * @param options.skipped - Exact skipped count.
 * @param options.minimumPasses - Minimum passed controls.
 */
export const assertZeroPayloadBrowserTap = (
	source, { tests, skipped = 0, minimumPasses = 1 } = {}
) => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:not ok|Bail out!)/gmu);
	const terminal = source.match(
		/\n1\.\.(\d+)\n# tests (\d+)\n# suites 0\n# pass (\d+)\n# fail 0\n# cancelled 0\n# skipped (\d+)\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u
	);
	assert.ok(terminal, "Missing terminal TAP summary");
	const observed = terminal.slice(1).map(Number);
	assert.equal(observed[0], observed[1]);
	assert.equal(observed[1], observed[2] + observed[3]);
	if(tests !== undefined) assert.equal(observed[1], tests);
	assert.equal(observed[3], skipped);
	assert.ok(observed[2] >= minimumPasses);
};

/**
 * Refuse ambiguous hosted-checker selections before reading records.
 *
 * @param args - Command arguments following the script name.
 */
export const parseZeroPayloadBrowserCiArgs = args => {
	const allowed = [
		"route", "producer", "npm-checker", "consumer", "checker", "directory"
		, "acceptance-tap", "controls-tap", "runtime"
	];
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
	assert.ok(zeroPayloadBrowserRoutes.includes(selected.route), usage);
	for(const key of ["producer", "npm-checker", "consumer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	return selected;
};

/**
 * Reconcile TAP, runtime, exact file inventory and original reports.
 *
 * @param options - Explicit route and four source identities.
 * @param original - Original hosted observations.
 * @param original.acceptanceTap - Complete producer/consumer TAP.
 * @param original.controlsTap - Complete fast-control TAP.
 * @param original.runtime - Independently observed Node identity.
 * @param original.paths - Complete retained regular-file inventory.
 * @param original.read - Closed reader for retained files.
 */
export const checkZeroPayloadBrowserCiRecords = async (options, original) => {
	const { acceptanceTap, controlsTap, runtime, paths, read } = original;
	const selected = parseZeroPayloadBrowserCiArgs(
		Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]));
	assertZeroPayloadBrowserTap(acceptanceTap, { tests: 1 });
	assertZeroPayloadBrowserTap(controlsTap, { skipped: 4, minimumPasses: 12 });
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "node", "platform"]);
	const npm = JSON.parse(await read("report.json"));
	const expectedPaths = zeroPayloadBrowserRecordPaths(npm.receipt);
	assert.equal(new Set(expectedPaths).size, expectedPaths.length);
	assert.deepEqual(paths, expectedPaths);
	const npmAccepted = await checkZeroPayloadNpmReport(read, {
		route: selected.route, producerCommit: selected.producer, runtime
	});
	const browserAccepted = await checkZeroPayloadBrowserReport(read, {
		route: selected.route, producerCommit: selected.producer
		, consumerCommit: selected.consumer
	});
	const controls = JSON.parse(await read("controls.json"));
	assert.deepEqual(Object.keys(controls).sort(), [
		"accepted", "byteControls", "checkerCommit", "schemaVersion"
		, "semanticControls"
	]);
	assert.equal(controls.schemaVersion, 1);
	assert.equal(controls.checkerCommit, selected.checker);
	assert.deepEqual(controls.accepted, {
		npm: npmAccepted, browser: browserAccepted
	});
	assert.equal(controls.semanticControls, 4);
	assert.equal(controls.byteControls, 4);
	return {
		npm: npmAccepted, browser: browserAccepted
		, sourceIdentities: {
			producer: selected.producer, npmChecker: selected["npm-checker"]
			, consumer: selected.consumer, checker: selected.checker
		}
		, controls: {
			semanticMutations: controls.semanticControls
			, byteMutations: controls.byteControls
		}
	};
};
