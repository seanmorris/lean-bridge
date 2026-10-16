/**
 * Validate the frozen local runner receipts for nineteen-base nominal JVM acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertNominalPrimitiveSubtypeJvmCiTap } from "./nominal-primitive-subtype-jvm-ci-report.mjs";

export const nominalPrimitiveSubtypeJvmProducer = "e0fed7f5f86d8c254a1064fc9eb1ad2e1b39ea0e";
/** Selected harness admission ceiling recorded in every accepted report; the first launch used the default 6. */
export const nominalPrimitiveSubtypeJvmLoadCeiling = 8;
export const nominalPrimitiveSubtypeJvmSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
const firstProducer = "88cf60117f2ea3bcef0213755c69a2e5d025f425";
/**
 * Every runner revision that launched a retained selection, oldest first.
 * The accepted launches all use the newest revision.
 */
export const nominalPrimitiveSubtypeJvmRunnerRevisions = Object.freeze({
	"88cf601": Object.freeze({ producer: firstProducer, suffix: "88cf601", predecessor: null, maxLoad: null })
	, "e0fed7f-v1": Object.freeze({ producer: nominalPrimitiveSubtypeJvmProducer, suffix: "e0fed7f", predecessor: "88cf601", maxLoad: "8" })
	, "e0fed7f-v2": Object.freeze({ producer: nominalPrimitiveSubtypeJvmProducer, suffix: "e0fed7f-v2", predecessor: "e0fed7f-v1", maxLoad: "8" })
});
export const nominalPrimitiveSubtypeJvmAcceptedRevision = "e0fed7f-v2";
export const nominalPrimitiveSubtypeJvmAcceptedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r2" }
	, { route: "ordinary", mode: "result-only", attempt: "r1" }
	, { route: "reviewed", mode: "full", attempt: "r1" }
	, { route: "reviewed", mode: "result-only", attempt: "r1" }
]);
/** Both uncounted launches of the ordinary full selection, in launch order. */
export const nominalPrimitiveSubtypeJvmPreservedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r1", runnerRevision: "88cf601", revision: firstProducer, producerCode: 1, controlsCode: null }
	, { route: "ordinary", mode: "full", attempt: "r1", runnerRevision: "e0fed7f-v1", revision: nominalPrimitiveSubtypeJvmProducer, producerCode: 0, controlsCode: 1 }
]);
const short = revision => revision.slice(0, 7);
/**
 * Producer and controls runner paths of one runner revision.
 *
 * @param key - Runner revision key.
 */
export const nominalPrimitiveSubtypeJvmRunnerPaths = key => {
	const revision = nominalPrimitiveSubtypeJvmRunnerRevisions[key]; assert.ok(revision, key);
	return { runner: `/app/build/run-vo1495-nominal-primitive-jvm-${revision.suffix}.mjs`
		, controlsRunner: `/app/build/run-vo1495-nominal-primitive-jvm-controls-${revision.suffix}.mjs` };
};
/**
 * Detached run worktree of one producer revision.
 *
 * @param revision - Full producer commit.
 */
export const nominalPrimitiveSubtypeJvmWorktreeOf = revision => `/app/build/worktrees/nominal-primitive-jvm-run-${short(revision)}`;
export const nominalPrimitiveSubtypeJvmWorktreeLinks = Object.freeze({ node_modules: "/app/node_modules" });
export const nominalPrimitiveSubtypeJvmTools = Object.freeze({
	java: "/app/.toolchains/jdk22/bin/java"
	, javac: "/app/.toolchains/jdk22/bin/javac"
	, kotlinc: "/app/.toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc"
	, maven: "/app/.toolchains/apache-maven-3.9.11/bin/mvn"
});
export const nominalPrimitiveSubtypeJvmControlSources = Object.freeze([
	...["java.java", "kotlin.kt", "model.java"].map(name => `tests/fixtures/nominal-primitive-subtype-consumers/${name}`)
	, ...["fixture", "package", "probe", "installed-tests", "model-records", "package-records", "consumer-records", "report", "controls", "ci-report", "ci-handoff"]
		.map(name => `tests/helpers/nominal-primitive-subtype-jvm-${name}.mjs`)
	, "tests/helpers/nominal-subtype-jvm-ci-tools.mjs"
	, "tests/helpers/fin-container-edge-jvm-closure.mjs"
]);

const wrapper = ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3", "/usr/bin/node"];
const prefixPattern = (route, mode, revision) => new RegExp(`^/app/build/vo1495-nominal-primitive-jvm-${route}-${mode}-r[1-9][0-9]*-${short(revision)}$`, "u");
const environmentOf = (route, mode, prefix, maxLoad) => ({
	NO_COLOR: "1"
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST: "1"
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_ROUTES: route
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MODES: mode
	, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_OUTPUT: prefix + "-records"
	, ...maxLoad === null ? {} : { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MAX_LOAD: maxLoad }
	, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
	, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
	, LEAN_BRIDGE_JAVA: nominalPrimitiveSubtypeJvmTools.java
	, LEAN_BRIDGE_JAVAC: nominalPrimitiveSubtypeJvmTools.javac
	, LEAN_BRIDGE_KOTLINC: nominalPrimitiveSubtypeJvmTools.kotlinc
	, LEAN_BRIDGE_MAVEN: nominalPrimitiveSubtypeJvmTools.maven
	, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	, CMAKE_BUILD_PARALLEL_LEVEL: "1"
});

/**
 * Require the exact frozen worktree, wrapper, environment, runner transition and admission policy of one launch.
 *
 * @param options - Original launch receipt and archived runner bytes.
 * @param options.start - Original launch record.
 * @param options.runners - Archived runner bytes keyed by absolute runner path.
 * @param options.route - Ordinary source or reviewed IR.
 * @param options.mode - Full or result-only API.
 * @param options.prefix - Absolute original receipt prefix.
 * @param options.runnerRevision - Runner revision key; the accepted revision by default.
 */
export const assertNominalPrimitiveSubtypeJvmLaunch = ({ start, runners, route, mode, prefix, runnerRevision = nominalPrimitiveSubtypeJvmAcceptedRevision }) => {
	assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
	const revision = nominalPrimitiveSubtypeJvmRunnerRevisions[runnerRevision]; assert.ok(revision, runnerRevision);
	const paths = nominalPrimitiveSubtypeJvmRunnerPaths(runnerRevision);
	assert.match(prefix, prefixPattern(route, mode, revision.producer));
	assert.equal(start.revision, revision.producer); assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.equal(start.runnerSha256, sha256(runners.get(paths.runner)));
	assert.equal(start.controlsRunnerSha256, sha256(runners.get(paths.controlsRunner)));
	assert.deepEqual(start.links, nominalPrimitiveSubtypeJvmWorktreeLinks);
	assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, [...wrapper, "--max-old-space-size=3072", "--test", "--test-concurrency=1", "tests/helpers/nominal-primitive-subtype-jvm-installed-tests.mjs"]);
	assert.deepEqual(start.controlsArgs, [...wrapper, paths.controlsRunner, route, mode, prefix]);
	assert.deepEqual(start.environment, environmentOf(route, mode, prefix, revision.maxLoad));
	assert.equal(start.loadCeiling, 8);
	assert.deepEqual(start.guards, { initial: { freeMiB: 2048, availableMiB: 2048, load: 8 }, live: { freeMiB: 768, availableMiB: 768 } });
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048);
	assert.ok(start.initial.load >= 0 && start.initial.load < 8);
	if(revision.predecessor === null) assert.equal(start.transition.predecessorRevision, null);
	else
	{
		const previous = nominalPrimitiveSubtypeJvmRunnerRevisions[revision.predecessor];
		const previousPaths = nominalPrimitiveSubtypeJvmRunnerPaths(revision.predecessor);
		assert.equal(start.transition.predecessorRevision, previous.producer);
		assert.deepEqual(start.transition.predecessorRunners, {
			runner: { path: previousPaths.runner, sha256: sha256(runners.get(previousPaths.runner)) }
			, controlsRunner: { path: previousPaths.controlsRunner, sha256: sha256(runners.get(previousPaths.controlsRunner)) }
		});
	}
	assert.ok(Array.isArray(start.transition.changes) && start.transition.changes.length > 0);
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
export const assertNominalPrimitiveSubtypeJvmRun = options => {
	const { start, end, tap, route, mode } = options;
	assertNominalPrimitiveSubtypeJvmLaunch(options); assertTerminal(end, tap, 0, null);
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.ok(Date.parse(end.finished) > Date.parse(start.started));
	assertNominalPrimitiveSubtypeJvmCiTap(tap.toString(), route, mode);
};

const assertResources = value => {
	assert.ok(Number.isInteger(value.waits) && value.waits >= 0 && value.waits <= 20);
	assert.equal(value.observations.length, value.waits + 1);
	for(const sample of value.observations)
	{
		assert.ok(sample.freeBytes >= 2 * 1024 ** 3 && sample.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
	}
	assert.ok(value.observations.at(-1).load < nominalPrimitiveSubtypeJvmLoadCeiling);
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
 * @param options.expected - Independently recomputed checked result.
 */
export const assertNominalPrimitiveSubtypeJvmControlsRun = ({ start, end, controlsStart, controls, controlsEnd, log, route, mode, prefix, expected }) => {
	const paths = nominalPrimitiveSubtypeJvmRunnerPaths(nominalPrimitiveSubtypeJvmAcceptedRevision);
	const runners = { [paths.runner]: start.runnerSha256, [paths.controlsRunner]: start.controlsRunnerSha256 };
	for(const record of [controlsStart, controls])
	{
		assert.equal(record.head, nominalPrimitiveSubtypeJvmProducer); assert.equal(record.route, route); assert.equal(record.mode, mode);
		assert.equal(record.prefix, prefix); assert.equal(record.sourceRoot, prefix + "-records"); assert.equal(record.compiledAgain, false);
		assert.deepEqual(record.runners, runners); assert.deepEqual(record.links, nominalPrimitiveSubtypeJvmWorktreeLinks);
	}
	assert.deepEqual(Object.keys(controlsStart.sources).sort(), [paths.runner, paths.controlsRunner, ...nominalPrimitiveSubtypeJvmControlSources].sort());
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
 * Require one honest uncounted launch: either the first commit's default harness load guard refused before
 * any author build, or the first e0fed7f controls runner stopped on its absent dispatchObserved assertion.
 *
 * @param options - Preserved records, runner bytes and the preserved launch descriptor.
 */
export const assertNominalPrimitiveSubtypeJvmPreservedLaunch = options => {
	const { start, end, tap, route, mode, launch, controlsEnd, log } = options;
	assertNominalPrimitiveSubtypeJvmLaunch({ ...options, runnerRevision: launch.runnerRevision });
	assert.ok(Date.parse(end.finished) > Date.parse(start.started));
	const text = tap.toString(), name = `installed primitive-base nominal JVM packages reproduce and relocate ${route} ${mode}`;
	assert.ok(text.startsWith("TAP version 13\n"));
	if(launch.runnerRevision === "88cf601")
	{
		assertTerminal(end, tap, 1, null); assert.equal(launch.producerCode, 1); assert.equal(launch.controlsCode, null);
		assert.ok(text.includes(`not ok 1 - ${name}\n`));
		assert.match(text, /host load remained at or above 6 for five minutes/u);
		assert.match(text, /\n# pass 0\n# fail 1\n/u);
		assert.doesNotMatch(text, /author 0: reproducible Maven package/u);
		assert.equal(controlsEnd, undefined);
		return;
	}
	assert.equal(launch.runnerRevision, "e0fed7f-v1"); assert.equal(launch.producerCode, 0); assert.equal(launch.controlsCode, 1);
	assertTerminal(end, tap, 0, null); assertNominalPrimitiveSubtypeJvmCiTap(text, route, mode);
	assertTerminal(controlsEnd, log, 1, null);
	assert.match(log.toString(), /run-vo1495-nominal-primitive-jvm-controls-e0fed7f\.mjs:67:8/u);
	assert.match(log.toString(), /\+ undefined\n- false/u);
	assert.ok(Date.parse(end.finished) <= Date.parse(controlsEnd.finished));
};
