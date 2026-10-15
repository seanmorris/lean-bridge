/**
 * Validate the frozen local runner receipts for nineteen-base nominal WIT acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertNominalPrimitiveSubtypeWitCiTap } from "./nominal-primitive-subtype-wit-ci-report.mjs";

export const nominalPrimitiveSubtypeWitProducer = "88cf60117f2ea3bcef0213755c69a2e5d025f425";
/** The first launch commit; its controls checker defect was fixed before the accepted producer. */
export const nominalPrimitiveSubtypeWitFirstProducer = "23aec60f65c37995b43e963e22ef8f7a5ee00722";
export const nominalPrimitiveSubtypeWitLoadCeiling = 8;
/** The first launch commit ran under the default admission ceiling. */
export const nominalPrimitiveSubtypeWitFirstLoadCeiling = 6;
export const nominalPrimitiveSubtypeWitSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nominalPrimitiveSubtypeWitAcceptedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r1" }
	, { route: "ordinary", mode: "result-only", attempt: "r1" }
	, { route: "reviewed", mode: "full", attempt: "r1" }
	, { route: "reviewed", mode: "result-only", attempt: "r1" }
]);
export const nominalPrimitiveSubtypeWitPreservedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r1", revision: nominalPrimitiveSubtypeWitFirstProducer, producerCode: 0, controlsCode: 1 }
]);
export const nominalPrimitiveSubtypeWitWorktree = "/app/build/worktrees/nominal-primitive-wit-run-88cf601";
export const nominalPrimitiveSubtypeWitFirstWorktree = "/app/build/worktrees/nominal-primitive-wit-run-23aec60";
export const nominalPrimitiveSubtypeWitWorktreeLinks = Object.freeze({ node_modules: "/app/node_modules" });
export const nominalPrimitiveSubtypeWitRunner = "/app/build/run-vo1498-nominal-primitive-wit-88cf601.mjs";
export const nominalPrimitiveSubtypeWitControlsRunner = "/app/build/run-vo1498-nominal-primitive-wit-controls-88cf601.mjs";
export const nominalPrimitiveSubtypeWitFirstRunner = "/app/build/run-vo1498-nominal-primitive-wit-23aec60.mjs";
export const nominalPrimitiveSubtypeWitFirstControlsRunner = "/app/build/run-vo1498-nominal-primitive-wit-controls-23aec60.mjs";
export const nominalPrimitiveSubtypeWitTools = Object.freeze({ cc: "/usr/bin/cc", wasmTools: "/app/.toolchains/wasm-tools/bin/wasm-tools", wasmtimeCapi: "/app/.toolchains/wasmtime42" });
export const nominalPrimitiveSubtypeWitControlSources = Object.freeze([
	...["wit-wasi.c", "wit-values.h", "wit-inputs.h"].map(name => `tests/fixtures/nominal-primitive-subtype-consumers/${name}`)
	, ...["fixture", "package", "install", "installed-tests", "model-records", "package-records", "environment-records", "handoff", "report", "controls", "ci-report"]
		.map(name => `tests/helpers/nominal-primitive-subtype-wit-${name}.mjs`)
	, ...["generators", "tools", "tool-records", "interface"].map(name => `tests/helpers/nominal-subtype-wit-${name}.mjs`)
]);

const wrapper = ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3", "/usr/bin/node"];
const prefixPattern = (route, mode, revision) => new RegExp(`^/app/build/vo1498-nominal-primitive-wit-${route}-${mode}-r[1-9][0-9]*-${revision.slice(0, 7)}$`, "u");

/**
 * Require the exact frozen worktree, wrapper, environment and admission policy of one launch.
 *
 * @param options - Original launch receipt and archived runner bytes.
 * @param options.start - Original launch record.
 * @param options.runner - Frozen producer-runner bytes.
 * @param options.controlsRunner - Frozen controls-runner bytes.
 * @param options.route - Ordinary source or reviewed IR.
 * @param options.mode - Full or result-only API.
 * @param options.prefix - Absolute original receipt prefix.
 * @param options.revision - Frozen producer revision of this launch; the accepted producer by default.
 */
export const assertNominalPrimitiveSubtypeWitLaunch = ({ start, runner, controlsRunner, route, mode, prefix, revision = nominalPrimitiveSubtypeWitProducer }) => {
	assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
	assert.match(prefix, prefixPattern(route, mode, revision));
	assert.equal(start.revision, revision);
	const first = revision === nominalPrimitiveSubtypeWitFirstProducer;
	const controlsRunnerPath = first ? nominalPrimitiveSubtypeWitFirstControlsRunner : nominalPrimitiveSubtypeWitControlsRunner;
	assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.equal(start.runnerSha256, sha256(runner)); assert.equal(start.controlsRunnerSha256, sha256(controlsRunner));
	assert.deepEqual(start.links, nominalPrimitiveSubtypeWitWorktreeLinks);
	assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, [...wrapper, "--max-old-space-size=3072", "--test", "--test-concurrency=1", "tests/helpers/nominal-primitive-subtype-wit-installed-tests.mjs"]);
	assert.deepEqual(start.controlsArgs, [...wrapper, controlsRunnerPath, route, mode, prefix]);
	assert.deepEqual(start.environment, {
		NO_COLOR: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_WIT_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_WIT_ROUTES: route
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_WIT_MODES: mode
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_WIT_OUTPUT: prefix + "-records"
		, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, CC: nominalPrimitiveSubtypeWitTools.cc
		, LEAN_BRIDGE_WASM_TOOLS: nominalPrimitiveSubtypeWitTools.wasmTools
		, LEAN_BRIDGE_WASMTIME_C_API: nominalPrimitiveSubtypeWitTools.wasmtimeCapi
		, LEAN_NUM_THREADS: "1"
		, OMP_NUM_THREADS: "1"
		, MAKEFLAGS: "-j1"
		, CMAKE_BUILD_PARALLEL_LEVEL: "1"
	});
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048);
	const ceiling = first ? nominalPrimitiveSubtypeWitFirstLoadCeiling : nominalPrimitiveSubtypeWitLoadCeiling;
	assert.ok(start.initial.load >= 0 && start.initial.load < ceiling);
	if(first) assert.ok(!("loadCeiling" in start) && !("transition" in start) && !("guards" in start));
	else
	{
		// The versioned runner revision records its raised ceiling and the exact predecessor pair.
		assert.equal(start.loadCeiling, nominalPrimitiveSubtypeWitLoadCeiling);
		assert.deepEqual(start.guards, { initial: { freeMiB: 2048, availableMiB: 2048, load: nominalPrimitiveSubtypeWitLoadCeiling }, live: { freeMiB: 768, availableMiB: 768 } });
		assert.equal(start.transition.predecessorRevision, nominalPrimitiveSubtypeWitFirstProducer);
		assert.deepEqual(Object.keys(start.transition).sort(), ["changes", "predecessorRevision", "predecessorRunners", "unchanged"]);
		assert.deepEqual(Object.keys(start.transition.predecessorRunners).sort(), ["controlsRunner", "runner"]);
		assert.equal(start.transition.predecessorRunners.runner.path, nominalPrimitiveSubtypeWitFirstRunner);
		assert.equal(start.transition.predecessorRunners.controlsRunner.path, nominalPrimitiveSubtypeWitFirstControlsRunner);
		for(const item of Object.values(start.transition.predecessorRunners)) assert.match(item.sha256, /^[a-f0-9]{64}$/u);
		assert.deepEqual(start.transition.changes, ["producer revision 23aec60 -> 88cf601 (controls checker hotfix)", "initial load ceiling 6 -> 8"]);
	}
	assert.ok(Number.isFinite(Date.parse(start.started)));
};

const assertTerminal = (end, bytes, code, stopReason) => {
	assert.deepEqual([end.code, end.signal, end.stopReason], [code, null, stopReason]);
	assert.ok(end.error == null); assert.equal(end.tapSha256, sha256(bytes));
	assert.ok(Number.isFinite(Date.parse(end.finished)));
	assert.ok(Number.isInteger(end.minimum.freeMiB) && Number.isInteger(end.minimum.availableMiB));
	assert.ok(Number.isInteger(end.final.freeMiB) && Number.isInteger(end.final.availableMiB));
	assert.ok(Number.isFinite(end.final.load) && end.final.load >= 0);
};

/**
 * Require one successful installed producer launch.
 *
 * @param options - Original start/end/TAP records and independent launch identity.
 */
export const assertNominalPrimitiveSubtypeWitRun = options => {
	const { start, end, tap, route, mode } = options;
	assertNominalPrimitiveSubtypeWitLaunch(options); assertTerminal(end, tap, 0, null);
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.ok(Date.parse(end.finished) > Date.parse(start.started));
	assertNominalPrimitiveSubtypeWitCiTap(tap.toString(), route, mode);
};

const assertResources = value => {
	assert.ok(Number.isInteger(value.waits) && value.waits >= 0 && value.waits <= 20);
	assert.equal(value.observations.length, value.waits + 1);
	for(const sample of value.observations)
	{
		assert.ok(sample.freeBytes >= 2 * 1024 ** 3 && sample.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
	}
	assert.ok(value.observations.at(-1).load < nominalPrimitiveSubtypeWitLoadCeiling);
};

/**
 * Require the independent control phase against unchanged original records.
 *
 * @param options - Producer, controls and expected independently recomputed counts.
 * @param options.start - Validated producer launch record.
 * @param options.end - Validated producer terminal record.
 * @param options.controlsStart - Independent controls launch record.
 * @param options.controls - Independent controls result.
 * @param options.controlsEnd - Outer controls terminal record.
 * @param options.log - Complete controls output.
 * @param options.route - Ordinary source or reviewed IR.
 * @param options.mode - Full or result-only API.
 * @param options.prefix - Absolute original receipt prefix.
 * @param options.expected - Independently recomputed counts.
 */
export const assertNominalPrimitiveSubtypeWitControlsRun = ({ start, end, controlsStart, controls, controlsEnd, log, route, mode, prefix, expected }) => {
	const runners = { [nominalPrimitiveSubtypeWitRunner]: start.runnerSha256, [nominalPrimitiveSubtypeWitControlsRunner]: start.controlsRunnerSha256 };
	for(const record of [controlsStart, controls])
	{
		assert.equal(record.head, nominalPrimitiveSubtypeWitProducer); assert.equal(record.route, route); assert.equal(record.mode, mode);
		assert.equal(record.prefix, prefix); assert.equal(record.sourceRoot, prefix + "-records"); assert.equal(record.compiledAgain, false);
		assert.deepEqual(record.runners, runners); assert.deepEqual(record.links, nominalPrimitiveSubtypeWitWorktreeLinks);
	}
	assert.deepEqual(Object.keys(controlsStart.sources).sort(), [nominalPrimitiveSubtypeWitRunner, nominalPrimitiveSubtypeWitControlsRunner, ...nominalPrimitiveSubtypeWitControlSources].sort());
	for(const [path, digest] of Object.entries(runners)) assert.equal(controlsStart.sources[path], digest, path);
	assert.ok(Object.keys(controlsStart.originals).length > 0);
	for(const digest of [...Object.values(controlsStart.sources), ...Object.values(controlsStart.originals)]) assert.match(digest, /^[a-f0-9]{64}$/u);
	assertResources(controlsStart.resources);
	assert.equal(controls.originalsUnchanged, Object.keys(controlsStart.originals).length);
	assert.equal(controls.sourcesUnchanged, Object.keys(controlsStart.sources).length);
	assert.equal(controls.installedAcceptance, true); assert.equal(controls.compiledAgain, false);
	assert.deepEqual(controls.checked, expected);
	assertTerminal(controlsEnd, log, 0, null);
	assert.ok(controlsEnd.minimum.freeMiB >= 768 && controlsEnd.minimum.availableMiB >= 768);
	assert.ok(Date.parse(end.finished) <= Date.parse(controlsStart.started));
	assert.ok(Date.parse(controlsStart.started) <= Date.parse(controls.finished));
	assert.ok(Date.parse(controls.finished) <= Date.parse(controlsEnd.finished));
};

/**
 * Require the honest first launch: a passing producer whose controls phase stopped on a checker defect.
 *
 * @param options - Preserved start/end/TAP records, controls terminal record and launch identity.
 */
export const assertNominalPrimitiveSubtypeWitPreservedLaunch = options => {
	const { start, end, tap, controlsEnd, log, route, mode } = options;
	assertNominalPrimitiveSubtypeWitLaunch({ ...options, revision: nominalPrimitiveSubtypeWitFirstProducer }); assertTerminal(end, tap, 0, null);
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.ok(Date.parse(end.finished) > Date.parse(start.started));
	assertNominalPrimitiveSubtypeWitCiTap(tap.toString(), route, mode);
	assertTerminal(controlsEnd, log, 1, null);
	assert.match(log.toString(), /TypeError: Cannot read properties of undefined \(reading 'result'\)/u);
	assert.ok(Date.parse(end.finished) <= Date.parse(controlsEnd.finished));
};
