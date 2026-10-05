/**
 * Compile semantic callback-result mutants against fresh actual Lean producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, statfs } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareOwnedPerlNative } from "./owned-perl-native.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { ownedPerlReceiverVariant } from "./owned-perl-receiver-evidence.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedPerlCallbackMutations } from "./owned-perl-callback-result-mutants.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

// Unlike the build runner, retain complete stdout/stderr and numeric status from
// expected semantic failures. A signal or timeout is never a passing mutant.
const execute = (perl, directory, environment) => new Promise((accept, reject) => {
	const child = spawn("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "perl-callback-mutant", perl, "-I.", "consumer.pl", "combined"], {
		cwd: directory, env: environment, stdio: ["ignore", "pipe", "pipe"]
	});
	const stdout = [], stderr = [];
	let failure, size = 0;
	const timer = setTimeout(() => { failure = new Error("Callback mutant exceeded 180 seconds"); child.kill("SIGKILL"); }, 180000);
	const collect = chunks => bytes => {
		size += bytes.length;
		if(size > 8 * 1024 * 1024)
		{ failure = new Error("Callback mutant exceeded 8 MiB output"); child.kill("SIGKILL"); }
		else chunks.push(bytes);
	};
	child.stdout.on("data", collect(stdout)); child.stderr.on("data", collect(stderr));
	child.once("error", error => { clearTimeout(timer); reject(error); });
	child.once("close", (code, signal) => {
		clearTimeout(timer);
		if(failure) reject(failure);
		else accept({ code, signal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
	});
});

const positive = (execution, perl) => {
	assert.equal(execution.code, 0); assert.equal(execution.signal, null); assert.equal(execution.stderr, "");
	const abi = ownedPerlReceiverVariant(perl);
	const observed = JSON.parse(execution.stdout);
	assert.deepEqual(observed, { actualLean: true
		, installedPackage: false, variant: "combined"
		, checks: 92, phases: { native: 37, host: 21, combined: 32 }
		, managedLive: 0, nativeLive: 0, identities: 0, owners: 0
		, active: 0, cleanupStatus: 0
		, perlVersion: "v" + abi.split("-")[0]
		, threaded: Number(!abi.endsWith("unthreaded")) });
	return { execution, observed };
};

for(const mode of ["ordinary", "reviewed"])
test(`Perl callback-result compiled semantic mutants reject (${mode}, combined)`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_MUTANT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const disk = await statfs("/tmp");
	assert.ok(disk.bavail * disk.bsize >= 2 * 1024 ** 3, "Direct mutant producer needs at least 2 GiB free");
	const options = { hostCallbacks: true, callbackResultAnchors: true, transferredInputs: true, anchoredResults: true, receiverExports: true };
	const compiled = await prepareOwnedPerlNative(t, {
		...(mode === "ordinary" ? { configuration: await ownedDotnetCallbackResultCombinedConfiguration() }
			: { reviewedIr: ownedDotnetCallbackResultCombinedReviewedIr() })
		, sourceSuffix: ownedDotnetCallbackResultCombinedSource
		, ...options
		, evidenceName: `perl-callback-result-mutants-${mode}-inputs.json`
	});
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-results.pl", "utf8");
	await saveLakeFile(compiled.directory, "consumer.pl", probe);
	const mutations = ownedPerlCallbackMutations(compiled.xs, compiled.model), observations = [];
	let complete = false;
	const report = () => saveLakeFile(resolve("build/owned-perl-callback-result-mutants"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, kind: "owned-perl-callback-result-compiled-mutants"
		, mode, variant: "combined", complete
		, actualLean: true, installedPackage: false
		, scope: "direct-runtime-compiled-semantic-negative-controls"
		, options
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.c.layout.model.component }
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs)
		, probe, probeSha256: sha256(probe), observations
	}));
	await report();
	for(const perl of perlGraphCommands())
	{
		const compile = () => runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		await saveLakeFile(compiled.directory, "Probe.xs", compiled.xs);
		const baselineCompilation = await compile();
		const baseline = positive(await execute(perl, compiled.directory, compiled.environment), perl);
		const rejectedMutations = [];
		const observation = { perl, baselineCompilation, baseline, rejectedMutations };
		observations.push(observation); await report();
		for(const { source, ...mutation } of mutations)
		{
			const result = { ...mutation, compiled: false, semanticRejected: false };
			rejectedMutations.push(result);
			try
			{
				await saveLakeFile(compiled.directory, "Probe.xs", source);
				result.compilation = await compile();
				assert.equal(result.compilation.code, 0); result.compiled = true;
				const execution = result.execution = await execute(perl, compiled.directory, compiled.environment);
				await report();
				assert.equal(execution.signal, null, mutation.name);
				assert.equal(execution.code, 255, `${mutation.name}: only a semantic Perl exception is accepted`);
				assert.equal(execution.stdout, "", mutation.name);
				assert.match(execution.stderr, new RegExp(mutation.semantic.pattern, "mu"), mutation.name);
				assert.doesNotMatch(execution.stderr, /segmentation|core dumped|double free|invalid pointer|unreleased (?:native|Perl) ownership/iu, mutation.name);
				result.semanticRejected = true;
			}
			catch(error)
			{
				result.failure = { message: error.message, ...(error.details ? { details: error.details } : {}) };
				throw error;
			}
			finally
			{
				await saveLakeFile(compiled.directory, "Probe.xs", compiled.xs);
				result.restorationCompilation = await compile();
				result.restored = { execution: await execute(perl, compiled.directory, compiled.environment) };
				await report();
				result.restored = positive(result.restored.execution, perl);
				await report();
			}
			t.diagnostic(`${mode}: ${perl}: ${mutation.name}: ${mutation.semantic.name}; original restored`);
		}
		observation.final = positive(await execute(perl, compiled.directory, compiled.environment), perl);
		await report();
	}
	complete = true; await report();
});
