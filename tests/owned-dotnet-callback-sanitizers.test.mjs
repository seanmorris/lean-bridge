/**
 * Managed callback calls exercise instrumented native adapters and detectors.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedDotnetReceiverProject } from "./helpers/owned-dotnet-receiver-fixture.mjs";
import { ownedDotnetCallbackSanitizerProbe } from "./helpers/owned-dotnet-callback-result-probes.mjs";
import { ownedDotnetSanitizerControls, runOwnedDotnetCallbackSanitizers } from "./helpers/owned-dotnet-callback-result-sanitizers.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`C# callback native sanitizers (${mode}, ${combined ? "combined" : "no-host"})`, {
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
		, evidenceName: `dotnet-callback-sanitizers-${mode}-${combined}-inputs.json`
	});
	const probe = await ownedDotnetCallbackSanitizerProbe(combined);
	const execute = await compiled.compile({ "Program.cs": probe, "Calls.csproj": ownedDotnetReceiverProject });
	const baseline = await execute(); assert.equal(baseline.stderr, "");
	const observed = JSON.parse(baseline.stdout);
	assert.equal(observed.checks, combined ? 1378 : 252);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	const sanitized = await runOwnedDotnetCallbackSanitizers(compiled, combined, observed);
	await saveLakeFile("build/owned-dotnet-callback-results", `${mode}-${combined ? "combined" : "no-host"}-sanitizers.json`, canonicalJson({
		mode, combined, actualLean: true, installedPackage: false
		, hostCallbacks: combined, observed, sanitized
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, probeSha256: sha256(probe)
		, nativeControlsSha256: sha256(ownedDotnetSanitizerControls)
		, sanitizedSources: ["api.c", "guard.cpp", "sanitizer-controls.c"]
		, leanRuntimeInstrumented: false
	}));
	t.diagnostic(JSON.stringify({ ...observed, detectors: sanitized.rejected.map(item => item.fault) }));
});
