/**
 * Exercise callback-result lifetimes across real Perl process and reentry boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { prepareOwnedPerlNative } from "./owned-perl-native.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const execute = promisify(execFile);
const variants = ["process-reentry", "reentrant-shutdown"];
const entries = ["copy_arg0", "copy_result", "native_call", "borrowed_get", "consuming_receiver", "host_callback"];
const assertObserved = (observed, variant, fingerprint) => {
	assert.equal(observed.actualLean, true); assert.equal(observed.installedPackage, false);
	assert.equal(observed.variant, variant);
	assert.equal(observed.perlVersion, fingerprint.perlVersion);
	assert.equal(observed.threaded, fingerprint.threaded);
	assert.deepEqual(observed.baseline, [0, 1, 1, 0, 0, 0]);
	assert.deepEqual(observed.final, [0, 0, 0, 0, 0, 0]);
	const { events } = observed;
	if(variant === "process-reentry")
	{
		assert.deepEqual(Object.keys(events).sort(), ["fork", "thread", "creator", "reentry", "inputPin", "replyPin", "retirement"].sort());
		assert.equal(events.fork.waitStatus, 0); assert.ok(events.fork.pid > 0);
		assert.deepEqual(JSON.parse(events.fork.stdout), events.fork.observed);
		for(const name of ["fork", ...fingerprint.threaded ? ["thread"] : []])
		{
			const item = events[name];
			assert.deepEqual(item.observed.map(entry => entry.name), entries);
			for(const entry of item.observed)
			{ assert.equal(entry.ok, 0); assert.match(entry.error, /initiating process and Perl interpreter thread/u); }
			assert.deepEqual(item.before, item.after); assert.ok(item.before[4] >= 2);
			assert.equal(item.creatorSerial, 63);
		}
		if(fingerprint.threaded) assert.deepEqual(JSON.parse(events.thread.returned), events.thread.observed);
		else assert.deepEqual(events.thread, { skipped: "Perl was built without ithreads" });
		assert.equal(events.creator.handoffAfter - events.creator.handoffBefore, 1);
		assert.equal(events.creator.resultSerial, 63);
		assert.equal(events.reentry.handoffAfter - events.reentry.handoffBefore, 1);
		assert.deepEqual(events.reentry.calls, [1, 1, 1, 1]);
		assert.deepEqual(events.reentry.escapedClosed, [1, 1, 1, 1]);
		assert.equal(events.reentry.outputSerial, 63); assert.equal(events.reentry.retainedSerial, 63);
		for(const pin of [events.inputPin, events.replyPin])
		{
			assert.equal(pin.before[1], pin.after[1]); assert.equal(pin.before[2], pin.after[2]);
			assert.ok(pin.before[4] >= 2); assert.equal(pin.before[4], pin.after[4]);
		}
		assert.equal(events.inputPin.callbackSerial, 63);
		assert.equal(events.replyPin.fetches, 1); assert.equal(events.replyPin.outputSerial, 63);
		assert.equal(events.retirement.after[1], 0); assert.equal(events.retirement.after[2], 0);
		assert.deepEqual(observed.errors.map(item => item.label), [
			"closed original after reentry", "retired copy_arg0"
			, "retired copy_result", "retired native call"
			, "retired consuming receiver", "retired borrowed result get"]);
		assert.match(observed.errors[0].error, /status=4|closed|expired/u);
		for(const item of observed.errors.slice(1, -1)) assert.match(item.error, /session is closed/u);
		assert.match(observed.errors.at(-1).error, /status=4/u);
	}
	else
	{
		assert.deepEqual(Object.keys(events).sort(), ["shutdownDuringCallback", "shutdownResult"].sort());
		const shutdown = events.shutdownDuringCallback, result = events.shutdownResult;
		assert.ok(shutdown.before[4] >= 2); assert.deepEqual(shutdown.before, shutdown.after);
		assert.equal(result.handoffAfter - result.handoffBefore, 1);
		assert.deepEqual(result.calls, [1, 0]);
		assert.equal(result.drained[1], 0); assert.equal(result.drained[2], 0);
		assert.equal(result.drained[4], 0); assert.equal(result.drained[5], 0);
		assert.deepEqual(observed.errors.map(item => item.label)
			, ["callback retired factory", "callback retired entry", "outer callback after shutdown"]);
		for(const item of observed.errors) assert.match(item.error, /session is closed/u);
	}
};

for(const mode of ["ordinary", "reviewed"])
test(`Perl callback-result lifetime and process guards execute real Lean (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const options = { hostCallbacks: true, callbackResultAnchors: true
		, transferredInputs: true, anchoredResults: true, receiverExports: true };
	const compiled = await prepareOwnedPerlNative(t, {
		...(mode === "ordinary" ? { configuration: await ownedDotnetCallbackResultCombinedConfiguration() }
			: { reviewedIr: ownedDotnetCallbackResultCombinedReviewedIr() })
		, sourceSuffix: ownedDotnetCallbackResultCombinedSource
		, ...options
		, evidenceName: `perl-callback-result-lifetime-${mode}-inputs.json`
	});
	assert.equal(Boolean(compiled.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(sha256(compiled.sourceIdentity.exportConfigurationSource), compiled.sourceIdentity.exportConfigurationSha256);
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-result-lifetime.pl", "utf8");
	await saveLakeFile(compiled.directory, "consumer.pl", probe);
	const report = {
		schemaVersion: 1, kind: "owned-perl-callback-result-lifetime"
		, mode
		, actualLean: true, installedPackage: false, options, observations: []
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs)
		, probe, probeSha256: sha256(probe)
	};
	const saveReport = () => saveLakeFile(resolve("build/owned-perl-callback-result-lifetime"), `${mode}.json`, canonicalJson(report));
	for(const perl of perlGraphCommands())
	{
		const fingerprintExecution = await runCopied(perl, [
			"-MConfig", "-MJSON::PP", "-e"
			, 'print JSON::PP->new->canonical->encode({perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0})']
			, compiled.directory, compiled.environment);
		const fingerprint = JSON.parse(fingerprintExecution.stdout);
		const build = await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		for(const variant of variants)
		{
			const execution = await execute(perl, ["-I.", "consumer.pl", variant], { cwd: compiled.directory
				, env: compiled.environment, timeout: 180000, maxBuffer: 32 * 1024 * 1024 })
				.then(({ stdout, stderr }) => ({ code: 0, signal: null, stdout, stderr })
					, error => ({ code: error.code ?? null, signal: error.signal ?? null
						, stdout: error.stdout ?? "", stderr: error.stderr ?? ""
						, message: error.message }));
			const observation = { perl, variant, fingerprintExecution, fingerprint, build, execution };
			report.observations.push(observation); await saveReport();
			assert.equal(execution.code, 0, execution.stderr); assert.equal(execution.signal, null);
			assert.equal(execution.stderr, "");
			observation.observed = JSON.parse(execution.stdout); await saveReport();
			assertObserved(observation.observed, variant, fingerprint);
			t.diagnostic(`${perl} ${variant}: ${observation.observed.checks} checks; actual ${fingerprint.perlVersion} ithreads=${fingerprint.threaded}`);
		}
	}
});
