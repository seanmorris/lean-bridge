/**
 * Collect nominal receiver owners with optimized Java and Kotlin member calls.
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
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

/**
 * Retain the actual optimizing-compiler observations for each required method.
 *
 * @param compilation - HotSpot compilation log from this process.
 * @param namespace - Generated Java package name.
 * @param methods - Required receiver methods and callers.
 */
const optimizingCompilations = (compilation, namespace, methods) => methods.map(method => {
	const lines = compilation.split("\n").filter(line => line.startsWith("<nmethod ") && line.includes("compiler='c2'")
		&& line.includes("method='" + namespace + "." + method + " "));
	assert.ok(lines.length > 0, `No optimizing compilation for ${method}`);
	return { method, lines };
});

for(const mode of ["ordinary", "reviewed"]) test(`optimized JVM nominal receiver GC (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_RECEIVER_GC_TEST !== "1"
	, timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustReceiverConfiguration() }
			: { reviewedIr: ownedRustReceiverReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `jvm-receiver-gc-${mode}-inputs.json`
	});
	const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options);
	const files = { ...model.files };
	const loader = Object.keys(files).find(path => path.endsWith("/_OwnedLoader.java"));
	files[loader] = `package ${model.namespace};
final class _OwnedLoader {
    static _OwnedBindings bindings() { return OwnedReceiverGcProbe.bindings; }
}
`;
	files["OwnedReceiverGcProbe.java"] = await readFile("tests/fixtures/structured-types/owned-jvm-receiver-gc.java", "utf8");
	files["KotlinReceiverGcProbe.kt"] = await readFile("tests/fixtures/structured-types/owned-kotlin-receiver-gc.kt", "utf8");
	const bindings = Object.keys(files).find(path => path.endsWith("/_OwnedBindings.java"));
	const serial = model.functions.findIndex(fn => fn.publicName === "serial");
	assert.ok(serial >= 0);
	for(const family of ["Java", "Kotlin"])
	{
		const head = new RegExp(`(call${family}${serial}\\([^\\n]*\\) \\{\\n)`, "gu");
		assert.equal([...files[bindings].matchAll(head)].length, 1);
		files[bindings] = files[bindings].replace(head, "$1        OwnedReceiverGcProbe.beforeScalarCall();\n");
	}
	const tools = await compileOwnedJvmCallSources(compiled.directory, files);
	const args = ["--enable-native-access=ALL-UNNAMED"
		, "-Xbatch", "-XX:-TieredCompilation", "-XX:CompileThreshold=100"
		, "-XX:CompileCommand=quiet"
		, ...["TicketValue::getSerial", "_OwnedKotlinTicketValue::getSerial"
			, "OwnedReceiverGcProbe::ephemeralJava", "KotlinReceiverGcProbe::ephemeral"]
			.map(method => `-XX:CompileCommand=dontinline,${model.namespace}.${method}`)
		, "-XX:+UnlockDiagnosticVMOptions", "-XX:+LogCompilation"
		, "-XX:LogFile=receiver-gc.xml", "-Xmx128m"
		, "-cp", "classes:" + tools.stdlib, model.namespace + ".OwnedReceiverGcProbe"
		, join(compiled.directory, "libprobe.so")];
	const result = await runCopied(tools.java, args, compiled.directory);
	assert.equal(result.stderr, "");
	const observed = JSON.parse(result.stdout);
	assert.ok(observed.javaChecks > 10000); assert.ok(observed.kotlinChecks > 10000);
	assert.equal(observed.javaCollected, 8); assert.equal(observed.kotlinCollected, 8);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.equal(observed.duringCalls, 100);
	assert.ok(Number.isSafeInteger(observed.rounds) && observed.rounds >= 126 && observed.rounds < 9711);
	const compilation = await readFile(join(compiled.directory, "receiver-gc.xml"), "utf8");
	const methods = ["TicketValue getSerial", "BundleValue getPayload"
		, "_OwnedKotlinTicketValue getSerial", "_OwnedKotlinBundleValue getPayload"
		, "OwnedReceiverGcProbe ephemeralJava", "KotlinReceiverGcProbe ephemeral"];
	const optimized = optimizingCompilations(compilation, model.namespace, methods);
	const mutations = [], fence = "finally { java.lang.ref.Reference.reachabilityFence(this); }";
	for(const owner of ["TicketValue", "_OwnedKotlinTicketValue"])
	{
		const path = Object.keys(files).find(path => path.endsWith("/" + owner + ".java"));
		assert.ok(files[path].includes(fence));
		const source = files[path].replaceAll(fence, "finally { }");
		await compileOwnedJvmCallSources(compiled.directory, { ...files, [path]: source });
		await assert.rejects(runCopied(tools.java, args, compiled.directory), error => {
			assert.match(error.details?.stderr ?? "", /receiver owner survives an optimized getter call/u);
			assert.ok(error.details.stderr.includes(model.namespace + "." + owner + ".getSerial"));
			return true;
		}, `Missing ${owner} fences must fail after optimizing compilation`);
		const mutantCompilation = await readFile(join(compiled.directory, "receiver-gc.xml"), "utf8");
		const optimized = optimizingCompilations(mutantCompilation, model.namespace, [owner + " getSerial"
			, owner === "TicketValue" ? "OwnedReceiverGcProbe ephemeralJava" : "KotlinReceiverGcProbe ephemeral"]);
		mutations.push({ owner, path, sourceSha256: sha256(source)
			, compiled: true, semanticRejection: true
			, compilationSha256: sha256(mutantCompilation), optimized });
	}
	await compileOwnedJvmCallSources(compiled.directory, files);
	const restoredRun = await runCopied(tools.java, args, compiled.directory);
	assert.equal(restoredRun.stderr, "");
	const restored = JSON.parse(restoredRun.stdout), { rounds: originalRounds, ...stable } = observed;
	const { rounds: restoredRounds, ...stableRestored } = restored;
	assert.deepEqual(stableRestored, stable); assert.ok(restoredRounds >= 126 && originalRounds >= 126);
	await saveLakeFile("build/owned-jvm-receiver-gc", mode + ".json", canonicalJson({
		schemaVersion: 1, mode, actualLean: true, actualGc: true
		, installedPackage: false
		, input: native.input, observed, restored
		, optimizedMethods: methods, optimized
		, compiler: "c2", compilationSha256: sha256(compilation)
		, missingFencesRejected: true
		, mutations
		, instrumentedBindingsSha256: sha256(files[bindings])
		, javaProbeSha256: sha256(files["OwnedReceiverGcProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinReceiverGcProbe.kt"])
		, nativeProbeSha256: sha256(native.implementation)
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)]))
	}));
	t.diagnostic(JSON.stringify({ mode, ...observed, optimizedMethods: methods }));
});
