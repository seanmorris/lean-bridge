/**
 * Validate serial primitive-base nominal CPAN producer and control invocations from their receipts.
 * Each accepted selection names its own frozen source revision and runner pair; the per-run load
 * ceiling is recorded explicitly and never widens the hosted default of six.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const nominalPrimitiveSubtypePerlSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nominalPrimitiveSubtypePerlWorktreeLinks = Object.freeze({ ".toolchains": "/app/.toolchains", node_modules: "/app/node_modules" });
export const nominalPrimitiveSubtypePerlControlSources = Object.freeze([
	"tests/fixtures/nominal-primitive-subtype-consumers/perl.pl"
	, "tests/helpers/closed-package-tar.mjs"
	, ...["fixture", "install", "installed-tests", "model-records", "package-records", "handoff", "report", "controls", "ci-report"]
		.map(name => `tests/helpers/nominal-primitive-subtype-perl-${name}.mjs`)
	, "tests/helpers/nominal-subtype-perl-generators.mjs"
	, "tests/helpers/checked-record-perl-install.mjs"
]);
const runnerRoot = "/app/build/run-vo1493-nominal-primitive-perl-";

/**
 * The three frozen runner pairs that produced accepted or preserved receipts, by producer revision and ceiling.
 * The first pair predates the bounded per-run ceiling, so its receipts carry no guards record.
 */
export const nominalPrimitiveSubtypePerlRunnerVariants = Object.freeze([
	{ producerCommit: "acc614cd17981972b3f12307a94b0eef4a957fc5"
		, loadCeiling: 6, explicitCeiling: false
		, worktree: "/app/build/worktrees/nominal-subtype-perl-vo1493"
		, producer: runnerRoot + "acc614c.mjs"
		, controls: runnerRoot + "controls-acc614c.mjs" }
	, { producerCommit: "e15acb534151d359b05b68364ab35e6ab6c77073"
		, loadCeiling: 8, explicitCeiling: true
		, worktree: "/app/build/worktrees/nominal-subtype-perl-vo1493-load8"
		, producer: runnerRoot + "e15acb5.mjs"
		, controls: runnerRoot + "controls-e15acb5.mjs" }
	, { producerCommit: "e15acb534151d359b05b68364ab35e6ab6c77073"
		, loadCeiling: 12, explicitCeiling: true
		, worktree: "/app/build/worktrees/nominal-subtype-perl-vo1493-load8"
		, producer: runnerRoot + "e15acb5-load12.mjs"
		, controls: runnerRoot + "controls-e15acb5-load12.mjs" }
]);

/**
 * Select the one runner pair that matches a producer revision and recorded load ceiling.
 *
 * @param producerCommit - Full frozen Git revision.
 * @param loadCeiling - Exclusive one-minute host-load ceiling the run was admitted under.
 */
export const nominalPrimitiveSubtypePerlRunnerVariant = (producerCommit, loadCeiling) => {
	const matches = nominalPrimitiveSubtypePerlRunnerVariants.filter(item => item.producerCommit === producerCommit && item.loadCeiling === loadCeiling);
	assert.equal(matches.length, 1, `unknown runner pair for ${producerCommit} at ceiling ${loadCeiling}`);
	return matches[0];
};

const wrapper = ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3", "/usr/bin/node"];
const prefixPattern = (route, mode, producerCommit) => new RegExp(`^/app/build/vo1493-nominal-primitive-perl-${route}-${mode}-r[1-9][0-9]*-${producerCommit.slice(0, 7)}$`, "u");

/**
 * Require the exact gates, environment, wrapper and resource floors of one producer launch, whatever its outcome.
 *
 * @param options - Original launch record and independently selected identity.
 * @param options.start - Original process launch record.
 * @param options.runner - Exact producer runner source bytes.
 * @param options.controlsRunner - Exact controls runner source bytes.
 * @param options.route - Independently selected author route.
 * @param options.mode - Independently selected API mode.
 * @param options.prefix - Original task-specific recording prefix.
 * @param options.producerCommit - Full frozen Git revision.
 * @param options.floor - Explicit package glibc floor.
 * @param options.variant - Runner pair the launch must have used.
 */
export const assertNominalPrimitiveSubtypePerlLaunch = ({ start, runner, controlsRunner, route, mode, prefix, producerCommit, floor, variant }) => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.match(prefix, prefixPattern(route, mode, producerCommit));
	assert.equal(variant.producerCommit, producerCommit);
	assert.equal(start.revision, producerCommit); assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.equal(start.runnerSha256, sha256(runner)); assert.equal(start.controlsRunnerSha256, sha256(controlsRunner));
	assert.deepEqual(start.links, nominalPrimitiveSubtypePerlWorktreeLinks);
	assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, [...wrapper, "--test", "--test-concurrency=1", "tests/helpers/nominal-primitive-subtype-perl-installed-tests.mjs"]);
	assert.deepEqual(start.controlsArgs, [...wrapper, variant.controls, route, mode, prefix]);
	const environment = {
		NO_COLOR: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_ROUTES: route
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_MODES: mode
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_OUTPUT: prefix + "-records"
		, ...variant.explicitCeiling ? { LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_MAX_LOAD: String(variant.loadCeiling) } : {}
		, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: floor
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	};
	assert.deepEqual(start.environment, environment);
	if(variant.explicitCeiling) assert.deepEqual(start.guards, { initial: { freeMiB: 2048, availableMiB: 2048, load: variant.loadCeiling }, live: { freeMiB: 768, availableMiB: 768 } });
	else assert.equal(start.guards, undefined);
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048 && start.initial.load < variant.loadCeiling);
	assert.ok(Number.isFinite(Date.parse(start.started)));
};

/**
 * Require a terminal producer record that the outer runner never stopped on its live floors.
 *
 * @param end - Original terminal record.
 * @param tap - Complete original combined TAP output.
 * @param code - Expected process exit code.
 */
const assertTerminal = (end, tap, code) => {
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.stopReason], [code, null, null]); assert.ok(end.error == null);
	assert.equal(end.tapSha256, sha256(tap)); assert.ok(Number.isFinite(Date.parse(end.finished)));
};

/**
 * Require exact route/mode gates, admitted scheduling and completed green execution.
 *
 * @param options - Original runner records and independently selected identity.
 * @param options.start - Original process launch record.
 * @param options.end - Original terminal record.
 * @param options.tap - Complete original combined TAP output.
 * @param options.route - Independently selected author route.
 * @param options.mode - Independently selected API mode.
 */
export const assertNominalPrimitiveSubtypePerlRun = options => {
	const { start, end, tap, route, mode } = options;
	assertNominalPrimitiveSubtypePerlLaunch(options);
	assertTerminal(end, tap, 0);
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.ok(tap.toString().includes(`ok 1 - installed primitive-base nominal Perl packages reproduce and relocate ${route} ${mode}\n`));
	assert.doesNotMatch(tap.toString(), /^not ok |# SKIP|# TODO/gmu);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
};

/**
 * Require a preserved non-accepted launch to carry its honest terminal outcome.
 *
 * @param options - Original runner records, identity and the recorded classification.
 * @param options.end - Original terminal record.
 * @param options.tap - Complete original combined TAP output.
 * @param options.code - Recorded process exit code.
 * @param options.reason - Exact producer assertion message, or null for a green run that is not counted.
 * @param options.route - Independently selected author route.
 * @param options.mode - Independently selected API mode.
 */
export const assertNominalPrimitiveSubtypePerlPreservedLaunch = options => {
	const { end, tap, code, reason, route, mode } = options;
	assertNominalPrimitiveSubtypePerlLaunch(options);
	assertTerminal(end, tap, code);
	const text = tap.toString();
	if(reason === null)
	{
		assert.equal(code, 0);
		assert.ok(text.includes(`ok 1 - installed primitive-base nominal Perl packages reproduce and relocate ${route} ${mode}\n`));
	}
	else
	{
		assert.equal(code, 1);
		assert.ok(text.includes(`not ok 1 - installed primitive-base nominal Perl packages reproduce and relocate ${route} ${mode}\n`));
		assert.ok(text.includes(`  error: '${reason}'\n`), reason);
		assert.match(text, /# pass 0\n# fail 1\n/u);
	}
};

/**
 * Require the bounded resource wait to have ended under the recorded ceiling with both floors intact.
 *
 * @param value - Recorded resource observations.
 * @param loadCeiling - Exclusive one-minute host-load ceiling.
 */
const assertResources = (value, loadCeiling) => {
	assert.ok(Number.isInteger(value.waits) && value.waits >= 0 && value.waits <= 20);
	assert.equal(value.observations.length, value.waits + 1);
	for(const sample of value.observations)
	{
		assert.ok(sample.freeBytes >= 2 * 1024 ** 3 && sample.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
	}
	assert.ok(value.observations.at(-1).load < loadCeiling);
};

/**
 * Require the controls phase to have run against the unchanged original records after the producer.
 *
 * @param options - Original controls records and the already validated producer records.
 * @param options.start - Original producer launch record.
 * @param options.end - Original producer terminal record.
 * @param options.controlsStart - Original controls launch record.
 * @param options.controls - Original controls report.
 * @param options.controlsEnd - Original controls terminal record from the outer runner.
 * @param options.log - Complete original controls log.
 * @param options.route - Independently selected author route.
 * @param options.mode - Independently selected API mode.
 * @param options.prefix - Original task-specific recording prefix.
 * @param options.producerCommit - Full frozen Git revision.
 * @param options.variant - Runner pair the launch used.
 * @param options.expected - Independently computed control counts and executions.
 */
export const assertNominalPrimitiveSubtypePerlControlsRun = ({ start, end, controlsStart, controls, controlsEnd, log, route, mode, prefix, producerCommit, variant, expected }) => {
	const runners = { [variant.producer]: start.runnerSha256, [variant.controls]: start.controlsRunnerSha256 };
	for(const record of [controlsStart, controls])
	{
		assert.equal(record.head, producerCommit); assert.equal(record.route, route); assert.equal(record.mode, mode);
		assert.equal(record.prefix, prefix); assert.equal(record.sourceRoot, prefix + "-records"); assert.equal(record.compiledAgain, false);
		assert.deepEqual(record.runners, runners); assert.deepEqual(record.links, nominalPrimitiveSubtypePerlWorktreeLinks);
	}
	assert.deepEqual(Object.keys(controlsStart.sources).sort(), [variant.producer, variant.controls, ...nominalPrimitiveSubtypePerlControlSources].sort());
	for(const [path, digest] of Object.entries(runners)) assert.equal(controlsStart.sources[path], digest, path);
	assert.ok(Object.keys(controlsStart.originals).length > 0);
	for(const digest of [...Object.values(controlsStart.sources), ...Object.values(controlsStart.originals)]) assert.match(digest, /^[a-f0-9]{64}$/u);
	assertResources(controlsStart.resources, variant.loadCeiling);
	assert.equal(controls.originalsUnchanged, Object.keys(controlsStart.originals).length);
	assert.equal(controls.sourcesUnchanged, Object.keys(controlsStart.sources).length);
	assert.equal(controls.installedAcceptance, true);
	for(const [key, value] of Object.entries(expected)) assert.equal(controls.checked[key], value, key);
	assert.deepEqual([controlsEnd.code, controlsEnd.signal, controlsEnd.stopReason], [0, null, null]); assert.ok(controlsEnd.error == null);
	assert.ok(controlsEnd.minimum.freeMiB >= 768 && controlsEnd.minimum.availableMiB >= 768);
	assert.equal(controlsEnd.tapSha256, sha256(log));
	assert.ok(Date.parse(end.finished) <= Date.parse(controlsStart.started) && Date.parse(controlsStart.started) <= Date.parse(controls.finished)
		&& Date.parse(controls.finished) <= Date.parse(controlsEnd.finished));
};
