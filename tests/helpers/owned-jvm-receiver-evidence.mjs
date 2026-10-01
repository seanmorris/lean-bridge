/**
 * Regenerate the exact public JVM receiver APIs exercised by native probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { ownedJvmCallNative, ownedJvmCallProbeMethods } from "./owned-jvm-call-fixture.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverSource, ownedJvmPlainReceiverProbe, ownedKotlinPlainReceiverProbe } from "./owned-jvm-receiver-fixture.mjs";
import { ownedJvmReceiverRejections } from "./owned-jvm-receiver-rejections.mjs";
import { assertOwnedJvmReceiverPackages } from "./owned-jvm-receiver-package-evidence.mjs";

export const ownedJvmReceiverCommand = "LEAN_BRIDGE_PYTHON_TYPING_WHEELS=/app/build/python-typing-wheels LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-jvm-receivers";
export const ownedJvmReceiverScope = Object.freeze({
	profiles: ["java", "kotlin"]
	, sharedComponentConsumers: ["cpp", "rust", "python", "ruby", "dotnet"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedCli: true, installedMaven: true
	, publicExports: 27, receiverExports: 16, resultAnchors: 20
	, nominalOwners: true, javaBeanGetters: true, kotlinReadOnlyProperties: true
	, covariantShareRetain: true, originalOwnerTransfers: true
	, receiverAnchors: true, remainingParameterAnchors: true
	, typedReturnedClosures: true, receiverOnlyWithoutOptionalCapabilities: true
	, consumingWithoutAnchors: true, callbacksWithoutAnchors: true
	, installedReceiverOnly: true, unitProperties: true
	, transitiveExpiration: true, independentRetains: true, emptyValues: true
	, recursiveValues: true, callbackReentry: true, allocationFaults: true
	, wholeOwnerGc: true, threadExit: true, optimizedNominalReceiverGc: false
	, compiledNegativeVariants: 4, directTypedRejections: 10
	, installedTypedRejections: 20, sourceFreeInstallation: true
	, offlineInstall: true, sourceFreeRelocatedExecution: true
	, compilerFreeExecution: true, documentationExecuted: true
	, deterministicReassembly: true, independentRebuild: true
	, isolatedGmp: true, coldAndWarmAssetRejections: true
	, callbackResultAnchors: false, docker: false, installedSupportPromotions: 0
});

const capabilities = { ownedGraphs: true, ownedReceiverExports: true
	, ownedHostCallbacks: true, ownedInputTransfers: true
	, ownedAnchoredResults: true };
const options = { receiverExports: true, hostCallbacks: true
	, transferredInputs: true, anchoredResults: true };
const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
const loader = (namespace, probe) => `package ${namespace};
final class _OwnedLoader {
    static _OwnedBindings bindings() { return ${probe}.bindings; }
}
`;

/**
 * Require a complete enabled gate and reconstruct every source-bound result.
 *
 * @param record - Frozen direct and installed execution evidence.
 */
export const assertOwnedJvmReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJvmReceiverScope);
	assert.equal(record.run.command, ownedJvmReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 15, pass: 15, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	await assertOwnedJvmReceiverInputs(record);
	await assertOwnedJvmReceiverPackages(record);
};

/**
 * Match all eight direct reports to final generated sources and independent probes.
 *
 * @param record - Main, resource-only and callback-without-anchor execution reports.
 */
export const assertOwnedJvmReceiverInputs = async record => {
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.unanchored.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.plain.map(item => [item.mode, item.consuming]), [
		["ordinary", false], ["reviewed", false]
		, ["ordinary", true], ["reviewed", true]
	]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const input = (item, suffix, config) => {
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
		const model = createCompiledNativeModel(item.input, { ...capabilities
			, ownedHostCallbacks: config.hostCallbacks
			, ownedInputTransfers: Boolean(config.transferredInputs)
			, ownedAnchoredResults: Boolean(config.anchoredResults) });
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(model.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean + suffix));
		const generated = generateOwnedJvmPackage(model.bindingIr, null, config);
		assert.deepEqual(item.generated, hashes(generated.files));
		assert.equal(item.nativeProbeSha256, sha256(ownedJvmCallNative(item.input).implementation));
		return { model, generated };
	};
	for(const item of record.runtime)
	{
		const { model, generated } = input(item, ownedRustReceiverSource, options);
		assert.equal(model.exports.length, 27);
		assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		assert.equal(item.nominalMembers, true); assert.equal(item.restored, true);
		assert.deepEqual(item.observed, { javaChecks: 650, kotlinChecks: 642
			, faults: [39, 82, 10, 68], kotlinFaults: [39, 82, 10, 68]
			, live: 0, identities: 0, threadExits: 2, threadExitErrors: 0 });
		const files = { ...generated.files };
		const runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
		files[runtime] = files[runtime].replace("static void checkpoint() { }", "static void checkpoint() { OwnedBorrowProbe.allocation(); }")
			.replace("if (closed.get()) check(4);", "if (closed.get()) check(4); OwnedBorrowProbe.afterWholeReadCheck();");
		for(const [file, kotlin] of [["owned-jvm-borrows.java", false], ["owned-kotlin-borrows.kt", true]])
		{
			let source = await readFile(`tests/fixtures/structured-types/${file}`, "utf8");
			const members = await readFile(`tests/fixtures/structured-types/${kotlin ? "owned-kotlin-receiver-members.kt" : "owned-jvm-receiver-members.java"}`, "utf8");
			const calls = kotlin ? "shapes(); callbacksAndTransfers()" : "shapes(); callbacks(); transfers();";
			assert.equal(source.split("/* METHODS */").length, 2); assert.equal(source.split(calls).length, 2);
			source = source.replace("/* METHODS */", "/* METHODS */\n" + members).replace(calls, "receiverMembers(); " + calls)
				.replace("/* METHODS */", () => ownedJvmCallProbeMethods(generated, kotlin));
			assert.equal(item[kotlin ? "kotlinProbeSha256" : "javaProbeSha256"], sha256(source));
		}
		assert.equal(item.testLoaderSha256, sha256(loader(generated.namespace, "OwnedBorrowProbe")));
		assert.deepEqual(item.compileRejections, Object.entries(ownedJvmReceiverRejections(generated.namespace)).flatMap(([profile, examples]) =>
			examples.map(example => ({ profile, name: example.name, compiledRejection: true, sourceSha256: sha256(example.source) }))));
		const owner = Object.keys(files).find(path => path.endsWith("/TicketValue.java"));
		const conversions = Object.keys(files).find(path => path.endsWith("/_OwnedConvert.java"));
		const selected = generated.functions.findIndex(fn => fn.publicName === "chooseTicket");
		const mutations = [
			["receiver-used-as-parameter-anchor", [[owner, `bindings.callJava${selected}(get(), arg1)`, `bindings.callJava${selected}(get(), this)`]]]
			, ["retained-member-shares-original", [[owner, "return (TicketValue)super.retain();", "return share();"]]]
			, ["unchecked-whole-value", [[runtime, "T get() { T snapshot = value; lease.require(); if", "T get() { T snapshot = value; if"]]]
			, ["escaped-callback-frame-and-views", [
				[runtime, "scope.active = false;", "scope.active = true;"]
				, [conversions, "try { handle.close(); }", "try { if (handle.lease.scope == null) handle.close(); }"]
			]]
		];
		assert.deepEqual(item.rejectedMutations, mutations.map(([name, changes]) => ({
			name, compiled: true
			, sources: Object.fromEntries(changes.map(([path, before, after]) => {
				assert.equal(files[path].split(before).length, 2);
				return [path, sha256(files[path].replace(before, after))];
			}))
		})));
	}
	for(const item of record.plain)
	{
		const { model, generated } = input(item, ownedJvmPlainReceiverSource, {
			receiverExports: true, hostCallbacks: false
			, transferredInputs: item.consuming
		});
		assert.equal(item.nominalMembers, true);
		assert.equal(model.exports.length, item.consuming ? 5 : 4);
		assert.equal(model.ownedGraph.hostCallbacks, undefined);
		assert.equal(model.ownedGraph.resultAnchors, undefined);
		assert.equal(Boolean(model.ownedGraph.inputTransfers), item.consuming);
		assert.equal(item.javaProbeSha256, sha256(ownedJvmPlainReceiverProbe(item.consuming)));
		assert.equal(item.kotlinProbeSha256, sha256(ownedKotlinPlainReceiverProbe(item.consuming)));
		assert.equal(item.testLoaderSha256, sha256(`package ${generated.namespace};
final class _OwnedLoader {
    static _OwnedBindings loaded;
    static _OwnedBindings bindings() { return loaded; }
}
`));
		assert.deepEqual(item.observed, { javaChecks: item.consuming ? 13 : 11
			, kotlinChecks: item.consuming ? 13 : 11, live: 0, identities: 0 });
	}
	for(const item of record.unanchored)
	{
		const { model, generated } = input(item, ownedRustReceiverSource, { ...options, anchoredResults: false });
		assert.equal(model.exports.length, 27); assert.ok(model.ownedGraph.hostCallbacks);
		assert.equal(model.ownedGraph.resultAnchors, undefined); assert.equal(item.resultAnchors, false);
		assert.equal(item.testLoaderSha256, sha256(loader(generated.namespace, "UnanchoredReceiverProbe")));
		for(const [file, field] of [["owned-jvm-receiver-unanchored.java", "javaProbeSha256"], ["owned-kotlin-receiver-unanchored.kt", "kotlinProbeSha256"]])
			assert.equal(item[field], sha256(await readFile("tests/fixtures/structured-types/" + file)));
		assert.deepEqual(item.observed, { javaChecks: 8, kotlinChecks: 8, live: 0, identities: 0 });
	}
};
