/**
 * Reject inherited callback owners and drain them after runtime retirement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedDotnetReceiverProject } from "./helpers/owned-dotnet-receiver-fixture.mjs";
import { ownedDotnetCallbackForkProbe as forkProbe } from "./helpers/owned-dotnet-callback-result-probes.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`C# callback owners across fork and retirement (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const compiled = await compileOwnedDotnetFixture(t, {
		callbackResultAnchors: true, hostCallbacks: combined
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined
		, sourceSuffix: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
		, ...mode === "ordinary" ? { configuration: await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)() }
			: { reviewedIr: (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() }
		, evidenceName: `dotnet-callback-process-${mode}-${combined}-inputs.json`
	});
	await saveLakeFile(compiled.directory, "fork-probe.c", forkProbe);
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-std=c11", "-Wall", "-Wextra", "-Werror", "fork-probe.c", "-o", "fork-probe.so"], compiled.directory, { PATH: "/usr/bin:/bin" });
	const probe = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-process.cs", "utf8");
	const project = combined ? ownedDotnetReceiverProject.replace("<Optimize>", "<DefineConstants>HOST_CALLBACKS</DefineConstants><Optimize>") : ownedDotnetReceiverProject;
	const execute = await compiled.compile({ "Program.cs": probe, "Calls.csproj": project });
	const observations = [];
	for(const scenario of ["fork", "retirement", ...combined ? ["host-retirement", "transfer-retirement"] : []])
	{
		let execution;
		try
		{ execution = await execute(scenario); }
		catch(error)
		{ throw new Error(`${scenario}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(execution.stderr, ""); const observed = JSON.parse(execution.stdout);
		assert.equal(observed.mode, scenario);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		assert.equal(observed.forkChecks, scenario === "fork" ? combined ? 7 : 6 : 0);
		assert.equal(observed.rejected, scenario === "fork" ? 0 : combined ? scenario === "retirement" ? 8 : 9 : 7);
		observations.push(observed); t.diagnostic(JSON.stringify(observed));
	}
	await saveLakeFile("build/owned-dotnet-callback-results", `${mode}-${combined ? "combined" : "no-host"}-process.json`, canonicalJson({
		mode, combined, actualLean: true, installedPackage: false
		, observations, probeSha256: sha256(probe)
		, forkProbeSha256: sha256(forkProbe), project
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeProbeSha256: sha256(compiled.implementation)
	}));
});
