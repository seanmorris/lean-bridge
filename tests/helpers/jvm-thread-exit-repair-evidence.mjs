/**
 * Bind the JVM test-order repair to actual executions and a failing mutant.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedJvmEnforced, ownedJvmStep, ownedJvmUpload } from "./owned-jvm-job.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { moduleAtProducer } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const jvmThreadExitRepairCommands = {
	gated: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-jvm-thread-exit.test.mjs"
	, signatures: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-name-pattern='owned JVM calls and callbacks signatures' tests/owned-jvm-calls.test.mjs"
};
export const jvmThreadExitRepairScope = {
	compiledLean: true, ordinaryAndReviewed: true, javaAndKotlin: true
	, deterministicGate: true, removeWaitMutation: true, testOnly: true
	, productionGeneratedBytesUnchanged: true, installedPackage: false
	, promotedCells: 0
};
const normalCounts = {
	javaChecks: 651, kotlinChecks: 192, managedFailures: 255, nativeFailures: 121
	, live: 0, identities: 0, threadExits: 1, threadExitErrors: 0
};
const producerCommit = "ff05f25488e70838b8bfa0088b10517a60f79035";
const producerPromise = Promise.all([
	"src/backends/jvm/owned-calls.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-thread-exit.mjs"
	, "tests/helpers/jvm-thread-exit-repair-evidence.mjs"
].map(path => moduleAtProducer(producerCommit, path))).then(modules =>
	Object.assign({}, ...modules));
const historical = path => bytesAtProducer(producerCommit, path);

/**
 * Require an enabled test, retained reports and an enforced owned JVM job.
 *
 * @param workflow - Complete consumer-matrix workflow text.
 */
export const assertJvmThreadExitCi = workflow => {
	const step = ownedJvmStep(workflow);
	assert.ok(step?.includes("          " + jvmThreadExitRepairCommands.gated + "\n"));
	for(const mode of ["ordinary", "reviewed"])
		assert.ok(step.includes(`          test -s build/owned-jvm-thread-exit/${mode}.json\n`));
	const upload = ownedJvmUpload(workflow);
	assert.ok(upload?.includes("            build/owned-jvm-thread-exit/\n"));
	// A failure fails the owned job, and the published summary requires that job to succeed.
	assertOwnedJvmEnforced(workflow);
	const route = workflow.split('if [ "$consumer" = jvm ]; then\n')[1]?.split('if [ "$consumer" = ruby ]; then\n')[0];
	assert.ok(!route?.includes(jvmThreadExitRepairCommands.gated));
};

/**
 * Regenerate the observed probes, including the exact missing-wait mutation.
 *
 * @param record - New source-bound repair receipt.
 */
export const assertJvmThreadExitExecution = async record => {
	const producer = await producerPromise;
	for(const name of [
		"assertJvmThreadExitCi", "generateOwnedJvmCalls"
		, "ownedJvmCallNative", "ownedJvmCallProbeMethods"
		, "ownedJvmThreadExitGuard", "ownedJvmThreadExitSources"
		, "withoutOwnedJvmThreadExitWait"
	]) assert.equal(typeof producer[name], "function", name);
	assert.deepEqual(record.scope, jvmThreadExitRepairScope);
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(Object.keys(record.runs).sort(), ["gated", "signatures"]);
	assert.deepEqual(Object.keys(record.reports).sort(), ["gated", "signatures"]);
	const [template, exercise, kotlin, lean] = await Promise.all([
		"tests/fixtures/structured-types/owned-jvm-calls.java"
		, "tests/fixtures/structured-types/owned-jvm-callback-signatures.java"
		, "tests/fixtures/structured-types/owned-kotlin-callback-signatures.kt"
		, "tests/fixtures/onboarding/owned-dotnet-callables/Owned.lean"
	].map(path => historical(path).toString()));
	for(const [kind, command] of Object.entries(jvmThreadExitRepairCommands))
	{
		const run = record.runs[kind], gated = kind === "gated", total = gated ? 3 : 2;
		assert.equal(run.command, command); assert.equal(run.exitCode, 0);
		assert.equal(run.sha256, sha256(run.text));
		for(const [key, value] of Object.entries({ tests: total, pass: total, fail: 0, cancelled: 0, skipped: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
		assert.doesNotMatch(run.text, /^not ok|# SKIP/mu);
		assert.deepEqual(Object.keys(record.reports[kind]).sort(), ["ordinary", "reviewed"]);
		for(const [mode, report] of Object.entries(record.reports[kind]))
		{
			assert.equal(report.installedPackage, false); assert.equal(report.input.hostCallbacks, true);
			assert.equal(Boolean(report.input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
			assert.equal(report.input.sourceIdentity.modules.length, 1);
			assert.equal(report.input.sourceIdentity.modules[0].source.sha256, sha256(lean));
			const counts = { ...normalCounts, ...gated ? { heldExits: 1, releasedExits: 1 } : {} };
			assert.deepEqual(Object.fromEntries(Object.keys(counts).map(key => [key, report[key]])), counts);
			assert.ok(run.text.includes("# " + JSON.stringify(counts)));
			if(gated)
			{
				assert.equal(report.mutation.kind, "remove-native-cleanup-wait");
				assert.equal(report.mutation.stdout, "");
				assert.match(report.mutation.stderr, /^Exception in thread "main" java\.lang\.AssertionError: allocation rollback false\/0: 4 != 5\n/u);
				assert.match(report.mutation.command, /\/bin\/java$/u);
				assert.deepEqual(report.mutation.args.slice(0, 2), ["--enable-native-access=ALL-UNNAMED", "-cp"]);
				assert.match(report.mutation.args[2], /^classes:.*\/kotlin-stdlib\.jar$/u);
				assert.equal(report.mutation.args[3], "org.leanbridge.owned_aggregates.OwnedCallProbe");
				assert.match(report.mutation.args[4], /\/libprobe\.so$/u);
				assert.equal(report.mutation.args.length, 5);
			} else assert.deepEqual(report.retirement, []);
			const native = producer.ownedJvmCallNative(report.input), model = producer.generateOwnedJvmCalls(native.c.layout.model.bindingIr);
			assert.equal(model.functions.length, 51);
			assert.equal(report.cSourceSha256, sha256(native.implementation));
			assert.deepEqual(report.files, Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)])));
			let files, runtime;
			if(gated)
			{
				({ files, runtime } = producer.ownedJvmThreadExitSources(model, template, exercise, kotlin));
				assert.equal(report.guardSha256, sha256(producer.ownedJvmThreadExitGuard(native.cleanup.guardSource)));
				assert.equal(report.mutantJavaProbeSha256, sha256(producer.withoutOwnedJvmThreadExitWait(files["OwnedCallProbe.java"])));
			}
			else
			{
				files = { ...model.files }; runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
				files[runtime] = files[runtime].replace("static void checkpoint() { }", "static void checkpoint() { OwnedCallProbe.allocation(); }");
				files["OwnedCallProbe.java"] = template.replace("/* METHODS */", () => producer.ownedJvmCallProbeMethods(model)).replace("/* EXERCISE */", () => exercise);
				files["KotlinCallProbe.kt"] = kotlin.replace("/* METHODS */", () => producer.ownedJvmCallProbeMethods(model, true));
				assert.equal(report.guardSha256, sha256(native.cleanup.guardSource));
			}
			assert.equal(report.instrumentedRuntimeSha256, sha256(files[runtime]));
			assert.equal(report.javaProbeSha256, sha256(files["OwnedCallProbe.java"]));
			assert.equal(report.kotlinProbeSha256, sha256(files["KotlinCallProbe.kt"]));
		}
	}
	const original = JSON.parse(historical("docs/evidence/owned-jvm-calls-20260927.json"));
	for(const mode of ["ordinary", "reviewed"])
	{
		const normal = record.reports.signatures[mode], gated = record.reports.gated[mode];
		const predecessor = original.reports["signatures-" + mode];
		assert.deepEqual(normal.files, predecessor.files);
		assert.equal(normal.cSourceSha256, predecessor.cSourceSha256);
		assert.equal(normal.guardSha256, predecessor.guardSha256);
		assert.deepEqual(gated.files, normal.files);
		assert.equal(gated.cSourceSha256, normal.cSourceSha256);
		assert.notEqual(gated.guardSha256, normal.guardSha256);
		assert.equal(gated.instrumentedRuntimeSha256, normal.instrumentedRuntimeSha256);
	}
	producer.assertJvmThreadExitCi(historical(".github/workflows/consumer-matrix.yml").toString());
};
