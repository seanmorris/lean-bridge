/**
 * Reconstruct JVM callback lifetime evidence from compiler inputs and raw runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { ownedJvmCallNative } from "./owned-jvm-call-fixture.mjs";
import { ownedJvmCallbackResultProcessSources } from "./owned-jvm-callback-result-process.mjs";
import { ownedJvmCallbackResultInstalledFixture } from "./owned-jvm-callback-result-installed.mjs";
import { ownedJvmCallbackSanitizerControls, ownedJvmCallbackSanitizerDriver } from "./owned-jvm-callback-result-sanitizers.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";

const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
const keys = (value, fields) => assert.deepEqual(Object.keys(value).sort(), fields.split(" ").sort());
const reportFields = {
	gc: "actualGc actualLean compilationLogGzipBase64 compilationSha256 compiler execution generated input installedPackage "
		+ "instrumentedBindingsSha256 instrumentedRuntimeSha256 javaProbeSha256 kotlinProbeSha256 mode mutations nativeProbeSha256 "
		+ "observed optimized restored restoredCompilationLogGzipBase64 restoredCompilationSha256 restoredExecution restoredOptimized schemaVersion sourceHashes"
	, faults: "actualLean execution explicitCleanupWithoutGc generated input installedPackage instrumentedBindingsSha256 "
		+ "instrumentedRuntimeSha256 javaProbeSha256 kotlinProbeSha256 mode nativeProbeSha256 observed schemaVersion sourceHashes"
	, process: "capabilities combined executions generatedFiles guardSha256 input mode nativeSourceSha256 observations probeFiles profile schemaVersion scope sourceHashes"
	, sanitizers: "actualLean combined driverSha256 generated input installedPackage javaProbeSha256 jvmInstrumented kotlinProbeSha256 "
		+ "leakSanitizer leanRuntimeInstrumented mode nativeControlsSha256 nativeProbeSha256 nativeSanitizers observations sanitized sanitizedSources schemaVersion sourceHashes"
};
const file = (model, name) => model.files[Object.keys(model.files).find(path => path.endsWith("/" + name + ".java"))];
const replace = (source, before, after) => {
	assert.equal(source.split(before).length, 2, "Unique evidence instrumentation: " + before);
	return source.replace(before, () => after);
};
const sourcePaths = kind => [
	`tests/owned-jvm-callback-result-${kind}.test.mjs`
	, ...["gc", "faults"].includes(kind) ? [
		`tests/fixtures/structured-types/owned-jvm-callback-result-${kind}.java`
		, `tests/fixtures/structured-types/owned-kotlin-callback-result-${kind}.kt`
	] : [`tests/helpers/owned-jvm-callback-result-${kind}.mjs`
		, ...kind === "sanitizers" ? ["tests/helpers/owned-jvm-callback-result-installed.mjs"
			, "tests/fixtures/type-corpus/consumers/Wire.java"] : []]
];
const capabilities = combined => ({ callbackResultAnchors: true
	, hostCallbacks: combined, transferredInputs: combined
	, anchoredResults: combined, receiverExports: combined });
const execution = (run, observed) => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(run.code, 0); assert.equal(run.stderr, "");
	assert.equal(typeof run.stdout, "string"); assert.deepEqual(JSON.parse(run.stdout), observed);
};
const rejectedExecution = (run, diagnostic) => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(run.code, 1); assert.equal(run.stdout, "");
	assert.equal(typeof run.stderr, "string"); assert.match(run.stderr, diagnostic);
};

const models = new Map();
const inputs = async (item, combined) => {
	const options = capabilities(combined), { metadata, sourceIdentity: identity, component, ...actual } = item.input;
	assert.deepEqual(actual, { hostCallbacks: combined
		, callbackResultAnchors: true, valueCopies: true
		, ...combined ? { transferredInputs: true, anchoredResults: true, receiverExports: true } : {} });
	assert.deepEqual(component, { id: "owned-aggregates@1.0.0", name: "owned-aggregates", version: "1.0.0" });
	assert.equal(Boolean(identity.reviewedBindingIr), item.mode === "reviewed");
	assert.equal(identity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(identity.modules.find(value => value.module === "Owned").source.sha256,
		sha256(lean + (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource)));
	const configuration = item.mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(identity.exportConfigurationSha256, sha256(identity.exportConfigurationSource));
	if(item.mode === "reviewed")
	{
		const ir = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(ir));
		assert.equal(identity.reviewedBindingIr.sourceSha256, sha256(canonicalJson(ir)));
	}
	const key = canonicalJson({ metadata, identity, component, options });
	if(!models.has(key))
	{
		const native = createCompiledNativeModel(item.input, { ownedGraphs: true
			, ownedHostCallbacks: combined
			, ownedInputTransfers: combined, ownedAnchoredResults: combined
			, ownedReceiverExports: combined, ownedCallbackResultAnchors: true });
		assert.equal(native.schemaVersion, 11); assert.equal(native.ownedGraph.schemaVersion, 6);
		assert.equal(native.ownedGraph.callbackResultAnchors.signatures.length, 4);
		for(const key of ["resultAnchors", "inputTransfers", "receiverExports", "hostCallbacks"])
			assert.equal(Boolean(native.ownedGraph[key]), combined, key);
		const model = generateOwnedJvmPackage(native.bindingIr, null, options), probe = ownedJvmCallNative(item.input);
		assert.equal(model.contract.schemaVersion, 5); assert.equal(model.contract.backend, "owned-jvm-v5");
		assert.equal(model.contract.callbackResultAnchors.signatures.length, 4);
		for(const key of ["resultAnchors", "inputTransfers", "receiverExports"])
			assert.equal(Boolean(model.contract[key]), combined, key);
		assert.equal(model.c.header, probe.c.publicHeader);
		models.set(key, { model, probe });
	}
	const result = models.get(key);
	assert.deepEqual(item.generated ?? item.generatedFiles, hashes(result.model.files));
	assert.equal(item.nativeProbeSha256 ?? item.nativeSourceSha256, sha256(result.probe.implementation));
	return result;
};

const attributes = line => Object.fromEntries([...line.matchAll(/([A-Za-z_]+)='([^']*)'/gu)].map(([, key, value]) => [key, value]));
const compilations = new Map();
const compiled = (encoded, hash, namespace, methods) => {
	assert.equal(typeof encoded, "string", "Missing raw HotSpot compilation log");
	const key = canonicalJson({ encodedSha256: sha256(encoded), hash, namespace, methods });
	if(compilations.has(key)) return compilations.get(key);
	const bytes = Buffer.from(encoded, "base64"); assert.equal(bytes.toString("base64"), encoded);
	const text = gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 }).toString("utf8");
	assert.equal(sha256(text), hash);
	assert.match(text, /<hotspot_log [^>]+>/u); assert.match(text, /<\/hotspot_log>/u);
	for(const flag of ["-Xbatch", "-XX:-TieredCompilation", "-XX:CompileThreshold=100", "-XX:+LogCompilation"])
		assert.ok(text.includes(flag), flag);
	const completed = new Map();
	for(const [, head, body] of text.matchAll(/<task ([^\n]+)>\n([\s\S]*?)<\/task>/gu))
		if(/<task_done success='1'/u.test(body))
		{
			const value = attributes(head); completed.set(value.compile_id, value.method);
		}
	const nmethods = text.split("\n").filter(line => line.startsWith("<nmethod "));
	const observed = methods.map(([method, descriptor]) => {
		const identity = namespace + "." + method + " " + descriptor;
		const lines = nmethods.filter(line => {
			const value = attributes(line);
			return value.compiler === "c2" && value.method === identity && Number(value.size) > 0
				&& completed.get(value.compile_id) === identity;
		});
		assert.ok(lines.length > 0, "No completed C2 task and nmethod for " + identity);
		assert.ok(text.includes(`-XX:CompileCommand=dontinline,${namespace}.${method.replace(" ", "::")}`));
		return { method, lines };
	});
	compilations.set(key, observed); return observed;
};

const gc = (item, model) => {
	assert.equal(item.actualGc, true); assert.equal(item.compiler, "c2");
	const stable = { javaChecks: 10551, kotlinChecks: 10551
		, javaOriginals: 2, kotlinOriginals: 2
		, javaReplies: 4, kotlinReplies: 4, publications: 8, live: 0, identities: 0 };
	for(const [run, observed] of [[item.execution, item.observed], [item.restoredExecution, item.restored]])
	{
		const { rounds, ...actual } = observed;
		assert.deepEqual(actual, stable); assert.ok(Number.isSafeInteger(rounds) && rounds >= 4 && rounds < 12000);
		execution(run, observed);
	}
	const callback = model.callbacks.find(value => value.id === model.functions.find(fn => fn.publicName === "callbackRecursive").parameters[1]);
	const index = model.types.find(node => node.id === callback.id).index;
	const result = model.types.find(node => node.id === callback.result).index;
	const runtime = replace(file(model, "_OwnedRuntime"), "value = null; if (acquired) lease.release(cleaning);",
		"value = null; if (acquired) lease.release(cleaning); OwnedCallbackResultGcProbe.released(this);");
	assert.equal(item.instrumentedRuntimeSha256, sha256(runtime));
	let bindings = file(model, "_OwnedBindings");
	for(const family of ["Java", "Kotlin"])
	{
		const start = bindings.indexOf(`    private static int callback${family}${index}(`);
		const end = bindings.indexOf(`    private MemorySegment host${family}${index}(`, start);
		assert.ok(start >= 0 && end > start);
		const before = bindings.slice(start, end), catalog = family === "Java" ? "_OwnedTypes" : "_KotlinOwnedTypes";
		let after = replace(before, `                var converted = _OwnedConvert.write(${catalog}.CATALOG, ${result}, reply.read(replies), replies);`,
			`                var replyValue = reply.read(replies);\n                OwnedCallbackResultGcProbe.beforeReplyWrite();\n                var converted = _OwnedConvert.write(${catalog}.CATALOG, ${result}, replyValue, replies);`);
		after = replace(after, "                _OwnedRuntime.checkpoint(); return 0;",
			"                OwnedCallbackResultGcProbe.afterPublication();\n                _OwnedRuntime.checkpoint(); return 0;");
		bindings = replace(bindings, before, after);
	}
	assert.equal(item.instrumentedBindingsSha256, sha256(bindings));
	const n = model.namespace.replaceAll(".", "/"), value = `L${n}/Value;`, tree = `L${n}/Tree;`, ktTree = `L${n}/kotlin/Tree;`;
	const shared = [["CallbackResult read", `(L${n}/_OwnedConvert$Scope;)Ljava/lang/Object;`]
		, ["_OwnedConvert$Scope whole", `(${value})Ljava/lang/Object;`]];
	const host = family => [`_OwnedBindings callback${family}${index}`, `(L${n}/_OwnedBindings$Host${family}${index};${"Ljava/lang/foreign/MemorySegment;".repeat(5)})I`];
	const java = [host("Java")
		, ["MakeRecursiveResultClosure invoke", `(Z${value})L${n}/TreeValue;`]
		, ["OwnedCallbackResultGcProbe nativeJavaCall", `(L${n}/MakeRecursiveResultClosure;${value})${value}`]
		, ["OwnedCallbackResultGcProbe temporaryJavaReply", `(${tree})L${n}/CallbackResult;`]
		, ["OwnedCallbackResultGcProbe temporaryJavaCall", `(${tree})${value}`]];
	const kotlin = [host("Kotlin")
		, ["_OwnedKotlinMakeRecursiveResultClosure invoke", `(Z${value})L${n}/_OwnedKotlinTreeValue;`]
		, ["KotlinCallbackResultGcProbe nativeCall", `(L${n}/_OwnedKotlinMakeRecursiveResultClosure;${value})${value}`]
		, ["KotlinCallbackResultGcProbe temporaryReply", `(${ktTree})L${n}/CallbackResult;`]
		, ["KotlinCallbackResultGcProbe temporaryCall", `(${ktTree})${value}`]];
	const all = [...shared, ...java, ...kotlin];
	assert.deepEqual(item.optimized, compiled(item.compilationLogGzipBase64, item.compilationSha256, model.namespace, all));
	assert.deepEqual(item.restoredOptimized, compiled(item.restoredCompilationLogGzipBase64, item.restoredCompilationSha256, model.namespace, all));
	const mutant = replace(file(model, "_OwnedConvert"), `            storage(64, 1); checkpoint(); lease.acquire();
            try { roots.add(lease); }
            catch (Throwable error) { lease.release(false); throw error; }`, "            storage(64, 1); checkpoint();");
	assert.equal(item.mutations.length, 2);
	for(const [position, [language, methods]] of [["java", java], ["kotlin", kotlin]].entries())
	{
		const mutation = item.mutations[position];
		keys(mutation, "language compiled semanticRejection execution sourceSha256 compilationSha256 compilationLogGzipBase64 optimized");
		assert.equal(mutation.language, language); assert.equal(mutation.compiled, true); assert.equal(mutation.semanticRejection, true);
		assert.equal(mutation.sourceSha256, sha256(mutant));
		rejectedExecution(mutation.execution, /java\.lang\.AssertionError: temporary whole callback owner remains pinned through reply conversion/u);
		assert.ok(mutation.execution.stderr.includes(`._OwnedBindings.callback${language === "java" ? "Java" : "Kotlin"}${index}(`));
		assert.deepEqual(mutation.optimized, compiled(mutation.compilationLogGzipBase64, mutation.compilationSha256, model.namespace, [...shared, ...methods]));
	}
};

const faults = (item, model) => {
	assert.equal(item.explicitCleanupWithoutGc, true);
	const cases = [
		["native-anchored", [64, 0, 28, 0], [0, 0], [0, 0]]
		, ["host-raw", [143, 0, 90, 0], [54, 51], [32, 25]]
		, ["host-whole", [144, 0, 90, 0], [55, 51], [32, 25]]
		, ["receiver-whole-recovery", [66, 83, 19, 68], [55, 51], [32, 25]]
	];
	const observed = { checks: 11263, live: 0, identities: 0
		, cases: ["java", "kotlin"].flatMap(language => cases.map(([name, faults, enteredFaults, publishedFaults]) => ({
			language, case: name, faults, enteredFaults, publishedFaults
			, returnedFaults: [31, 0], successes: [1, 1]
		})))
	};
	assert.deepEqual(item.observed, observed); execution(item.execution, observed);
	assert.equal(observed.cases.flatMap(row => row.faults).reduce((sum, count) => sum + count, 0), 1590);
	assert.equal(item.instrumentedRuntimeSha256, sha256(replace(file(model, "_OwnedRuntime"), "static void checkpoint() { }",
		"static void checkpoint() { OwnedCallbackResultFaultProbe.allocation(); }")));
	const publication = "                _OwnedRuntime.checkpoint(); return 0;", returned = "            ready();\n            var result =";
	const bindings = file(model, "_OwnedBindings");
	assert.equal(bindings.split(publication).length - 1, model.callbacks.length * 2);
	assert.equal(bindings.split(returned).length - 1, model.calls.length * 2);
	assert.equal(item.instrumentedBindingsSha256, sha256(bindings.replaceAll(publication, "                OwnedCallbackResultFaultProbe.published();\n" + publication)
		.replaceAll(returned, "            OwnedCallbackResultFaultProbe.returned();\n" + returned)));
};

const process = (item, model, probe, combined) => {
	assert.deepEqual(item.capabilities, capabilities(combined)); assert.equal(item.profile, combined ? "combined" : "no-host");
	assert.deepEqual(item.scope, { java: true, kotlin: true
		, creatorThreadAffinity: true, nativeThreadExit: true
		, stronglyReachableOwners: true, runtimeRetirementDuringCallback: combined
		, rawAndWholeCallbackReplies: combined, normalSessionCleanup: true
		, installedMaven: false, fork: false });
	const files = ownedJvmCallbackResultProcessSources(model, combined);
	assert.deepEqual(item.probeFiles, hashes(Object.fromEntries(Object.entries(files).filter(([path, source]) => model.files[path] !== source))));
	assert.equal(item.guardSha256, sha256(probe.cleanup.guardSource));
	const observations = ["threads", ...combined ? ["java-raw", "java-whole", "kotlin-raw", "kotlin-whole"] : []]
		.map(mode => ({ mode, checks: mode === "threads" ? 27 : 6
			, live: 0, identities: 0
			, threadExits: mode === "threads" ? 2 : 0, threadExitErrors: 0 }));
	assert.deepEqual(item.observations, observations);
	assert.equal(item.executions.length, observations.length);
	item.executions.forEach((run, index) => execution(run, observations[index]));
};

const sanitizers = (item, model, combined) => {
	keys(item.sanitized, "observations rejected environment");
	const fixture = ownedJvmCallbackResultInstalledFixture(model.namespace, combined);
	for(const profile of ["java", "kotlin"])
	{
		const source = fixture.source(profile), ending = /Wire\.finish\([^\n]+\)/gu;
		assert.equal([...source.matchAll(ending)].length, 1);
		assert.equal(item[profile + "ProbeSha256"], sha256(source.replace(ending, `${model.namespace}.CallbackSanitizerProbe.done(checks)`)));
	}
	assert.equal(item.driverSha256, sha256(ownedJvmCallbackSanitizerDriver(model.namespace)));
	assert.equal(item.nativeControlsSha256, sha256(ownedJvmCallbackSanitizerControls));
	assert.deepEqual(item.sanitizedSources, ["api.c", "guard.cpp", "sanitizer-controls.c"]);
	assert.deepEqual(item.nativeSanitizers, ["address", "undefined"]);
	for(const key of ["leakSanitizer", "leanRuntimeInstrumented", "jvmInstrumented"]) assert.equal(item[key], false);
	const observations = ["java", "kotlin"].map(profile => ({ profile, observed: { checks: combined ? 47 : 22, live: 0, identities: 0 } }));
	for(const rows of [item.observations, item.sanitized.observations])
	{
		assert.equal(rows.length, 2);
		rows.forEach((row, index) => {
			assert.deepEqual(Object.keys(row).sort(), ["execution", "observed", "profile"]);
			assert.equal(row.profile, observations[index].profile);
			assert.deepEqual(row.observed, observations[index].observed);
			execution(row.execution, row.observed);
		});
	}
	const { LD_PRELOAD, ...environment } = item.sanitized.environment;
	assert.match(LD_PRELOAD, /^\/[^:]+\/libasan\.so:\/[^:]+\/libubsan\.so$/u);
	assert.deepEqual(environment, { PATH: "/usr/bin:/bin"
		, ASAN_OPTIONS: "detect_leaks=0:halt_on_error=1:intercept_tls_get_addr=0:handle_segv=0:use_sigaltstack=0"
		, UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" });
	const controls = [["address", "ERROR: AddressSanitizer: heap-buffer-overflow"]
		, ["undefined", "runtime error: shift exponent 40 is too large"]];
	assert.equal(item.sanitized.rejected.length, 2);
	for(const [index, [fault, diagnostic]] of controls.entries())
	{
		const actual = item.sanitized.rejected[index];
		keys(actual, "fault diagnostic rejected execution");
		assert.equal(actual.fault, fault); assert.equal(actual.diagnostic, diagnostic); assert.equal(actual.rejected, true);
		rejectedExecution(actual.execution, new RegExp(diagnostic, "u"));
		assert.match(actual.execution.stderr, fault === "address" ? /probe_address/u : /probe_undefined/u);
	}
};

/**
 * Authenticate one exact producer report; no builds or native execution occur.
 *
 * @param kind - Report kind: gc, faults, process, or sanitizers.
 * @param name - Exact report basename.
 * @param item - Parsed producer report, including raw execution evidence.
 */
export const assertOwnedJvmCallbackLifetimeEvidence = async (kind, name, item) => {
	assert.ok(["gc", "faults", "process", "sanitizers"].includes(kind));
	keys(item, reportFields[kind]);
	const pattern = ["gc", "faults"].includes(kind) ? /^(ordinary|reviewed)\.json$/u
		: kind === "process" ? /^(ordinary|reviewed)(-no-host)?-process\.json$/u
			: /^(ordinary|reviewed)-(no-host|combined)-sanitizers\.json$/u;
	const match = pattern.exec(name); assert.ok(match, "Unexpected lifetime report " + name);
	assert.equal(item.schemaVersion, 1); assert.equal(item.mode, match[1]);
	const combined = ["gc", "faults"].includes(kind) || (kind === "process" ? !match[2] : match[2] === "combined");
	if(["process", "sanitizers"].includes(kind)) assert.equal(item.combined, combined);
	if(kind !== "process")
	{
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	}
	const sources = Object.fromEntries(await Promise.all(sourcePaths(kind).map(async path => [path, sha256(await readFile(path))])));
	assert.deepEqual(item.sourceHashes, sources);
	const { model, probe } = await inputs(item, combined);
	if(["gc", "faults"].includes(kind))
	{
		assert.equal(item.javaProbeSha256, sources[`tests/fixtures/structured-types/owned-jvm-callback-result-${kind}.java`]);
		assert.equal(item.kotlinProbeSha256, sources[`tests/fixtures/structured-types/owned-kotlin-callback-result-${kind}.kt`]);
		(kind === "gc" ? gc : faults)(item, model);
	}
	else if(kind === "process") process(item, model, probe, combined);
	else sanitizers(item, model, combined);
};
