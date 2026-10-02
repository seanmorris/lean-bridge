/**
 * Fail callback-result publication before and after native owner handoff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`JVM callback-result allocation faults preserve owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedDotnetCallbackResultCombinedConfiguration() }
			: { reviewedIr: ownedDotnetCallbackResultCombinedReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedDotnetCallbackResultCombinedSource
		, evidenceName: `jvm-callback-result-faults-${mode}-inputs.json`
	});
	const options = { callbackResultAnchors: true, hostCallbacks: true
		, transferredInputs: true, anchoredResults: true, receiverExports: true };
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options), files = { ...model.files };
	const runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
	const bindings = Object.keys(files).find(path => path.endsWith("/_OwnedBindings.java"));
	const loader = Object.keys(files).find(path => path.endsWith("/_OwnedLoader.java"));
	const checkpoint = "static void checkpoint() { }";
	assert.equal(files[runtime].split(checkpoint).length, 2);
	files[runtime] = files[runtime].replace(checkpoint, "static void checkpoint() { OwnedCallbackResultFaultProbe.allocation(); }");
	const publication = "                _OwnedRuntime.checkpoint(); return 0;";
	const returned = "            ready();\n            var result =";
	assert.equal(files[bindings].split(publication).length - 1, model.callbacks.length * 2);
	assert.equal(files[bindings].split(returned).length - 1, model.calls.length * 2);
	files[bindings] = files[bindings].replaceAll(publication, "                OwnedCallbackResultFaultProbe.published();\n" + publication)
		.replaceAll(returned, "            OwnedCallbackResultFaultProbe.returned();\n" + returned);
	files[loader] = `package ${model.namespace};
final class _OwnedLoader {
    static _OwnedBindings bindings() { return OwnedCallbackResultFaultProbe.bindings; }
}
`;
	files["OwnedCallbackResultFaultProbe.java"] = await readFile("tests/fixtures/structured-types/owned-jvm-callback-result-faults.java", "utf8");
	files["KotlinCallbackResultFaultProbe.kt"] = await readFile("tests/fixtures/structured-types/owned-kotlin-callback-result-faults.kt", "utf8");
	let observed, execution;
	try
	{
		const tools = await compileOwnedJvmCallSources(compiled.directory, files);
		const run = await runCopied(tools.java, ["--enable-native-access=ALL-UNNAMED"
			, "-cp", "classes:" + tools.stdlib
			, model.namespace + ".OwnedCallbackResultFaultProbe"
			, join(compiled.directory, "libprobe.so")], compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim()); execution = run;
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.ok(observed.checks > 100); assert.equal(observed.cases.length, 8);
	for(const language of ["java", "kotlin"]) for(const name of ["native-anchored", "host-raw", "host-whole", "receiver-whole-recovery"])
	{
		const row = observed.cases.find(value => value.language === language && value.case === name);
		assert.ok(row, `${language}/${name}`); assert.deepEqual(row.successes, [1, 1]);
		assert.equal(row.faults.length, 4); assert.ok(row.faults[0] > 0 && row.faults[2] > 0);
		if(name === "receiver-whole-recovery") assert.ok(row.faults[1] > 0 && row.faults[3] > 0);
		else assert.equal(row.faults[1] + row.faults[3], 0);
		if(name === "native-anchored") assert.ok(row.returnedFaults[0] > 0);
		else
		{
			assert.ok(row.enteredFaults.every(count => count > 0));
			assert.ok(row.publishedFaults.every(count => count > 0));
		}
	}
	await saveLakeFile("build/owned-jvm-callback-result-faults", mode + ".json", canonicalJson({
		schemaVersion: 1, mode, actualLean: true, installedPackage: false
		, explicitCleanupWithoutGc: true, input: native.input, observed, execution
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, instrumentedRuntimeSha256: sha256(files[runtime])
		, instrumentedBindingsSha256: sha256(files[bindings])
		, javaProbeSha256: sha256(files["OwnedCallbackResultFaultProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinCallbackResultFaultProbe.kt"])
		, nativeProbeSha256: sha256(native.implementation)
		, sourceHashes: Object.fromEntries(await Promise.all([
			"tests/owned-jvm-callback-result-faults.test.mjs"
			, "tests/fixtures/structured-types/owned-jvm-callback-result-faults.java"
			, "tests/fixtures/structured-types/owned-kotlin-callback-result-faults.kt"
		].map(async path => [path, sha256(await readFile(path))])))
	}));
	t.diagnostic(JSON.stringify({ mode, ...observed }));
});
