/**
 * Preserve callback-local C# owners before admitting host or package transport.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedDotnetCalls } from "../src/backends/dotnet/owned-calls.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { checkOwnedDotnetCallbackResultGuards } from "./helpers/owned-dotnet-callback-result-guards.mjs";
import { ownedDotnetReceiverProject } from "./helpers/owned-dotnet-receiver-fixture.mjs";
import { ownedDotnetCallbackResultProbe } from "./helpers/owned-dotnet-callback-result-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { callbackResultAnchors: true, hostCallbacks: false };

test("C# callback arguments carry whole owners without enabling export anchors", () => {
	const ir = ownedDotnetCallbackResultReviewedIr(), before = structuredClone(ir);
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
	assert.equal(hosted.calls.filter(fn => fn.name === "applyTwice").length, 4);
	const dispatch = hosted.functions.find(fn => fn.name === "dispatch");
	assert.equal(hosted.callbacks.find(fn => fn.id === dispatch.result).invocations.length, 2);
});

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "host", "combined"]) test(`C# callback results follow original owners (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const hostCallbacks = variant !== "no-host", combined = variant === "combined";
	const compiled = await compileOwnedDotnetFixture(t, {
		...options, hostCallbacks, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined
		, sourceSuffix: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
		, ...mode === "ordinary" ? { configuration: await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)() }
			: { reviewedIr: (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() }
		, evidenceName: `dotnet-callback-results-${mode}-${variant}-inputs.json`
	});
	const probe = await ownedDotnetCallbackResultProbe(hostCallbacks, combined);
	let observed, execution;
	try
	{
		const execute = await compiled.compile({ "Program.cs": probe, "Calls.csproj": ownedDotnetReceiverProject });
		execution = await execute(); assert.equal(execution.stderr, ""); observed = JSON.parse(execution.stdout);
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.ok(observed.checks > 40); assert.ok(observed.managedFaults > 0); assert.ok(observed.nativeFaults > 0);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	if(hostCallbacks)
	{ assert.equal(observed.hostFaults.length, 4); assert.ok(observed.hostFaults.every(count => count > 0)); }
	t.diagnostic(JSON.stringify({ phase: "baseline", ...observed }));
	const guards = await checkOwnedDotnetCallbackResultGuards(compiled, probe, execution.stdout, hostCallbacks);
	await saveLakeFile("build/owned-dotnet-callback-results", `${mode}-${variant}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false
		, hostCallbacks, combined, observed
		, ...guards
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, source]) => [path, sha256(source)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, probeSha256: sha256(probe)
	}));
	t.diagnostic(JSON.stringify(observed));
});
