/**
 * Reconcile the recurring installed C entry measurement without rewriting historical evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeNativeReport, nominalSubtypeNativeRecordPaths } from "./nominal-subtype-native-report.mjs";
import { assertNominalSubtypeDispatchReport } from "./nominal-subtype-dispatch.mjs";

const routes = ["ordinary", "reviewed"], modes = ["full", "result-only"];
const legacyDispatch = { observed: false, reason: "Separate constructor/source entry probe remains required" };
const unmeasured = "Dispatch is measured on the C profile of constructor-bearing modes only";

/**
 * Exact original records for one measured or explicitly unmeasured selection.
 *
 * @param mode - Constructor-bearing full or constructor-free result-only API.
 */
export const nominalSubtypeEntryNativeRecordPaths = mode => [
	...nominalSubtypeNativeRecordPaths
	, ...mode === "full" ? ["c/dispatch.json"] : []
];

/**
 * Parse one fixed native measurement selection.
 *
 * @param args - CLI arguments following the executable script name.
 */
export const parseNominalSubtypeEntryNativeCiArgs = args => {
	const usage = "Usage: check-nominal-subtype-entry-native-ci.mjs --route <ordinary|reviewed> --mode <full|result-only> --producer <commit> --directory <records> --tap <original-tap> --floor <glibc-floor>";
	const allowed = ["route", "mode", "producer", "directory", "tap", "floor"], selected = {};
	assert.ok(Array.isArray(args) && args.length === 2 * allowed.length, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.ok(routes.includes(selected.route), usage); assert.ok(modes.includes(selected.mode), usage);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u); assert.match(selected.floor, /^2\.[0-9]+$/u);
	return selected;
};

const assertTap = (tap, route, mode) => {
	assert.equal(typeof tap, "string"); assert.ok(tap.endsWith("\n"));
	assert.match(tap, new RegExp(`# Subtest: installed native nominal Subtypes reproduce and relocate ${route} ${mode}\\n`, "u"));
	assert.match(tap, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
	assert.doesNotMatch(tap, /not ok|Bail out!|# SKIP|# TODO/u);
};

const version = value => Number(value.split(".")[1]);

/**
 * Check the original report, exact record closure and a compatibility view through the historical checker.
 *
 * @param options - Explicit parsed selection.
 * @param original - Complete path inventory, TAP and closed record reader.
 * @param original.tap - Original producer TAP.
 * @param original.paths - Complete regular-file inventory.
 * @param original.read - Closed reader relative to the selection records.
 */
export const checkNominalSubtypeEntryNativeCiRecords = async (options, { tap, paths, read }) => {
	const selected = parseNominalSubtypeEntryNativeCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertTap(tap, selected.route, selected.mode);
	const bytes = async path => Buffer.from(await read(path));
	const json = async path => {
		const source = await bytes(path), value = JSON.parse(source);
		assert.equal(source.toString(), canonicalJson(value), path); return value;
	};
	const report = await json("report.json"), runtime = await json("runtime.json");
	assert.equal(report.declaredGlibcFloor, selected.floor); assert.deepEqual(report.runtime, runtime);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	const observedGlibc = runtime.glibc.stdout.trim().split(" ")[1];
	assert.ok(version(observedGlibc) >= version(selected.floor));
	assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
	const measured = selected.mode === "full", c = report.reports[0], cpp = report.reports[1];
	if(measured)
	{
		const dispatch = await json("c/dispatch.json"); assert.deepEqual(c.dispatch, dispatch);
		assertNominalSubtypeDispatchReport(dispatch, dispatch.symbols);
		assert.deepEqual(cpp.dispatch, { observed: false, reason: unmeasured });
	}
	else for(const item of [c, cpp]) assert.deepEqual(item.dispatch, { observed: false, reason: unmeasured });
	const expected = nominalSubtypeEntryNativeRecordPaths(selected.mode).sort();
	assert.equal(new Set(expected).size, expected.length); assert.deepEqual(paths, expected);
	const floorRuntime = { platform: "linux", arch: "x64"
		, glibc: { code: 0, stdout: `glibc ${selected.floor}\n`, stderr: "" } };
	const compatibility = async path => {
		if(path === "runtime.json") return Buffer.from(canonicalJson(floorRuntime));
		if(path === "report.json")
		{
			const value = structuredClone(report); value.runtime = floorRuntime;
			for(const item of value.reports) item.dispatch = legacyDispatch;
			return Buffer.from(canonicalJson(value));
		}
		if(path === "c/report.json" || path === "cpp/report.json")
		{
			const value = await json(path); value.dispatch = legacyDispatch;
			return Buffer.from(canonicalJson(value));
		}
		return bytes(path);
	};
	const counts = selected.mode === "full" ? { c: 4149, cpp: 4122 } : { c: 2042, cpp: 2042 };
	const checked = await checkNominalSubtypeNativeReport(compatibility, {
		route: selected.route, mode: selected.mode, producerCommit: selected.producer
		, runtime: { platform: "linux", arch: "x64", glibc: selected.floor }, counts
	});
	return { ...checked, runtime, declaredGlibcFloor: selected.floor, dispatchObserved: measured };
};
