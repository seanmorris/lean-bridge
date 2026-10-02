/**
 * Reconstruct direct JVM callback sources and authenticate original executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedAggregateCarriers } from "../../src/build/owned-aggregate-carriers.mjs";
import { generateOwnedJvmCalls } from "../../src/backends/jvm/owned-calls.mjs";
import { ownedJvmCallNative } from "./owned-jvm-call-fixture.mjs";
import { ownedJvmCallbackResultRuntimeProbes } from "./owned-jvm-callback-result-runtime.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";

const hash = value => sha256(canonicalJson(value));
const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
export const ownedJvmCallbackRuntimeReports = Object.freeze(["ordinary", "reviewed"]
	.flatMap(mode => ["host", "no-host", "combined"].map(variant => `${mode}-${variant}-runtime.json`)));

// These are observed Lean compiler/extractor outputs, not independently regenerated C.
// The verifier also binds the exact toolchain, authored Lean/configuration, and model.
const compilerOutputs = {
	"ordinary-host": ["920079df0971ebdb4d68beffb9741e01c33c27ca224d9b384d55955b8a7b751d", "ed21e541c8c6322259328bee386b77a08a4201e0ce16db705bb0d4d2eb768a40"]
	, "ordinary-no-host": ["920079df0971ebdb4d68beffb9741e01c33c27ca224d9b384d55955b8a7b751d", "dc2a40bc1e31e028204e02e0f260d449945ded92289cd24c2e11d99037959bc7"]
	, "ordinary-combined": ["5d2d9563230b2e0ac3a9b7c21ecdd55c0032041103cfd3af77e4f5f4d1428821", "7a441eb3f6386e334f7a8dafb365e01085e9aa47d77b370f79f87ebd9d4c069b"]
	, "reviewed-host": ["df4862e16d7c77318be1928c3634adea5f5214f43126626ddfa0590321f9f8d7", "bf53cf824b1f9b1df2b8370407097669731000972c45bca24580da74df9063a3"]
	, "reviewed-no-host": ["df4862e16d7c77318be1928c3634adea5f5214f43126626ddfa0590321f9f8d7", "94bd2ab8fe0475510f4561fa6ac861f865467d3e6f01bb222095a9cc9b821f84"]
	, "reviewed-combined": ["444534c11087d9a5c1b0b85ffdfa19861ba285eb0a256c1aa61b513ece6c5ac3", "40a7b574519eedd1643e91b33d86a42bb186cf77a71fe210a9515d99787ca9a1"]
};
const witness = `import Owned
@[export owned_test_record_identity]
def recordIdentity (_ : Unit) : Array (Owned.Bundle → Owned.Bundle) := #[fun value => value]
@[export owned_test_tree_identity]
def treeIdentity (_ : Unit) : Array (Owned.Tree → Owned.Tree) := #[fun value => value]
`;

const reconstructed = new Map();
const models = (input, options) => {
	const key = canonicalJson({ input, options });
	if(!reconstructed.has(key))
	{
		const native = createCompiledNativeModel(input, {
			ownedGraphs: true, ownedHostCallbacks: options.hostCallbacks
			, ownedCallbackResultAnchors: true
			, ownedInputTransfers: options.transferredInputs
			, ownedAnchoredResults: options.anchoredResults
			, ownedReceiverExports: options.receiverExports
		});
		reconstructed.set(key, {
			native, model: generateOwnedJvmCalls(native.bindingIr, options)
			, probe: ownedJvmCallNative(input)
			, carriers: generateOwnedAggregateCarriers({ metadata: input.metadata
				, sourceIdentity: input.sourceIdentity, component: input.component
				, hostCallbacks: options.hostCallbacks })
		});
	}
	return reconstructed.get(key);
};

// Independently specified source substitutions: never use a report's replacement
// text, occurrence count, boolean claims, or diagnostic to construct expectations.
const mutations = (model, hostCallbacks) => {
	const specifications = [
		["callback-native-result-uses-closure-owner", "_OwnedBindings", 4
			, "var anchor = MemorySegment.ofAddress(arg2.guard.require(state).owner(state));"
			, "var anchor = MemorySegment.ofAddress(arg0.lease.owner(state));"
			, "empty callback descendants keep their original owner"
			, "emptyOwners", ["check", "emptyOwners", "main"]]
		, ["whole-owner-get-skips-validity", "_OwnedRuntime", 1
			, "T get() { T snapshot = value; lease.require(); if (closed.get()) check(4); return snapshot; }"
			, "T get() { T snapshot = value; if (closed.get()) check(4); return snapshot; }"
			, "expired empty callback result was accepted"
			, "emptyOwners", ["expired", "emptyOwners", "main"]]
		, ...hostCallbacks ? [["host-callback-frame-escapes", "_OwnedRuntime", 1
			, "@Override public void close() { scope.active = false; }"
			, "@Override public void close() { scope.active = true; }"
			, "escaped host callback frame expires", "main", ["check", "main"]]] : []
	];
	return specifications.map(([name, file, occurrences, from, to, assertion, method, stack]) => {
		const path = `src/main/java/${model.namespace.replaceAll(".", "/")}/${file}.java`;
		const source = model.files[path];
		assert.equal(source.split(from).length - 1, occurrences, name);
		const probe = `${model.namespace}.OwnedJvm${hostCallbacks ? "" : "Native"}CallbackResultProbe`;
		const stderr = `Exception in thread "main" java.lang.AssertionError: ${assertion}\n`
			+ stack.map(frame => `\tat ${probe}.${frame}(Unknown Source)\n`).join("");
		return {
			name, from, to, occurrences, assertion, method, path
			, sourceSha256: sha256(source)
			, mutantSha256: sha256(source.replaceAll(from, to))
			, compiled: true, assertionLanguage: "java", semanticRejection: true
			, execution: { stdout: "", stderr, stdoutSha256: sha256(""), stderrSha256: sha256(stderr) }
		};
	});
};

/**
 * Check an original direct-runtime report against sources and exact raw results.
 *
 * @param name - Required mode/variant basename, not a self-asserted report label.
 * @param item - Original report including unmodified stdout and mutant stderr.
 */
export const assertOwnedJvmCallbackRuntime = async (name, item) => {
	assert.ok(ownedJvmCallbackRuntimeReports.includes(name), name);
	const [, mode, variant] = /^(ordinary|reviewed)-(host|no-host|combined)-runtime\.json$/u.exec(name);
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const options = {
		callbackResultAnchors: true, hostCallbacks, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined };
	const { metadata, sourceIdentity: identity, component, ...capabilities } = item.input;
	assert.deepEqual(capabilities, {
		hostCallbacks, callbackResultAnchors: true, valueCopies: true
		, ...combined ? { transferredInputs: true, anchoredResults: true, receiverExports: true } : {} });
	assert.deepEqual(component, { id: "owned-aggregates@1.0.0", name: "owned-aggregates", version: "1.0.0" });
	assert.equal(identity.leanVersion, "4.32.2");
	assert.equal(identity.leanCommit, "f3b06c705e6c85f5314019d5d3baab0fec5b580c");
	assert.equal(identity.leanCompilerSha256, "e8baaa71855a616dc351028f3ad2200051b0671f423a1696a100e809302d5550");
	assert.equal(identity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	assert.equal(hash(metadata), compilerOutputs[`${mode}-${variant}`][0]);
	const lean = (await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8"))
		+ (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource);
	assert.equal(identity.sourceTreeSha256, sha256(lean));
	assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, "Owned");
	assert.deepEqual(identity.modules[0].source, { path: "Owned.lean", sha256: sha256(lean) });
	const configuration = mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(identity.exportConfigurationSha256, hash(configuration));
	assert.equal(Boolean(identity.reviewedBindingIr), mode === "reviewed");
	if(mode === "reviewed")
	{
		const reviewed = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(reviewed));
		assert.equal(identity.reviewedBindingIr.sourceSha256, hash(reviewed));
	}
	const { native, model, probe, carriers } = models(item.input, options);
	assert.equal(native.schemaVersion, 11); assert.equal(native.ownedGraph.schemaVersion, 6);
	assert.equal(native.ownedGraph.callbackResultAnchors.signatures.length, 4);
	assert.equal(Boolean(native.ownedGraph.hostCallbacks), hostCallbacks);
	for(const key of ["inputTransfers", "resultAnchors", "receiverExports"])
		assert.equal(Boolean(native.ownedGraph[key]), combined, key);
	assert.equal(probe.c.publicHeader, model.c.header);
	const observed = { checks: combined ? 48 : hostCallbacks ? 36 : 25
		, kotlinChecks: combined ? 47 : hostCallbacks ? 35 : 20
		, live: 0, identities: 0 };
	const stdout = JSON.stringify(observed) + "\n";
	const execution = { stdout, stderr: "", stdoutSha256: sha256(stdout) };
	const compiledSources = {
		"Owned.lean": sha256(lean)
		, "Owned.c": combined ? "548eb1e30a48a01b5b0023c8e4c2e4465231485d023356af3eee84c83f6af7e9" : "e82f27deb6ad1e97b6b2293e0248e566bf8f467fcc8a7061654d97b903e8805e"
		, [carriers.module + ".lean"]: sha256(carriers.leanSource)
		, "Carriers.c": compilerOutputs[`${mode}-${variant}`][1]
		, "Witness.lean": sha256(witness)
		, "Witness.c": "02568afb0b8a9ec59623a12d4ddf52f63b0ea79f71c5a312087fa240d0be9d96"
		, "api.c": sha256(probe.implementation)
		, "guard.cpp": sha256(probe.cleanup.guardSource)
		, ...hostCallbacks ? { "Callbacks.c": sha256(carriers.callbackSource) } : {}
	};
	assert.deepEqual(item, {
		schemaVersion: 1, planNode: 1219, mode, variant, combined, hostCallbacks
		, actualLean: true, installedPackage: false, profiles: ["java", "kotlin"]
		, explicitCleanupWithoutGc: true, options, input: item.input
		, compiledInputSha256: hash(item.input), nativeModelSha256: hash(native)
		, bindingIrSha256: hash(native.bindingIr), compiledSources
		, generated: hashes(model.files)
		, probes: hashes(ownedJvmCallbackResultRuntimeProbes(model, { hostCallbacks, combined }))
		, nativeProbeSha256: sha256(probe.implementation)
		, nativeHeaderSha256: sha256(probe.c.publicHeader)
		, guardSha256: sha256(probe.cleanup.guardSource), observed, execution
		, negativeControls: {
			rejected: mutations(model, hostCallbacks)
			, restoration: { compiled: true, generatedSourcesRestored: true, observed, execution }
		}
	});
};
