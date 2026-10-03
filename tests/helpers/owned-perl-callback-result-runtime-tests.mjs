/**
 * Exercise real Lean callback result owners on each selected Perl XS ABI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { prepareOwnedPerlNative } from "./owned-perl-native.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"])
for(const variant of ["no-host", "host", "combined"])
test(`Perl callback-result owners execute real Lean (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const configuration = combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration;
	const reviewedIr = combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr;
	const sourceSuffix = combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource;
	const options = { hostCallbacks, callbackResultAnchors: true
		, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined };
	const compiled = await prepareOwnedPerlNative(t, {
		...(mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewedIr() })
		, sourceSuffix
		, ...options
		, evidenceName: `perl-callback-results-${mode}-${variant}-inputs.json`
	});
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-results.pl", "utf8");
	await saveLakeFile(compiled.directory, "consumer.pl", probe);
	assert.equal(compiled.model.c.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
	assert.equal(compiled.model.functions.filter(fn => fn.receiver === 0).length, combined ? 5 : 0);
	assert.equal(compiled.model.functions.filter(fn => fn.transfers?.length).length, combined ? 2 : 0);
	const observations = [];
	for(const perl of perlGraphCommands())
	{
		let execution;
		try
		{
			await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
			execution = await runCopied(perl, ["-I.", "consumer.pl", variant], compiled.directory, compiled.environment);
		}
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(execution.code, 0); assert.equal(execution.stderr, "");
		const observed = JSON.parse(execution.stdout);
		assert.equal(observed.variant, variant);
		assert.equal(observed.actualLean, true); assert.equal(observed.installedPackage, false);
		assert.deepEqual(Object.keys(observed.phases).sort(), ["native", ...hostCallbacks ? ["host"] : [], ...combined ? ["combined"] : []].sort());
		assert.ok(observed.phases.native >= 35);
		if(hostCallbacks) assert.ok(observed.phases.host >= 15);
		if(combined) assert.ok(observed.phases.combined >= 30);
		assert.equal(observed.checks, Object.values(observed.phases).reduce((sum, value) => sum + value, 0) + 2);
		for(const key of ["managedLive", "nativeLive", "identities", "owners", "active", "cleanupStatus"])
			assert.equal(observed[key], 0, key);
		observations.push({ perl, execution, observed });
		t.diagnostic(`${perl}: ${observed.checks} actual Lean ${variant} callback checks`);
	}
	await saveLakeFile(resolve("build/owned-perl-callback-results"), `${mode}-${variant}.json`, canonicalJson({
		schemaVersion: 1, kind: "owned-perl-callback-results-runtime"
		, mode, variant, actualLean: true, installedPackage: false
		, options, observations
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs)
		, probe, probeSha256: sha256(probe)
	}));
});
