/**
 * Exercise public Java/Kotlin callback calls against ASan and UBSan adapters.
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
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { ownedJvmCallbackResultInstalledFixture } from "./helpers/owned-jvm-callback-result-installed.mjs";
import { compileOwnedJvmCallbackSanitizers, ownedJvmCallbackSanitizerControls
	, ownedJvmCallbackSanitizerDriver } from "./helpers/owned-jvm-callback-result-sanitizers.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`JVM callback native sanitizers (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await (combined
			? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)() }
			: { reviewedIr: (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() }
		, hostCallbacks: combined
		, sourceSuffix: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
		, evidenceName: `jvm-callback-sanitizers-${mode}-${combined}-inputs.json`
	});
	const options = { callbackResultAnchors: true, hostCallbacks: combined
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options), files = { ...model.files };
	const fixture = ownedJvmCallbackResultInstalledFixture(model.namespace, combined);
	for(const profile of ["java", "kotlin"])
	{
		const source = fixture.source(profile), ending = /Wire\.finish\([^\n]+\)/gu;
		assert.equal([...source.matchAll(ending)].length, 1);
		files[profile === "java" ? "Consumer.java" : "Consumer.kt"] = source.replace(ending, `${model.namespace}.CallbackSanitizerProbe.done(checks)`);
	}
	files["Wire.java"] = await readFile("tests/fixtures/type-corpus/consumers/Wire.java", "utf8");
	files["CallbackSanitizerProbe.java"] = ownedJvmCallbackSanitizerDriver(model.namespace);
	const loader = Object.keys(files).find(path => path.endsWith("/_OwnedLoader.java"));
	files[loader] = `package ${model.namespace};\nfinal class _OwnedLoader {\n    static _OwnedBindings bindings() { return CallbackSanitizerProbe.bindings; }\n}\n`;
	try
	{
		const tools = await compileOwnedJvmCallSources(compiled.directory, files);
		const run = (library, language, env) => runCopied("/bin/sh", [
			"-c", 'ulimit -c 0\nexec "$@"'
			, "jvm-callback-sanitizers", tools.java, "--enable-native-access=ALL-UNNAMED"
			, "-Xms16m", "-Xmx128m", "-cp", "classes:" + tools.stdlib
			, model.namespace + ".CallbackSanitizerProbe"
			, join(compiled.directory, library), language]
		, compiled.directory, env);
		const observations = [];
		for(const profile of ["java", "kotlin"])
		{
			const result = await run("libprobe.so", profile, { PATH: "/usr/bin:/bin" });
			assert.equal(result.stderr, "");
			const observed = JSON.parse(result.stdout);
			assert.deepEqual(observed, { checks: combined ? 47 : 22, live: 0, identities: 0 });
			observations.push({ profile, observed, execution: result });
		}
		const environment = await compileOwnedJvmCallbackSanitizers(compiled, combined);
		const sanitizedObservations = [];
		for(const { profile, observed } of observations)
		{
			const result = await run("libsanitized.so", profile, environment);
			const sanitized = JSON.parse(result.stdout);
			assert.equal(result.stderr, ""); assert.deepEqual(sanitized, observed);
			sanitizedObservations.push({ profile, observed: sanitized, execution: result });
		}
		const rejected = [];
		for(const [fault, diagnostic] of [["address", /ERROR: AddressSanitizer: heap-buffer-overflow/u]
			, ["undefined", /runtime error: shift exponent 40 is too large/u]]) {
			let execution;
			await assert.rejects(run("libsanitized.so", fault, { ...environment
				, ...fault === "address" ? { UBSAN_OPTIONS: "halt_on_error=0" } : {} }), error => {
				assert.match(error.details?.stderr ?? "", diagnostic);
				assert.doesNotMatch(error.details?.stdout ?? "", /"checks":/u);
				const status = error.message.match(/exited with status (\d+)/u);
				assert.ok(status, "Sanitizer control must exit with a captured failure status");
				execution = { code: Number(status[1]), stdout: error.details.stdout, stderr: error.details.stderr };
				assert.notEqual(execution.code, 0); return true;
				}
			);
			rejected.push({ fault, diagnostic: diagnostic.source, rejected: true, execution });
			}
		const sourceHashes = {};
		for(const path of ["tests/owned-jvm-callback-result-sanitizers.test.mjs"
			, "tests/helpers/owned-jvm-callback-result-sanitizers.mjs"
			, "tests/helpers/owned-jvm-callback-result-installed.mjs"
			, "tests/fixtures/type-corpus/consumers/Wire.java"])
			sourceHashes[path] = sha256(await readFile(path));
		await saveLakeFile("build/owned-jvm-callback-results", `${mode}-${combined ? "combined" : "no-host"}-sanitizers.json`, canonicalJson({
			schemaVersion: 1, mode, combined, actualLean: true, installedPackage: false
			, observations
			, sanitized: { observations: sanitizedObservations, rejected, environment }
			, sourceHashes
			, nativeSanitizers: ["address", "undefined"], leakSanitizer: false
			, leanRuntimeInstrumented: false, jvmInstrumented: false
			, input: native.input
			, generated: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
			, nativeProbeSha256: sha256(native.implementation)
			, driverSha256: sha256(files["CallbackSanitizerProbe.java"])
			, javaProbeSha256: sha256(files["Consumer.java"])
			, kotlinProbeSha256: sha256(files["Consumer.kt"])
			, nativeControlsSha256: sha256(ownedJvmCallbackSanitizerControls)
			, sanitizedSources: ["api.c", "guard.cpp", "sanitizer-controls.c"]
		}));
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
});
