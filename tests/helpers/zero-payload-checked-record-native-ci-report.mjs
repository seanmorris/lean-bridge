/**
 * Require complete hosted C/C++ zero-payload acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	assertCheckedRecordValueIndexNativeTap as assertNativeTap
} from "./checked-record-value-index-native-ci-report.mjs";
import {
	zeroPayloadNativeRoutes
} from "./zero-payload-checked-record-native-fixture.mjs";
import {
	checkZeroPayloadNativeReport, zeroPayloadNativeRecordPaths
} from "./zero-payload-checked-record-native-report.mjs";

const usage = "Usage: check-zero-payload-checked-record-native-ci.mjs --route <ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir> --producer <commit> --consumer <commit> --checker <commit> --directory <records> --acceptance-tap <tap> --controls-tap <tap> --runtime <json> --floor <glibc>";

export const zeroPayloadNativeRequiredControlNames = Object.freeze({
	passed: Object.freeze([
		"zero-payload checked-record history restores every source"
		, "zero-payload checked-record history rejects altered transitions"
		, "zero-payload checked-record writer refuses unrelated checkouts"
		, "zero-payload native selections preserve all four author/API routes"
		, "generated C and C++ keep empty, Unit and Option carriers distinct"
		, "zero-payload native callers lock counts and reviewed diagnostics"
		, "zero-payload browser evidence closes every hosted source role"
		, "zero-payload native evidence closes every hosted source role"
		, "zero-payload .NET evidence closes every hosted source role"
		, "zero-payload hosted evidence accepts only closed absolute selections"
		, "zero-payload native history restores every source"
		, "zero-payload native history rejects altered transitions"
		, "zero-payload native history writer refuses unrelated checkouts"
		, "zero-payload native archive history restores every source"
		, "zero-payload native archive history rejects altered transitions"
		, "zero-payload native archive writer refuses unrelated checkouts"
		, "an independent zero-payload review is valid and selects the nullary constructor"
		, "native metadata admits zero-payload checked records only through a constructor or as a result"
		, "compiler plans retain empty checked-record input and result trees"
	])
	, skipped: Object.freeze([
		...zeroPayloadNativeRoutes.map(route =>
			`installed zero-payload records reproduce and relocate in C/C++ for ${route}`)
		, "fresh Lean admits proof-only and Unit-bearing checked records with exact erased proofs"
		, "every refused zero-payload site reports its own diagnostic"
		, "the independent zero-payload review reconciles exactly with fresh Lean"
	])
});

const escapeRegExp = source => source.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Require the stable semantic controls while accepting added authenticated readers.
 *
 * @param source - Complete node:test TAP stream.
 */
export const assertZeroPayloadNativeControlsTap = source => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /^(?:not ok|Bail out!)/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:not ok|Bail out!)/gmu);
	const terminal = source.match(/\n1\.\.(\d+)\n# tests (\d+)\n# suites 0\n# pass (\d+)\n# fail 0\n# cancelled 0\n# skipped (\d+)\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
	assert.ok(terminal, "Complete zero-payload control TAP");
	const tests = Number(terminal[1]);
	const declared = Number(terminal[2]);
	const passed = Number(terminal[3]);
	const skipped = Number(terminal[4]);
	assert.equal(declared, tests);
	assert.equal(skipped, zeroPayloadNativeRequiredControlNames.skipped.length);
	assert.equal(passed + skipped, tests);
	assert.ok(passed >= zeroPayloadNativeRequiredControlNames.passed.length);
	const requireResult = (name, shouldSkip) => {
		assert.equal(source.split(`# Subtest: ${name}\n`).length, 2, name);
		const suffix = shouldSkip ? " # SKIP(?: .*)?" : "";
		const result = new RegExp(
			`^ok [0-9]+ - ${escapeRegExp(name)}${suffix}$`, "mu"
		);
		assert.match(source, result, name);
	};
	for(const name of zeroPayloadNativeRequiredControlNames.passed)
		requireResult(name, false);
	for(const name of zeroPayloadNativeRequiredControlNames.skipped)
		requireResult(name, true);
	return {
		fastPasses: passed, skippedInstalledOrLeanTests: skipped
	};
};

/**
 * Refuse ambiguous checker selections before reading hosted records.
 *
 * @param args - Command arguments following the script name.
 */
export const parseZeroPayloadNativeCiArgs = args => {
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
	assert.ok(zeroPayloadNativeRoutes.includes(selected.route), usage);
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
 * @param original.controlsTap - Complete focused source-gate TAP.
 * @param original.runtime - Independently observed runtime/toolchain identity.
 * @param original.paths - Complete retained regular-file inventory.
 * @param original.read - Closed reader for retained files.
 */
export const checkZeroPayloadNativeCiRecords = async (options, original) => {
	const { acceptanceTap, controlsTap, runtime, paths, read } = original;
	const selected = parseZeroPayloadNativeCiArgs(
		Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]));
	assertNativeTap(acceptanceTap, 1, 0
		, `installed zero-payload records reproduce and relocate in C/C++ for ${selected.route}`);
	const controlCounts = assertZeroPayloadNativeControlsTap(controlsTap);
	assert.deepEqual(Object.keys(runtime).sort()
		, ["arch", "cc", "cpp", "glibc", "platform"]);
	const report = JSON.parse(await read("report.json"));
	const expectedPaths = [
		...zeroPayloadNativeRecordPaths(selected.route, report.receipt)
		, "controls.json"
	].sort();
	assert.equal(new Set(expectedPaths).size, expectedPaths.length);
	assert.deepEqual(paths, expectedPaths);
	const accepted = await checkZeroPayloadNativeReport(read, {
		route: selected.route, producerCommit: selected.producer
		, consumerCommit: selected.consumer, runtime, floor: selected.floor
	});
	const controls = JSON.parse(await read("controls.json"));
	assert.deepEqual(Object.keys(controls).sort(), [
		"accepted", "callerControls", "checkerCommit", "executionRecordControls"
		, "gitBindingControls", "installedIrControls", "observationControls"
		, "packageControls", "runtimeControls", "schemaVersion", "semanticControls"
	]);
	assert.equal(controls.schemaVersion, 1);
	assert.equal(controls.checkerCommit, selected.checker);
	assert.deepEqual(controls.accepted, accepted);
	for(const key of [
		"callerControls", "executionRecordControls", "gitBindingControls"
		, "installedIrControls", "observationControls", "packageControls"
		, "runtimeControls", "semanticControls"
	]) assert.equal(controls[key], 1, key);
	return {
		...accepted
		, sourceIdentities: {
			producer: selected.producer, consumer: selected.consumer
			, checker: selected.checker
		}
		, controls: {
			...controlCounts
			, destructiveMutations: 8
		}
	};
};
