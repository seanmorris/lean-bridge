/**
 * Preserve callback-local C# owners before admitting host or package transport.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedDotnetCalls } from "../src/backends/dotnet/owned-calls.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustCallbackResultConfiguration, ownedRustCallbackResultReviewedIr
	, ownedRustCallbackResultSource, ownedRustCallbackResultCombinedConfiguration
	, ownedRustCallbackResultCombinedReviewedIr, ownedRustCallbackResultCombinedSource } from "./helpers/owned-rust-callback-result-fixture.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedDotnetReceiverProject } from "./helpers/owned-dotnet-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { callbackResultAnchors: true, hostCallbacks: false };

test("C# callback arguments carry whole owners without enabling export anchors", () => {
	const ir = ownedRustCallbackResultReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedDotnetCalls(ir, { hostCallbacks: false }), /explicit output leases/u);
	const generated = generateOwnedDotnetCalls(ir, options);
	assert.deepEqual(ir, before);
	assert.equal(generated.callbacks.filter(fn => fn.anchor !== undefined).length, 4);
	assert.ok(generated.wholeOwners);
	assert.equal(generated.c.functions.filter(fn => fn.anchor !== undefined).length, 0);
	for(const fn of generated.callbacks.filter(fn => fn.anchor !== undefined))
	{
		assert.match(fn.invokeParameters[fn.anchor - 1], /^Value</u);
		assert.match(fn.invokeReturnType, /^Value</u);
	}
	assert.doesNotMatch(generated.files["Calls.cs"], /OwnedThunk\d/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.deepEqual(generateOwnedDotnetCalls(reversed, options).files, generated.files);
	assert.deepEqual(generateOwnedDotnetCalls(ownedAggregateReviewedIr(), options).files,
		generateOwnedDotnetCalls(ownedAggregateReviewedIr(), { hostCallbacks: false }).files);
	const hosted = generateOwnedDotnetCalls(ir, { ...options, hostCallbacks: true });
	assert.match(hosted.files["Values.cs"], /readonly struct CallbackResult<T>/u);
	assert.match(hosted.files["Calls.cs"], /reply\.Read\(replies\)/u);
	assert.equal(hosted.functions.filter(fn => fn.name === "callbackRecord").length, 1);
	assert.equal(hosted.calls.filter(fn => fn.name === "callbackRecord").length, 2);
});

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "host", "combined"]) test(`C# callback results follow original owners (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const hostCallbacks = variant !== "no-host", combined = variant === "combined";
	const compiled = await compileOwnedDotnetFixture(t, {
		...options, hostCallbacks, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined
		, sourceSuffix: combined ? ownedRustCallbackResultCombinedSource : ownedRustCallbackResultSource
		, ...mode === "ordinary" ? { configuration: await (combined ? ownedRustCallbackResultCombinedConfiguration : ownedRustCallbackResultConfiguration)() }
			: { reviewedIr: (combined ? ownedRustCallbackResultCombinedReviewedIr : ownedRustCallbackResultReviewedIr)() }
		, evidenceName: `dotnet-callback-results-${mode}-${variant}-inputs.json`
	});
	let probe = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-results.cs", "utf8");
	if(hostCallbacks)
	{
		const host = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-host-results.cs", "utf8");
		probe = probe.replace("    private static void Main", host + "\n    private static void Main")
			.replace("OriginalOwners(); EmptyOwners();", "OriginalOwners(); EmptyOwners(); HostReplies();")
			.replace("int managedFaults =", "var hostFaults = new[] { HostFaults(true, false), HostFaults(false, false), HostFaults(true, true), HostFaults(false, true) };\n        int managedFaults =")
			.replace("new { checks,", "new { hostFaults, checks,");
	}
	let observed;
	try
	{
		const execute = await compiled.compile({ "Program.cs": probe, "Calls.csproj": ownedDotnetReceiverProject });
		const result = await execute(); assert.equal(result.stderr, ""); observed = JSON.parse(result.stdout);
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.ok(observed.checks > 40); assert.ok(observed.managedFaults > 0); assert.ok(observed.nativeFaults > 0);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	if(hostCallbacks)
	{ assert.equal(observed.hostFaults.length, 4); assert.ok(observed.hostFaults.every(count => count > 0)); }
	await saveLakeFile("build/owned-dotnet-callback-results", `${mode}-${variant}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false
		, hostCallbacks, combined, observed
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, probeSha256: sha256(probe)
	}));
	t.diagnostic(JSON.stringify(observed));
});
