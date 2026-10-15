/**
 * Validate the frozen local runner receipts for primitive-base nominal Ruby acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertNominalPrimitiveSubtypeRubyCiTap } from "./nominal-primitive-subtype-ruby-ci-report.mjs";

export const nominalPrimitiveSubtypeRubyProducer = "aaadc4fc84dc7d31ff134013b61bf1c789bfb5bb";
export const nominalPrimitiveSubtypeRubyLoadCeiling = 8;
export const nominalPrimitiveSubtypeRubySelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nominalPrimitiveSubtypeRubyAcceptedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r2" }
	, { route: "ordinary", mode: "result-only", attempt: "r1" }
	, { route: "reviewed", mode: "full", attempt: "r1" }
	, { route: "reviewed", mode: "result-only", attempt: "r1" }
]);
export const nominalPrimitiveSubtypeRubyPreservedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r1", code: 1, stopReason: "disk-floor" }
]);
export const nominalPrimitiveSubtypeRubyWorktree = "/app/build/worktrees/nominal-subtype-ruby-vo1492-load8";
export const nominalPrimitiveSubtypeRubyWorktreeLinks = Object.freeze({ ".toolchains": "/app/.toolchains", node_modules: "/app/node_modules" });
export const nominalPrimitiveSubtypeRubyRunner = "/app/build/run-vo1492-nominal-primitive-ruby-aaadc4f.mjs";
export const nominalPrimitiveSubtypeRubyControlsRunner = "/app/build/run-vo1492-nominal-primitive-ruby-controls-aaadc4f.mjs";
export const nominalPrimitiveSubtypeRubyControlSources = Object.freeze([
	"tests/fixtures/nominal-primitive-subtype-consumers/ruby.rb"
	, "tests/helpers/fin-container-edge-ruby-closure.mjs"
	, ...["archive", "ci-report", "controls", "environment-records", "fixture", "installed-tests", "model-records", "package-records", "package", "report"]
		.map(name => `tests/helpers/nominal-primitive-subtype-ruby-${name}.mjs`)
	, "tests/helpers/nominal-primitive-subtype-ruby-model.rb"
	, "tests/helpers/nominal-subtype-ruby-generators.mjs"
]);

const wrapper = ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3", "/usr/bin/node"];
const prefixPattern = (route, mode) => new RegExp(`^/app/build/vo1492-nominal-primitive-ruby-${route}-${mode}-r[1-9][0-9]*-aaadc4f$`, "u");

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
 */
export const assertNominalPrimitiveSubtypeRubyLaunch = ({ start, runner, controlsRunner, route, mode, prefix }) => {
	assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
	assert.match(prefix, prefixPattern(route, mode));
	assert.equal(start.revision, nominalPrimitiveSubtypeRubyProducer);
	assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.equal(start.runnerSha256, sha256(runner)); assert.equal(start.controlsRunnerSha256, sha256(controlsRunner));
	assert.deepEqual(start.links, nominalPrimitiveSubtypeRubyWorktreeLinks);
	assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, [...wrapper, "--test", "--test-concurrency=1", "tests/helpers/nominal-primitive-subtype-ruby-installed-tests.mjs"]);
	assert.deepEqual(start.controlsArgs, [...wrapper, nominalPrimitiveSubtypeRubyControlsRunner, route, mode, prefix]);
	assert.deepEqual(start.environment, {
		NO_COLOR: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_ROUTES: route
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_MODES: mode
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_OUTPUT: prefix + "-records"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_MAX_LOAD: String(nominalPrimitiveSubtypeRubyLoadCeiling)
		, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_RUBY: "/app/.toolchains/ruby33/bin/ruby"
		, LEAN_BRIDGE_GEM: "/app/.toolchains/ruby33/bin/gem"
		, LEAN_NUM_THREADS: "1"
		, OMP_NUM_THREADS: "1"
		, MAKEFLAGS: "-j1"
		, CMAKE_BUILD_PARALLEL_LEVEL: "1"
	});
	assert.deepEqual(start.guards, { initial: { freeMiB: 2048, availableMiB: 2048, load: nominalPrimitiveSubtypeRubyLoadCeiling }
		, live: { freeMiB: 768, availableMiB: 768 } });
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048);
	assert.ok(start.initial.load >= 0 && start.initial.load < nominalPrimitiveSubtypeRubyLoadCeiling);
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
export const assertNominalPrimitiveSubtypeRubyRun = options => {
	const { start, end, tap, route, mode } = options;
	assertNominalPrimitiveSubtypeRubyLaunch(options); assertTerminal(end, tap, 0, null);
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.ok(Date.parse(end.finished) > Date.parse(start.started));
	assertNominalPrimitiveSubtypeRubyCiTap(tap.toString(), route, mode);
};

const assertResources = value => {
	assert.ok(Number.isInteger(value.waits) && value.waits >= 0 && value.waits <= 20);
	assert.equal(value.observations.length, value.waits + 1);
	for(const sample of value.observations)
	{
		assert.ok(sample.freeBytes >= 2 * 1024 ** 3 && sample.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
	}
	assert.ok(value.observations.at(-1).load < nominalPrimitiveSubtypeRubyLoadCeiling);
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
export const assertNominalPrimitiveSubtypeRubyControlsRun = ({ start, end, controlsStart, controls, controlsEnd, log, route, mode, prefix, expected }) => {
	const runners = { [nominalPrimitiveSubtypeRubyRunner]: start.runnerSha256, [nominalPrimitiveSubtypeRubyControlsRunner]: start.controlsRunnerSha256 };
	for(const record of [controlsStart, controls])
	{
		assert.equal(record.head, nominalPrimitiveSubtypeRubyProducer); assert.equal(record.route, route); assert.equal(record.mode, mode);
		assert.equal(record.prefix, prefix); assert.equal(record.sourceRoot, prefix + "-records"); assert.equal(record.compiledAgain, false);
		assert.deepEqual(record.runners, runners); assert.deepEqual(record.links, nominalPrimitiveSubtypeRubyWorktreeLinks);
	}
	assert.deepEqual(Object.keys(controlsStart.sources).sort(), [nominalPrimitiveSubtypeRubyRunner, nominalPrimitiveSubtypeRubyControlsRunner, ...nominalPrimitiveSubtypeRubyControlSources].sort());
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
 * Require the honest disk-floor failure that preceded the accepted ordinary/full retry.
 *
 * @param options - Preserved start/end/TAP records and launch identity.
 */
export const assertNominalPrimitiveSubtypeRubyPreservedLaunch = options => {
	const { start, end, tap } = options;
	assertNominalPrimitiveSubtypeRubyLaunch(options); assertTerminal(end, tap, 1, "disk-floor");
	assert.equal(tap.toString(), "TAP version 13\n");
	assert.ok(end.minimum.freeMiB < 768); assert.ok(end.minimum.availableMiB >= 768);
	assert.ok(Date.parse(end.finished) > Date.parse(start.started));
};
