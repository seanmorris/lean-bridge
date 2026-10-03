/**
 * Sweep real Lean callback failures before and after an instrumented handoff.
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
const kinds = ["raw", "whole-reply", "whole-recovery"], domains = ["allocator", "exception", "native"];
const zeros = [0, 0, 0, 0, 0, 0];

const assertObserved = observed => {
	assert.equal(observed.actualLean, true); assert.equal(observed.installedPackage, false);
	assert.deepEqual(Object.keys(observed.sweeps).sort(), [...kinds].sort());
	assert.deepEqual(observed.baseline, [0, 1, 1, 0, 0, 0]);
	assert.deepEqual(observed.final, zeros);
	let failures = 0;
	for(const kind of kinds)
	{
		assert.deepEqual(Object.keys(observed.sweeps[kind]).sort(), [...domains].sort());
		const controls = observed.attempts.filter(item => item.kind === kind && item.domain === "none");
		assert.equal(controls.length, kind === "whole-recovery" ? 5 : 4);
		assert.deepEqual(controls.slice(1).map(item => item.restoredAfter)
			, [...domains, ...kind === "whole-recovery" ? ["intentional-exception"] : []]);
		for(const domain of domains)
		{
			const attempts = observed.attempts.filter(item => item.kind === kind && item.domain === domain);
			const summary = observed.sweeps[kind][domain];
			assert.equal(summary.attempts, attempts.length);
			assert.equal(summary.firstSuccess, attempts.at(-1).index);
			assert.equal(attempts.at(-1).ok, 1);
			assert.ok(summary.before > 0 && summary.after > 0);
			assert.equal(summary.before, attempts.filter(item => !item.ok && item.handoffDelta === 0).length);
			assert.equal(summary.after, attempts.filter(item => !item.ok && item.handoffDelta === 1).length);
			assert.equal(summary.replyEnteredFailures, attempts.filter(item => !item.ok && item.calls[kind === "whole-reply" ? 0 : 1]).length);
			assert.ok(summary.replyEnteredFailures > 0);
			for(const [offset, item] of attempts.entries())
			{
				assert.equal(item.index, offset + (domain === "native" ? 0 : 1));
				assert.equal(item.ok, offset === attempts.length - 1 ? 1 : 0);
			}
		}
	}
	for(const item of observed.attempts)
	{
		assert.ok(kinds.includes(item.kind)); assert.ok([...domains, "none"].includes(item.domain));
		assert.ok([0, 1].includes(item.handoffDelta));
		assert.equal(item.handoffAfter - item.handoffBefore, item.handoffDelta);
		assert.deepEqual(item.closed, Array(3).fill(item.handoffDelta));
		assert.deepEqual(item.cleanup, observed.baseline);
		assert.equal(item.retainedSerial, 63);
		assert.equal(item.independentSerial, item.kind === "raw" ? null : 63);
		assert.equal(item.injectionSnapshot.length, 8);
		assert.ok(item.calls.every(value => value === 0 || value === 1));
		assert.ok(item.calls[1] <= item.calls[0]);
		if(item.kind === "whole-reply") assert.equal(item.calls[1], 0);
		if(item.ok)
		{
			assert.equal(item.handoffDelta, 1); assert.equal(item.error, "");
			assert.deepEqual(item.calls, item.kind === "whole-reply" ? [1, 0] : [1, 1]);
			if(item.domain === "allocator") assert.ok(item.index > item.injectionSnapshot[4]);
			if(item.domain === "exception") assert.ok(item.index > item.injectionSnapshot[5]);
		}
		else
		{
			++failures; assert.notEqual(item.domain, "none");
			assert.match(item.error, item.domain === "exception" ? /injected Perl ownership exception/u : /allocation failed|status=3/u);
			if(!item.handoffDelta) assert.deepEqual(item.calls, [0, 0]);
		}
	}
	assert.equal(observed.heldErrors, failures + 1);
	assert.equal(observed.exception.expectedClass, "CallbackFaultException");
	assert.equal(observed.exception.actualClass, observed.exception.expectedClass);
	assert.ok(observed.exception.expectedAddress > 0);
	assert.equal(observed.exception.actualAddress, observed.exception.expectedAddress);
	assert.equal(observed.exception.handoffAfter - observed.exception.handoffBefore, 1);
	assert.deepEqual(observed.exception.calls, [1, 0]);
	assert.equal(observed.exception.retainedSerial, 63); assert.equal(observed.exception.recoverySerial, 63);
	assert.deepEqual(observed.exception.cleanup, observed.baseline);
};

for(const mode of ["ordinary", "reviewed"])
test(`Perl callback-result faults preserve handoff ownership (${mode})`, {
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
		, evidenceName: `perl-callback-result-faults-${mode}-inputs.json`
	});
	assert.equal(Boolean(compiled.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(sha256(compiled.sourceIdentity.exportConfigurationSource), compiled.sourceIdentity.exportConfigurationSha256);
	assert.equal(compiled.model.c.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
	assert.equal(compiled.model.functions.filter(fn => fn.transfers?.length).length, 2);
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-result-faults.pl", "utf8");
	await saveLakeFile(compiled.directory, "consumer.pl", probe);
	const report = {
		schemaVersion: 1, kind: "owned-perl-callback-result-faults", mode
		, actualLean: true, installedPackage: false, options, observations: []
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs)
		, probe, probeSha256: sha256(probe) };
	const saveReport = () => saveLakeFile(resolve("build/owned-perl-callback-result-faults"), `${mode}.json`, canonicalJson(report));
	for(const perl of perlGraphCommands())
	{
		const build = await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		// Unlike the shared runner's bounded error tail, retain complete failed probe
		// stdout/stderr as well as successful output before making any assertions.
		const execution = await execute(perl, ["-I.", "consumer.pl"], { cwd: compiled.directory
			, env: compiled.environment, timeout: 180000, maxBuffer: 32 * 1024 * 1024 })
			.then(({ stdout, stderr }) => ({ code: 0, signal: null, stdout, stderr })
				, error => ({ code: error.code ?? null, signal: error.signal ?? null
					, stdout: error.stdout ?? ""
					, stderr: error.stderr ?? ""
					, message: error.message }));
		const observation = { perl, build, execution };
		report.observations.push(observation); await saveReport();
		assert.equal(execution.code, 0, execution.stderr); assert.equal(execution.signal, null);
		assert.equal(execution.stderr, "");
		observation.observed = JSON.parse(execution.stdout); await saveReport();
		assertObserved(observation.observed);
		t.diagnostic(`${perl}: ${observation.observed.checks} checks, ${observation.observed.attempts.length} attempts, ${observation.observed.heldErrors} live errors`);
	}
});
