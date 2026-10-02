/**
 * JVM callback replies preserve compiler-authenticated argument owners.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmCalls } from "../src/backends/jvm/owned-calls.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource
	, ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultCombinedConfiguration } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedJvmCallbackResultRuntimeProbes } from "./helpers/owned-jvm-callback-result-runtime.mjs";

const capability = { callbackResultAnchors: true };


test("JVM callback-result owners require capability and retain native closure identity", () => {
	const ir = ownedDotnetCallbackResultReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedJvmPackage(ir), /explicit output leases/u);
	const native = generateOwnedJvmPackage(ir, null, { ...capability, hostCallbacks: false });
	assert.deepEqual(ir, original);
	assert.equal(native.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
	assert.equal(native.wholeOwners, true);
	assert.equal(native.contract.schemaVersion, 5);
	assert.equal(native.contract.backend, "owned-jvm-v5");
	assert.equal(native.contract.callbackResultAnchors.nativeClosures, "identity-preserved");
	assert.equal(native.contract.callbackResultAnchors.signatures.length, 4);
	const nativeSource = Object.values(native.files).join("\n");
	assert.doesNotMatch(nativeSource, /class CallbackResult/u);
	assert.doesNotMatch(nativeSource, /reply\.read\(replies\)/u);
	assert.match(nativeSource, /public [^{]+ invoke\(Value</u);

	const host = generateOwnedJvmPackage(ir, null, { ...capability, hostCallbacks: true });
	const source = Object.values(host.files).join("\n");
	assert.equal(host.functions.length, 32);
	assert.match(source, /public final class CallbackResult<T>/u);
	assert.match(source, /static <T> CallbackResult<T> owner\(Value<T> owner\)/u);
	assert.match(source, /reply\.read\(replies\)/u);
	assert.match(source, /recovery\.read\(scope\)/u);
	assert.match(source, /callJava\d+Native\d+/u);
	assert.match(source, /callKotlin\d+Native\d+/u);
	assert.match(source, /CallbackResult<[^>]+> invoke/u);
	assert.match(source, /public [^{]+ invoke\(Value</u);
	assert.equal(JSON.parse(host.files["binding-manifest.json"]).supportedFeatures.includes("callback-result-anchors"), true);

	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.deepEqual(generateOwnedJvmCalls(reordered, { ...capability, hostCallbacks: true }).files
		, generateOwnedJvmCalls(ir, { ...capability, hostCallbacks: true }).files);
	assert.deepEqual(generateOwnedJvmPackage(ownedAggregateReviewedIr(), null, capability).files
		, generateOwnedJvmPackage(ownedAggregateReviewedIr()).files);
});

const callbackResultMutants = (model, hostCallbacks) => {
	const specifications = [
		{
			name: "callback-native-result-uses-closure-owner"
			, suffix: "/_OwnedBindings.java"
			, from: "var anchor = MemorySegment.ofAddress(arg2.guard.require(state).owner(state));"
			, to: "var anchor = MemorySegment.ofAddress(arg0.lease.owner(state));"
			, occurrences: 4
			, assertion: "empty callback descendants keep their original owner"
			, method: "emptyOwners"
		}
		, {
			name: "whole-owner-get-skips-validity", suffix: "/_OwnedRuntime.java"
			, from: "T get() { T snapshot = value; lease.require(); if (closed.get()) check(4); return snapshot; }"
			, to: "T get() { T snapshot = value; if (closed.get()) check(4); return snapshot; }"
			, occurrences: 1
			, assertion: "expired empty callback result was accepted"
			, method: "emptyOwners"
		}
		, ...hostCallbacks ? [{
			name: "host-callback-frame-escapes", suffix: "/_OwnedRuntime.java"
			, from: "@Override public void close() { scope.active = false; }"
			, to: "@Override public void close() { scope.active = true; }"
			, occurrences: 1
			, assertion: "escaped host callback frame expires", method: "main"
		}] : []
	];
	return specifications.map(({ suffix, ...specification }) => {
		const paths = Object.keys(model.files).filter(path => path.endsWith(suffix));
		assert.equal(paths.length, 1, specification.name);
		const path = paths[0], source = model.files[path];
		assert.equal(source.split(specification.from).length - 1, specification.occurrences, specification.name);
		const mutant = source.replaceAll(specification.from, specification.to);
		assert.notEqual(mutant, source, specification.name);
		return { ...specification, path, mutant, sourceSha256: sha256(source), mutantSha256: sha256(mutant) };
	});
};

const checkCallbackResultMutants = async ({ model, hostCallbacks, directory, files, javaName, observed, execution }) => {
	const rejected = [], mutations = callbackResultMutants(model, hostCallbacks);
	const execute = toolchain => runCopied(toolchain.java, ["--enable-native-access=ALL-UNNAMED"
		, "-cp", "classes:" + toolchain.stdlib, model.namespace + "." + javaName
		, join(directory, "libprobe.so")], directory);
	let restoration;
	try
	{
		for(const { mutant, ...mutation } of mutations)
		{
			// Compilation must succeed; only the authored lifetime assertion is rejection evidence.
			const toolchain = await compileOwnedJvmCallSources(directory, { ...files, [mutation.path]: mutant });
			await assert.rejects(execute(toolchain), error => {
				const { stdout, stderr } = error.details ?? {};
				assert.equal(stdout, "", mutation.name);
				assert.ok(stderr?.startsWith(`Exception in thread "main" java.lang.AssertionError: ${mutation.assertion}\n`),
					`${mutation.name}: ${stderr ?? error.message}`);
				assert.ok(stderr.includes(`${javaName}.${mutation.method}(`), mutation.name);
				rejected.push({
					...mutation, compiled: true, assertionLanguage: "java"
					, semanticRejection: true
					, execution: { stdout, stderr, stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr) } });
				return true;
			}, mutation.name);
		}
	}
	finally
	{
		const toolchain = await compileOwnedJvmCallSources(directory, files);
		for(const path of new Set(mutations.map(mutation => mutation.path)))
			assert.equal(await readFile(join(directory, path), "utf8"), files[path], `restored ${path}`);
		const run = await execute(toolchain);
		assert.equal(run.stderr, ""); assert.equal(run.stdout, execution.stdout);
		assert.deepEqual(JSON.parse(run.stdout.trim()), observed);
		restoration = { compiled: true, generatedSourcesRestored: true, observed
			, execution: { stdout: run.stdout, stderr: run.stderr, stdoutSha256: sha256(run.stdout) } };
	}
	return { rejected, restoration };
};

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["host", "no-host", "combined"])
test(`Java/Kotlin callback-result ownership (${mode}, ${variant})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const configuration = mode === "ordinary" ? await (combined
		? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	const sourceSuffix = combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource;
	const options = { ...capability, hostCallbacks, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined };
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration }
			: { reviewedIr: (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() }
		, hostCallbacks, sourceSuffix
		, evidenceName: `jvm-callback-results-${mode}-${variant}-inputs.json`
	});
	const source = await readFile(join(compiled.directory, "Owned.lean"), "utf8");
	assert.equal(source, await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + sourceSuffix);
	assert.equal(Boolean(compiled.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(compiled.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(compiled.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
	assert.equal(compiled.sourceIdentity.sourceTreeSha256, sha256(source));
	assert.equal(compiled.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(source));
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmCalls(compiled.model.bindingIr, options);
	const authenticated = createCompiledNativeModel(native.input, {
		ownedGraphs: true, ownedHostCallbacks: hostCallbacks
		, ownedCallbackResultAnchors: true, ownedInputTransfers: combined
		, ownedAnchoredResults: combined, ownedReceiverExports: combined
	});
	assert.equal(authenticated.schemaVersion, 11);
	assert.equal(authenticated.ownedGraph.callbackResultAnchors.signatures.length, 4);
	assert.equal(Boolean(authenticated.ownedGraph.hostCallbacks), hostCallbacks);
	for(const key of ["inputTransfers", "resultAnchors", "receiverExports"])
		assert.equal(Boolean(authenticated.ownedGraph[key]), combined, key);
	const javaName = `OwnedJvm${hostCallbacks ? "" : "Native"}CallbackResultProbe`;
	const probes = ownedJvmCallbackResultRuntimeProbes(model, { hostCallbacks, combined });
	const files = { ...model.files, ...probes };
	let observed, execution;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const args = ["--enable-native-access=ALL-UNNAMED"
			, "-cp", "classes:" + toolchain.stdlib
			, model.namespace + "." + javaName
			, join(compiled.directory, "libprobe.so")];
		const run = await runCopied(toolchain.java, args, compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
		execution = { stdout: run.stdout, stderr: run.stderr, stdoutSha256: sha256(run.stdout) };
	}
	catch(error)
	{
		throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error });
	}
	assert.ok(observed.checks >= (combined ? 40 : hostCallbacks ? 30 : 23));
	assert.ok(observed.kotlinChecks >= (combined ? 40 : hostCallbacks ? 30 : 15));
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	const compiledSources = {};
	for(const path of ["Owned.lean", "Owned.c", compiled.module + ".lean"
		, "Carriers.c", "Witness.lean", "Witness.c", "api.c", "guard.cpp"
		, ...compiled.callbackSource ? ["Callbacks.c"] : []])
		compiledSources[path] = sha256(await readFile(join(compiled.directory, path)));
	assert.equal(compiledSources["api.c"], sha256(native.implementation));
	assert.equal(compiledSources["guard.cpp"], sha256(native.cleanup.guardSource));
	const report = {
		schemaVersion: 1, planNode: 1219, mode, variant, combined, hostCallbacks
		, actualLean: true, installedPackage: false, profiles: ["java", "kotlin"]
		, explicitCleanupWithoutGc: true, options, input: native.input
		, compiledInputSha256: sha256(canonicalJson(native.input))
		, nativeModelSha256: sha256(canonicalJson(authenticated))
		, bindingIrSha256: sha256(canonicalJson(compiled.model.bindingIr))
		, compiledSources
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, text]) => [path, sha256(text)]))
		, probes: Object.fromEntries(Object.entries(probes).map(([path, text]) => [path, sha256(text)]))
		, nativeProbeSha256: sha256(native.implementation)
		, nativeHeaderSha256: sha256(native.c.publicHeader)
		, guardSha256: sha256(native.cleanup.guardSource)
		, observed, execution
	};
	const save = value => saveLakeFile("build/owned-jvm-callback-results", `${mode}-${variant}-runtime.json`, canonicalJson(value));
	// Persist the pristine source-bound observation even if a negative control unexpectedly survives.
	await save(report);
	const negativeControls = await checkCallbackResultMutants({
		model, hostCallbacks
		, directory: compiled.directory, files, javaName, observed, execution });
	await save({ ...report, negativeControls });
	t.diagnostic(JSON.stringify({ mode, variant, ...observed, rejectedMutants: negativeControls.rejected.length }));
});
