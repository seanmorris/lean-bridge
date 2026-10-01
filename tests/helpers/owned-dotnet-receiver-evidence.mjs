/**
 * Regenerate the exact C# receiver APIs exercised by compiled runtime probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetCalls } from "../../src/backends/dotnet/owned-calls.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedDotnetNativeProbe, ownedDotnetProbeLoader } from "./owned-dotnet-native.mjs";
import { instrumentOwnedDotnetReceivers, ownedDotnetReceiverProbe, ownedDotnetReceiverProject
	, ownedDotnetPlainReceiverProbe, ownedDotnetPlainReceiverSource } from "./owned-dotnet-receiver-fixture.mjs";
import { assertOwnedDotnetReceiverPackages } from "./owned-dotnet-receiver-package-evidence.mjs";
import { assertOwnedDotnetReceiverCi } from "./owned-dotnet-receiver-ci.mjs";

export const ownedDotnetReceiverCommand = "LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-dotnet-receivers";
export const ownedDotnetReceiverScope = Object.freeze({
	profiles: ["dotnet"]
	, sharedComponentConsumers: ["cpp", "rust", "python", "ruby"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedNuget: true
	, publicExports: 27, receiverExports: 16, resultAnchors: 20
	, nominalOwners: true, readOnlyProperties: true, covariantShareRetain: true
	, originalOwnerTransfers: true, receiverAnchors: true
	, remainingParameterAnchors: true, typedReturnedClosures: true
	, receiverOnlyWithoutOptionalCapabilities: true, consumingWithoutAnchors: true
	, unitProperties: true, transitiveExpiration: true, independentRetains: true
	, emptyValues: true, recursiveValues: true, callbackReentry: true
	, allocationFaults: true, foreignCloseSnapshots: true
	, optimizedReceiverGc: true
	, compiledNegativeVariants: 4, typedRejections: 23
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, sdkFreeExecution: true
	, documentationExecuted: true, deterministicReassembly: true
	, independentRebuild: true, isolatedGmp: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});

const options = { receiverExports: true, anchoredResults: true, transferredInputs: true, hostCallbacks: true };
const capabilities = { ownedGraphs: true, ownedReceiverExports: true
	, ownedAnchoredResults: true, ownedInputTransfers: true
	, ownedHostCallbacks: true };
const compareFiles = (item, generated) => {
	assert.deepEqual(item.generated, Object.fromEntries(Object.entries(generated.files).map(([path, source]) => [path, sha256(source)])));
	assert.equal(item.loaderSha256, sha256(ownedDotnetProbeLoader(generated.namespace)));
	assert.equal(item.optimizedProjectSha256, sha256(ownedDotnetReceiverProject));
};

/**
 * Validate real compilation records without claiming installed NuGet acceptance.
 *
 * @param record - Two full runtime reports and four no-optional-capability reports.
 */
export const assertOwnedDotnetReceiverInputs = async record => {
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.plain.map(item => [item.mode, item.consuming]), [
		["ordinary", false], ["reviewed", false]
		, ["ordinary", true], ["reviewed", true]
	]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const probe = await ownedDotnetReceiverProbe();
	const sourceIdentity = (item, source) => {
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(lean + source));
	};
	for(const item of record.runtime)
	{
		sourceIdentity(item, ownedRustReceiverSource);
		const input = { ...item.input, ...options }, model = createCompiledNativeModel(input, capabilities);
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.exports.length, 27); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.deepEqual(model.ownedGraph.resultAnchors.exports.find(fn => fn.bindingId === "lean:Owned.chooseTicket"), { bindingId: "lean:Owned.chooseTicket", parameter: 0 });
		const generated = generateOwnedDotnetCalls(model.bindingIr, options);
		compareFiles(item, generated);
		assert.equal(item.probeSha256, sha256(probe));
		assert.equal(item.nativeProbeSha256, sha256(ownedDotnetNativeProbe(generateOwnedCPackage(input), true)));
		assert.equal(item.optimizedProject, ownedDotnetReceiverProject);
		assert.equal(item.restored, true);
		assert.deepEqual(item.observed, { checks: 606, managedBefore: 36
			, managedAfter: 62, nativeBefore: 10, nativeAfter: 68
			, receiverCollections: 21, memberCollections: 9
			, live: 0, identities: 0 });
		assert.deepEqual(item.rejected, ["wrong-owner", "raw-receiver-anchor", "raw-parameter-anchor", "read-only-property", "property-not-method"]);
		const files = { ...generated.files, "Lifetime.cs": instrumentOwnedDotnetReceivers(generated.files["Lifetime.cs"]) };
		const expected = [
			["receiver-used-as-parameter-anchor", "Values.cs", "Api.ChooseTicket(Get(), arg1)", "Api.ChooseTicket(Get(), this)", "method borrows from the selected non-receiver argument"]
			, ["unchecked-whole-value", "Lifetime.cs", "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)", "        if (global::System.Threading.Volatile.Read(ref closed)", "Expected LeanBridgeException"]
			, ["escaped-callback-frame", "Lifetime.cs", "    public void Dispose() { scope.Active = false; }", "    public void Dispose() { scope.Active = true; }", "exception status|callback borrow is closed"]
			, ["unrooted-receiver-member", "Values.cs", "try { return Api.Serial(Get()); }\n            finally { global::System.GC.KeepAlive(this); }", "try { return Api.Serial(Get()); }\n            finally { }", "temporary nominal receiver remains rooted"]
		].map(([name, path, before, after, diagnostic]) => {
			assert.equal(files[path].split(before).length, 2);
			return { name, compiled: true, semanticRejection: true
				, sourceSha256: sha256(files[path].replace(before, after)), diagnostic };
		});
		assert.deepEqual(item.rejectedMutations, expected);
	}
	for(const item of record.plain)
	{
		sourceIdentity(item, ownedDotnetPlainReceiverSource);
		const config = { receiverExports: true, hostCallbacks: false, transferredInputs: item.consuming };
		const input = { ...item.input, ...config };
		const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedReceiverExports: true, ownedInputTransfers: item.consuming });
		assert.equal(model.exports.length, item.consuming ? 5 : 4);
		assert.equal(model.ownedGraph.receiverExports.exports.length, item.consuming ? 4 : 3);
		assert.equal(model.ownedGraph.hostCallbacks, undefined); assert.equal(model.ownedGraph.resultAnchors, undefined);
		if(!item.consuming) assert.equal(model.ownedGraph.inputTransfers, undefined);
		const generated = generateOwnedDotnetCalls(model.bindingIr, config);
		compareFiles(item, generated);
		assert.equal(item.probeSha256, sha256(ownedDotnetPlainReceiverProbe(item.consuming)));
		assert.equal(item.nativeProbeSha256, sha256(ownedDotnetNativeProbe(generateOwnedCPackage(input), item.consuming)));
		assert.deepEqual(item.observed, { checks: item.consuming ? 13 : 12, live: 0, identities: 0 });
		assert.match(generated.files["Values.cs"], /public Unit PingTicket\n {4}\{\n {8}get/u);
	}
};

/**
 * Require a complete gate, exact generated inputs and original installed archives.
 *
 * @param record - Source-bound runtime, installed and no-optional-capability reports.
 */
export const assertOwnedDotnetReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedDotnetReceiverScope);
	assert.equal(record.run.command, ownedDotnetReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 10, pass: 10, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	await assertOwnedDotnetReceiverInputs(record);
	await assertOwnedDotnetReceiverPackages(record);
	const observations = record.run.text.split("\n").filter(line => line.startsWith("# {"))
		.map(line => canonicalJson(JSON.parse(line.slice(2)))).sort();
	assert.deepEqual(observations, [
		...record.runtime.flatMap(({ mode, observed }) => [{ mode, phase: "baseline", ...observed }, { mode, ...observed }])
		, ...record.plain.map(({ mode, consuming, observed }) => ({ mode, consuming, ...observed }))
		, ...record.packages.map(item => item.observation)
	].map(canonicalJson).sort());
	assertOwnedDotnetReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
