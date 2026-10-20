/**
 * Require complete hosted C/C++ value-index acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	checkedRecordValueIndexNativeRoutes
} from "./checked-record-value-index-native-fixture.mjs";
import {
	checkedRecordValueIndexNativeRecordPaths
	, checkCheckedRecordValueIndexNativeReport
} from "./checked-record-value-index-native-report.mjs";

const usage = "Usage: check-checked-record-value-index-native-ci.mjs --route <ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir> --producer <commit> --consumer <commit> --checker <commit> --directory <records> --acceptance-tap <tap> --controls-tap <tap> --runtime <json> --floor <glibc>";

/**
 * Require one complete terminal node:test TAP stream.
 *
 * @param source - Original TAP text.
 * @param tests - Exact test count.
 * @param skipped - Exact skip count.
 * @param expectedName - Optional exact sole-test name.
 */
export const assertCheckedRecordValueIndexNativeTap = (
	source, tests, skipped = 0, expectedName = null
) => {
	assert.equal(typeof source, "string");
	if(expectedName !== null)
	{
		assert.equal(tests, 1); assert.equal(skipped, 0);
		assert.equal(typeof expectedName, "string");
		assert.ok(expectedName.length && !/[\r\n]/u.test(expectedName));
		assert.ok(source.includes(
			`# Subtest: ${expectedName}\nok 1 - ${expectedName}\n`));
	}
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:not ok|Bail out!)/gmu);
	assert.match(source, new RegExp(
		`\\n1\\.\\.${tests}\\n# tests ${tests}\\n# suites 0\\n# pass ${tests - skipped}\\n# fail 0\\n# cancelled 0\\n# skipped ${skipped}\\n# todo 0\\n# duration_ms [0-9]+(?:\\.[0-9]+)?\\n$`
		, "u"));
};

/**
 * Refuse ambiguous checker selections before reading hosted records.
 *
 * @param args - Command arguments following the script name.
 */
export const parseCheckedRecordValueIndexNativeCiArgs = args => {
	const allowed = [
		"route", "producer", "consumer", "checker", "directory"
		, "acceptance-tap", "controls-tap", "runtime", "floor"
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
			&& value.length && !value.startsWith("--") && !/[\0\r\n]/u.test(value)
		, usage);
		selected[key] = value;
	}
	assert.ok(checkedRecordValueIndexNativeRoutes.includes(selected.route), usage);
	for(const key of ["producer", "consumer", "checker"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	assert.match(selected.floor, /^2\.[0-9]+$/u, usage);
	return selected;
};

/**
 * Reconcile TAP, runtime, exact inventory, original reports and control output.
 *
 * @param options - Explicit CLI-equivalent source identities and route.
 * @param original - Original hosted observations.
 * @param original.acceptanceTap - Complete producer/consumer TAP.
 * @param original.controlsTap - Complete fast-control TAP.
 * @param original.runtime - Independently observed runtime/toolchain identity.
 * @param original.paths - Complete retained regular-file inventory.
 * @param original.read - Closed reader for retained files.
 */
export const checkCheckedRecordValueIndexNativeCiRecords = async (
	options, original
) => {
	const { acceptanceTap, controlsTap, runtime, paths, read } = original;
	const selected = parseCheckedRecordValueIndexNativeCiArgs(
		Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]));
	assertCheckedRecordValueIndexNativeTap(acceptanceTap, 1, 0
		, `installed value-index records reproduce and relocate in C/C++ for ${selected.route}`);
	assertCheckedRecordValueIndexNativeTap(controlsTap, 20, 4);
	assert.deepEqual(Object.keys(runtime).sort()
		, ["arch", "cc", "cpp", "glibc", "platform"]);
	const report = JSON.parse(await read("report.json"));
	const expectedPaths = [
		...checkedRecordValueIndexNativeRecordPaths(selected.route, report.receipt)
		, "controls.json"
	].sort();
	assert.equal(new Set(expectedPaths).size, expectedPaths.length);
	assert.deepEqual(paths, expectedPaths);
	const accepted = await checkCheckedRecordValueIndexNativeReport(read, {
		route: selected.route, producerCommit: selected.producer
		, consumerCommit: selected.consumer, runtime, floor: selected.floor
	});
	const controls = JSON.parse(await read("controls.json"));
	assert.deepEqual(Object.keys(controls).sort(), [
		"accepted", "callerControls", "checkerCommit", "executionRecordControls"
		, "gitBindingControls", "installedIrControls"
		, "observationControls", "packageControls", "provenanceControls"
		, "reconciliationControls", "runtimeControls", "schemaVersion"
	]);
	assert.equal(controls.schemaVersion, 1);
	assert.equal(controls.checkerCommit, selected.checker);
	assert.deepEqual(controls.accepted, accepted);
	assert.equal(controls.provenanceControls, 5, "provenanceControls");
	for(const key of [
		"callerControls", "executionRecordControls", "gitBindingControls"
		, "installedIrControls", "observationControls"
		, "packageControls", "provenanceControls", "reconciliationControls"
		, "runtimeControls"
	].filter(key => key !== "provenanceControls")) assert.equal(controls[key], 1, key);
	return {
		...accepted
		, sourceIdentities: {
			producer: selected.producer, consumer: selected.consumer
			, checker: selected.checker
		}
		, controls: {
			fastPasses: 8, skippedInstalledRoutes: 4
			, destructiveMutations: 13
		}
	};
};
