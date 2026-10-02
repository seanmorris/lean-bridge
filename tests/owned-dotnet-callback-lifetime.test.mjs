/**
 * Stress callback owners under GC, cross-thread close and failed transfer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedDotnetReceiverProject, instrumentOwnedDotnetReceivers } from "./helpers/owned-dotnet-receiver-fixture.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "host", "combined"])
test(`C# callback-result lifetime stress (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const compiled = await compileOwnedDotnetFixture(t, {
		callbackResultAnchors: true, hostCallbacks
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined
		, sourceSuffix: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
		, ...mode === "ordinary" ? { configuration: await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)() }
			: { reviewedIr: (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() }
		, evidenceName: `dotnet-callback-lifetime-${mode}-${variant}-inputs.json`
	});
	const base = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-results.cs", "utf8");
	let methods = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-lifetimes.cs", "utf8");
	if(hostCallbacks) methods += await readFile("tests/fixtures/structured-types/owned-dotnet-callback-host-lifetimes.cs", "utf8");
	if(combined) methods += await readFile("tests/fixtures/structured-types/owned-dotnet-callback-transfer-lifetimes.cs", "utf8");
	let probe = base.replace("    private static void Main", methods + "\n    private static void Main")
		.replace("        if (remaining == 0)", "        var hook = allocationHook; allocationHook = null; hook?.Invoke();\n        if (remaining == 0)")
		.replace("OriginalOwners(); EmptyOwners();", `OriginalOwners(); EmptyOwners(); CallbackLifetimeOwners();${hostCallbacks ? " HostLifetimeOwners();" : ""}${combined ? " TransferLifetimeFaults(false); TransferLifetimeFaults(true);" : ""}`)
		.replace("new { checks,", `new { lifetimeCollections, exitedThreads, concurrentReads,${combined ? " managedBefore, managedAfter, nativeBefore, nativeAfter," : ""} checks,`);
	if(combined) probe = probe.replace("        Runtime.Current.Require(); OriginalOwners();", "        Handoffs = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, \"probe_handoffs\");\n        Runtime.Current.Require(); OriginalOwners();");
	const files = { ...compiled.model.files, "Program.cs": probe
		, "Lifetime.cs": instrumentOwnedDotnetReceivers(compiled.model.files["Lifetime.cs"])
		, "Calls.csproj": ownedDotnetReceiverProject };
	const compile = async changes => {
		try
		{ return await compiled.compile({ ...files, ...changes }); }
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	};
	const execute = await compile({}), execution = await execute();
	assert.equal(execution.stderr, ""); const observed = JSON.parse(execution.stdout);
	assert.equal(observed.lifetimeCollections, hostCallbacks ? 12 : 9);
	assert.equal(observed.exitedThreads, 4); assert.equal(observed.concurrentReads, 1);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	if(combined) for(const name of ["managedBefore", "managedAfter", "nativeBefore", "nativeAfter"]) assert.ok(observed[name] > 0, name);
	t.diagnostic(JSON.stringify({ phase: "baseline", ...observed }));
	const mutants = [
		["read-payload-after-close", "Lifetime.cs", "        return snapshot!.Value;"
			, "        return global::System.Threading.Volatile.Read(ref payload) is { } late ? late.Value : default!;"
			, /callback-result read preserves its validated snapshot during close/u]
		, ["unrooted-callback-result", "Values.cs"
			, "global::System.GC.KeepAlive(this);", ";"
			, /temporary callback-result guard remains alive during operation/u]
	];
	const rejectedMutations = [];
	for(const [name, path, before, after, diagnostic] of mutants)
	{
		assert.ok(files[path].includes(before), name);
		const changed = files[path].replaceAll(before, after);
		const run = await compile({ [path]: changed });
		await assert.rejects(run(), error => { assert.match(error.details?.stderr ?? "", diagnostic); return true; });
		rejectedMutations.push({ name, compiled: true, semanticRejection: true
			, sourceSha256: sha256(changed), diagnostic: diagnostic.source });
	}
	const restore = await compile({}), restored = await restore(); assert.deepEqual(restored, execution);
	await saveLakeFile("build/owned-dotnet-callback-results", `${mode}-${variant}-lifetime.json`, canonicalJson({
		mode, variant, hostCallbacks, combined, actualLean: true
		, installedPackage: false
		, observed, rejectedMutations, restored: true
		, input: { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, probeSha256: sha256(probe)
		, optimizedProject: ownedDotnetReceiverProject
	}));
});
