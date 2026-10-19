/**
 * Require complete hosted value-index npm and browser records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	checkedRecordValueIndexBrowserRoutes
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexBrowserRecordPaths
	, checkCheckedRecordValueIndexBrowserReport
} from "./checked-record-value-index-browser-report.mjs";

const usage = "Usage: check-checked-record-value-index-browser-ci.mjs --route <ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir> --producer <commit> --npm-checker <commit> --consumer <commit> --checker <commit> --directory <records> --acceptance-tap <tap> --controls-tap <tap> --runtime <json>";

/**
 * Require one complete terminal node:test TAP stream.
 *
 * @param source - Original TAP text.
 * @param tests - Exact test count.
 * @param skipped - Exact skipped count.
 */
export const assertCheckedRecordValueIndexBrowserTap = (
	source, tests, skipped = 0
) => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:not ok|Bail out!)/gmu);
	assert.match(source, new RegExp(
		`\\n1\\.\\.${tests}\\n# tests ${tests}\\n# suites 0\\n# pass ${tests - skipped}\\n# fail 0\\n# cancelled 0\\n# skipped ${skipped}\\n# todo 0\\n# duration_ms [0-9]+(?:\\.[0-9]+)?\\n$`
		, "u"));
};

/**
 * Refuse ambiguous hosted-checker selections before reading records.
 *
 * @param args - Command arguments following the script name.
 */
export const parseCheckedRecordValueIndexBrowserCiArgs = args => {
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
		const valid = !Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length && !value.startsWith("--") && !/[\0\r\n]/u.test(value);
		assert.ok(valid, usage);
		selected[key] = value;
	}
	assert.ok(checkedRecordValueIndexBrowserRoutes.includes(selected.route), usage);
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
export const checkCheckedRecordValueIndexBrowserCiRecords = async (
	options, original
) => {
	const { acceptanceTap, controlsTap, runtime, paths, read } = original;
	const selected = parseCheckedRecordValueIndexBrowserCiArgs(
		Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]));
	assertCheckedRecordValueIndexBrowserTap(acceptanceTap, 1);
	assertCheckedRecordValueIndexBrowserTap(controlsTap, 15, 4);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "node", "platform"]);
	const npm = JSON.parse(await read("report.json"));
	const expectedPaths = checkedRecordValueIndexBrowserRecordPaths(npm.receipt);
	assert.equal(new Set(expectedPaths).size, expectedPaths.length);
	assert.deepEqual(paths, expectedPaths);
	const accepted = await checkCheckedRecordValueIndexBrowserReport(read, {
		route: selected.route, producerCommit: selected.producer
		, consumerCommit: selected.consumer, runtime
	});
	const controls = JSON.parse(await read("controls.json"));
	assert.deepEqual(Object.keys(controls).sort(), [
		"accepted", "checkerCommit", "gitBindingControls", "installedIrControls"
		, "provenanceControls", "reconciliationControls", "schemaVersion"
	]);
	assert.equal(controls.schemaVersion, 1);
	assert.equal(controls.checkerCommit, selected.checker);
	assert.deepEqual(controls.accepted, accepted);
	assert.equal(controls.provenanceControls, 5);
	assert.equal(controls.reconciliationControls, 1);
	assert.equal(controls.gitBindingControls, 1);
	assert.equal(controls.installedIrControls, 2);
	return {
		...accepted
		, sourceIdentities: {
			producer: selected.producer, npmChecker: selected["npm-checker"]
			, consumer: selected.consumer, checker: selected.checker
		}
		, controls: {
			fastPasses: 11, skippedInstalledRoutes: 4
			, checkedRefusalsPerExecution: 4, shapeRefusalsPerExecution: 2
			, recoveriesPerExecution: 6
			, provenanceMutations: controls.provenanceControls
			, reconciliationMutations: controls.reconciliationControls
			, gitBindingMutations: controls.gitBindingControls
			, installedIrMutations: controls.installedIrControls
		}
	};
};
