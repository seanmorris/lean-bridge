/**
 * Collect callback owners while optimized Java/Kotlin reply conversion pins leases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

/**
 * Keep the test-only collection seam narrow and fail if generated code changes.
 *
 * @param source - Generated source.
 * @param before - Unique source fragment.
 * @param after - Instrumented replacement.
 */
const replaceOnce = (source, before, after) => {
	assert.equal(source.split(before).length, 2, "Missing or ambiguous callback GC instrumentation: " + before);
	return source.replace(before, () => after);
};
/**
 * Preserve successful C2 compilations, not requests or unrelated hot methods.
 *
 * @param compilation - HotSpot compilation log from this process.
 * @param namespace - Generated package name.
 * @param methods - Exact callback, reply, and caller method names.
 */
const optimizedMethods = (compilation, namespace, methods) => methods.map(method => {
	const lines = compilation.split("\n").filter(line => line.startsWith("<nmethod ") && line.includes("compiler='c2'")
		&& line.includes("method='" + namespace + "." + method + " "));
	assert.ok(lines.length > 0, "Missing successful C2 compilation for " + method);
	return { method, lines };
});

for(const mode of ["ordinary", "reviewed"]) test(`optimized JVM callback-result GC (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedDotnetCallbackResultCombinedConfiguration() }
			: { reviewedIr: ownedDotnetCallbackResultCombinedReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedDotnetCallbackResultCombinedSource
		, evidenceName: `jvm-callback-result-gc-${mode}-inputs.json`
	});
	const options = { callbackResultAnchors: true, hostCallbacks: true
		, transferredInputs: true, anchoredResults: true, receiverExports: true };
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options), files = { ...model.files };
	const path = name => Object.keys(files).find(path => path.endsWith("/" + name + ".java"));
	const runtime = path("_OwnedRuntime"), bindings = path("_OwnedBindings"), conversions = path("_OwnedConvert");
	const fn = model.functions.find(fn => fn.publicName === "callbackRecursive");
	const callback = model.callbacks.find(callback => callback.id === fn.parameters[1]);
	const index = model.types.find(node => node.id === callback.id).index;
	const result = model.types.find(node => node.id === callback.result).index;
	files[runtime] = replaceOnce(files[runtime], "value = null; if (acquired) lease.release(cleaning);",
		"value = null; if (acquired) lease.release(cleaning); OwnedCallbackResultGcProbe.released(this);");
	for(const family of ["Java", "Kotlin"])
	{
		const start = files[bindings].indexOf(`    private static int callback${family}${index}(`);
		const end = files[bindings].indexOf(`    private MemorySegment host${family}${index}(`, start);
		assert.ok(start >= 0 && end > start);
		const before = files[bindings].slice(start, end), catalog = family === "Java" ? "_OwnedTypes" : "_KotlinOwnedTypes";
		const write = `                var converted = _OwnedConvert.write(${catalog}.CATALOG, ${result}, reply.read(replies), replies);`;
		let after = replaceOnce(before, write, `                var replyValue = reply.read(replies);
                OwnedCallbackResultGcProbe.beforeReplyWrite();
                var converted = _OwnedConvert.write(${catalog}.CATALOG, ${result}, replyValue, replies);`);
		after = replaceOnce(after, "                _OwnedRuntime.checkpoint(); return 0;",
			"                OwnedCallbackResultGcProbe.afterPublication();\n                _OwnedRuntime.checkpoint(); return 0;");
		files[bindings] = replaceOnce(files[bindings], before, after);
	}
	files[path("_OwnedLoader")] = `package ${model.namespace};
final class _OwnedLoader {
    static _OwnedBindings bindings() { return OwnedCallbackResultGcProbe.bindings; }
}
`;
	files["OwnedCallbackResultGcProbe.java"] = await readFile("tests/fixtures/structured-types/owned-jvm-callback-result-gc.java", "utf8");
	files["KotlinCallbackResultGcProbe.kt"] = await readFile("tests/fixtures/structured-types/owned-kotlin-callback-result-gc.kt", "utf8");
	const shared = ["CallbackResult read", "_OwnedConvert$Scope whole"];
	const java = [`_OwnedBindings callbackJava${index}`
		, "MakeRecursiveResultClosure invoke"
		, "OwnedCallbackResultGcProbe nativeJavaCall"
		, "OwnedCallbackResultGcProbe temporaryJavaReply"
		, "OwnedCallbackResultGcProbe temporaryJavaCall"];
	const kotlin = [`_OwnedBindings callbackKotlin${index}`
		, "_OwnedKotlinMakeRecursiveResultClosure invoke"
		, "KotlinCallbackResultGcProbe nativeCall"
		, "KotlinCallbackResultGcProbe temporaryReply"
		, "KotlinCallbackResultGcProbe temporaryCall"];
	const methods = [...shared, ...java, ...kotlin];
	const tools = await compileOwnedJvmCallSources(compiled.directory, files);
	const args = ["--enable-native-access=ALL-UNNAMED"
		, "-Xbatch"
		, "-XX:-TieredCompilation"
		, "-XX:CompileThreshold=100", "-XX:CompileCommand=quiet"
		, ...[...methods, "OwnedCallbackResultGcProbe beforeReplyWrite", "OwnedCallbackResultGcProbe afterPublication"]
			.map(method => `-XX:CompileCommand=dontinline,${model.namespace}.${method.replace(" ", "::")}`)
		, "-XX:+UnlockDiagnosticVMOptions", "-XX:+LogCompilation"
		, "-XX:LogFile=callback-result-gc.xml", "-Xmx128m"
		, "-cp"
		, "classes:" + tools.stdlib
		, model.namespace + ".OwnedCallbackResultGcProbe"
		, join(compiled.directory, "libprobe.so")];
	let run;
	try
	{
		run = await runCopied(tools.java, args, compiled.directory);
	}
	catch(error)
	{
		throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error });
	}
	assert.equal(run.stderr, "");
	const observed = JSON.parse(run.stdout);
	assert.ok(observed.javaChecks > 10000 && observed.kotlinChecks > 10000);
	assert.equal(observed.javaOriginals, 2); assert.equal(observed.kotlinOriginals, 2);
	assert.equal(observed.javaReplies, 4); assert.equal(observed.kotlinReplies, 4);
	assert.equal(observed.publications, 8);
	assert.ok(Number.isSafeInteger(observed.rounds) && observed.rounds >= 4 && observed.rounds < 12000);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	const compilation = await readFile(join(compiled.directory, "callback-result-gc.xml"), "utf8");
	const optimized = optimizedMethods(compilation, model.namespace, methods);
	const pins = `            storage(64, 1); checkpoint(); lease.acquire();
            try { roots.add(lease); }
            catch (Throwable error) { lease.release(false); throw error; }`;
	const mutant = replaceOnce(files[conversions], pins, "            storage(64, 1); checkpoint();");
	await compileOwnedJvmCallSources(compiled.directory, { ...files, [conversions]: mutant });
	const mutations = [];
	for(const [language, selected] of [["java", java], ["kotlin", kotlin]])
	{
		let execution;
		await assert.rejects(runCopied(tools.java, [...args, language], compiled.directory), error => {
			assert.match(error.details?.stderr ?? "", /temporary whole callback owner remains pinned through reply conversion/u);
			const exit = /exited with status (\d+)/u.exec(error.message);
			assert.ok(exit);
			execution = { code: Number(exit[1]), stdout: error.details.stdout, stderr: error.details.stderr };
			return true;
		}, `Missing whole-reply pin must fail for ${language}`);
		const compilation = await readFile(join(compiled.directory, "callback-result-gc.xml"), "utf8");
		mutations.push({ language, compiled: true, semanticRejection: true, execution
			, sourceSha256: sha256(mutant), compilationSha256: sha256(compilation)
			, compilationLogGzipBase64: gzipSync(compilation).toString("base64")
			, optimized: optimizedMethods(compilation, model.namespace, [...shared, ...selected]) });
	}
	await compileOwnedJvmCallSources(compiled.directory, files);
	const restoredRun = await runCopied(tools.java, args, compiled.directory);
	assert.equal(restoredRun.stderr, "");
	const restored = JSON.parse(restoredRun.stdout), { rounds: originalRounds, ...stable } = observed;
	const { rounds: restoredRounds, ...stableRestored } = restored;
	assert.deepEqual(stableRestored, stable);
	assert.ok(restoredRounds >= 4 && originalRounds >= 4 && restoredRounds < 12000);
	const restoredCompilation = await readFile(join(compiled.directory, "callback-result-gc.xml"), "utf8");
	const restoredOptimized = optimizedMethods(restoredCompilation, model.namespace, methods);
	await saveLakeFile("build/owned-jvm-callback-result-gc", mode + ".json", canonicalJson({
		schemaVersion: 1
		, mode
		, actualLean: true
		, actualGc: true
		, installedPackage: false
		, input: native.input, observed, restored, compiler: "c2"
		, execution: run, restoredExecution: restoredRun
		, optimized, restoredOptimized, mutations
		, compilationSha256: sha256(compilation)
		, compilationLogGzipBase64: gzipSync(compilation).toString("base64")
		, restoredCompilationSha256: sha256(restoredCompilation)
		, restoredCompilationLogGzipBase64: gzipSync(restoredCompilation).toString("base64")
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
		, instrumentedRuntimeSha256: sha256(files[runtime])
		, instrumentedBindingsSha256: sha256(files[bindings])
		, javaProbeSha256: sha256(files["OwnedCallbackResultGcProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinCallbackResultGcProbe.kt"])
		, nativeProbeSha256: sha256(native.implementation)
		, sourceHashes: Object.fromEntries(await Promise.all([
			"tests/owned-jvm-callback-result-gc.test.mjs"
			, "tests/fixtures/structured-types/owned-jvm-callback-result-gc.java"
			, "tests/fixtures/structured-types/owned-kotlin-callback-result-gc.kt"
		].map(async path => [path, sha256(await readFile(path))])))
	}));
	t.diagnostic(JSON.stringify({ mode, ...observed, optimizedMethods: methods }));
});
