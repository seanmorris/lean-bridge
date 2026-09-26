/**
 * Build original Lean and independently reviewed signatures through real WIT.
 * This is transport acceptance, not an installed-package promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { readVerifiedNativeComponent } from "../src/build/native-artifacts.mjs";
import { nativeGraphProjectionSources } from "../src/build/native-graph-sources.mjs";
import { generateNativeCallableGraphCalls } from "../src/backends/c/native-callable-graph-calls.mjs";
import { compileCallableWitGraphModel } from "../src/backends/wit/callable-graph-model.mjs";
import { renderWitGraphCallableHostHeader, renderWitGraphCallableHostSource } from "../src/backends/wit/callable-graph-host.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { nativeRecursiveCallableReviewedIr, nativeRecursiveCallableSource, nativeRecursiveCallableExports, nativeRecursiveCallableArities } from "./helpers/native-recursive-callable-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { witRecursiveCallableValues } from "./helpers/wit-recursive-callable-values.mjs";

const sanitizerFlags = ["-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-sanitize-recover=all", "-no-pie"];
const sanitizerCheck = async (command, root, directory, environment, expected) => {
	// Lean's numeric startup constants also appear in native C acceptance. Keep
	// the entire cold report and reject any additional allocation or diagnostic.
	const sanitizerEnvironment = { ...environment
		, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1"
		, LSAN_OPTIONS: "exitcode=0", UBSAN_OPTIONS: "halt_on_error=1" };
	const startup = await runCopied(command, [], root, { ...sanitizerEnvironment, LEAN_BRIDGE_WIT_PROBE_COLD_ONLY: "1" });
	assert.deepEqual(JSON.parse(startup.stdout), { cold: true });
	const sanitized = await runCopied(command, [], root, sanitizerEnvironment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.equal(normalize(sanitized.stderr), normalize(startup.stderr), "Recursive WIT calls changed the cold-session leak report");
	assert.doesNotMatch(sanitized.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const leak = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked in (\d+) allocation\(s\)/u.exec(startup.stderr);
	if(startup.stderr)
	{ assert.ok(leak, startup.stderr); assert.match(startup.stderr, /__gmp_default_allocate/u); }
	assert.deepEqual(JSON.parse(sanitized.stdout), expected);
	return { sanitized: JSON.parse(sanitized.stdout)
		, sanitizerFlags
		, sanitizerEnvironment: { ASAN_OPTIONS: sanitizerEnvironment.ASAN_OPTIONS
			, LSAN_OPTIONS: sanitizerEnvironment.LSAN_OPTIONS
			, UBSAN_OPTIONS: sanitizerEnvironment.UBSAN_OPTIONS }
		, sanitizerRuns: { cold: { stdout: startup.stdout, stderr: normalize(startup.stderr).replaceAll(directory, "<probes>") }
			, exercised: { stdout: sanitized.stdout, stderr: normalize(sanitized.stderr).replaceAll(directory, "<probes>") } }
		, startupLeakBaseline: { bytes: Number(leak?.[1] ?? 0)
			, allocations: Number(leak?.[2] ?? 0), unchangedAfterCalls: true
			, report: normalize(startup.stderr).replaceAll(directory, "<probes>") } };
};

test("recursive WIT callbacks and closures execute compiled Lean on both source paths", { skip: process.env.LEAN_BRIDGE_WIT_RECURSIVE_CALLABLE_TEST !== "1", timeout: 900_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-recursive-native-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = nativeFixtureEnvironment(["wit-wasi"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const sdk = join(directory, "wasmtime"); await snapshotWasmtimeCapi(environment.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	const original = await nativeRecursiveCallableSource(), reviewedIr = nativeRecursiveCallableReviewedIr(), observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), project = join(root, "project");
		await saveLakeFile(project, "Structured.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "structured"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Structured"\n');
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Structured"]
			, ...reviewed ? {} : { exports: nativeRecursiveCallableExports
				, arities: nativeRecursiveCallableArities } }));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const compiled = await buildNativeComponent({ projectRoot: project, outputRoot: join(root, "component"), runtimeRoot: runtime.root, leanPrefix: prefix, targets: ["c"], copiedGraphs: true });
		const { model, receipt } = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		const wit = compileCallableWitGraphModel(model.bindingIr);
		const native = generateNativeCallableGraphCalls(model.bindingIr, model.copiedGraph, { initializer: receipt.initializer });
		assert.deepEqual(wit.layout, native.layout);
		assert.equal(wit.functions.length, 33); assert.equal(wit.callbacks.size, 18);
		for(const [path, source] of Object.entries(nativeGraphProjectionSources(model, receipt)))
			await saveLakeFile(root, path.replace(/^include\/detail\/|^src\//u, ""), source);
		await saveLakeFile(root, "component.h", await readFile(join(compiled.root, "component.h")));
		await saveLakeFile(root, "component.wit", wit.wit); await saveLakeFile(root, "component.wat", wit.wat);
		await runCopied("wasm-tools", ["parse", "component.wat", "-o", "component.wasm"], root, environment);
		await runCopied("wasm-tools", ["validate", "--features", "component-model", "component.wasm"], root, environment);
		const component = await readFile(join(root, "component.wasm")), host = renderWitGraphCallableHostSource(wit, component);
		await saveLakeFile(root, "structured_wasmtime.h", renderWitGraphCallableHostHeader(wit));
		await saveLakeFile(root, "host.c", host);
		const tree = wit.nodes.find(node => node.ref.id === "lean:Structured.Tree");
		const callback = wit.functions.find(fn => fn.field === "call_recursive").parameters[1];
		const owned = wit.functions.find(fn => fn.field === "make_recursive").result;
		const bindings = `#define fixture_encode lb_graph_encode_${tree.index}\n#define fixture_decode lb_graph_decode_${tree.index}\n#define fixture_direct_callback lb_graph_callback_${wit.wire.resources.indexOf(callback.resource) + 1}\nstatic const char fixture_callback_name[] = ${JSON.stringify(callback.resource.witName)};\nstatic const char fixture_owned_invoke[] = ${JSON.stringify("invoke-" + owned.resource.witName)};`;
		const consumer = (await readFile("tests/fixtures/structured-callable-consumers/wit-recursive-native.c", "utf8")).replace("/* GENERATED_BINDINGS */", bindings);
		await saveLakeFile(root, "consumer.c", consumer);
		const flags = ["-std=c11", "-O1", "-g0", "-Wall", "-Wextra", "-Werror"
			, "-UNDEBUG", "-pthread", "-I", join(runtime.root, "include")
			, "-I", join(sdk, "include"), "native.c", "consumer.c"
			, "-L", compiled.root, "-L", join(runtime.root, "lib")
			, "-L", join(sdk, "lib"), `-l:${receipt.library}`
			, "-llean_bridge_native", "-lleanshared", "-lwasmtime"
			, "-Wl,--no-undefined"
			, `-Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}:${join(sdk, "lib")}`];
		await runCopied("cc", [...flags, "-o", "consumer"], root, environment);
		const normal = await runCopied(join(root, "consumer"), [], root);
		assert.equal(normal.stderr, "");
		const observed = JSON.parse(normal.stdout);
		assert.deepEqual(observed, { callbacks: 6, releases: 1, nativeIdentities: 0, recursive: true, owned: true, recovery: true, activeClose: true, wrongThread: true, expiredContexts: true, independentResult: true });
		await runCopied("cc", [...flags, ...sanitizerFlags, "-o", "sanitized"], root, environment);
		const sanitized = await sanitizerCheck(join(root, "sanitized"), root, directory, environment, observed);
		const typedBindings = `#define fixture_callback_create ${wit.prefix}_wasmtime_callback_${callback.publicName.slice(wit.prefix.length + 1)}_create\n#define fixture_owned_call ${wit.prefix}_wasmtime_function_${owned.publicName.slice(wit.prefix.length + 1)}_call`;
		const typedSource = (await readFile("tests/fixtures/structured-callable-consumers/wit-recursive-typed.c", "utf8")).replace("/* GENERATED_BINDINGS */", typedBindings);
		await saveLakeFile(root, "typed.c", typedSource);
		const typedFlags = flags.flatMap(flag => flag === "consumer.c" ? ["host.c", "typed.c"] : [flag]);
		await runCopied("cc", [...typedFlags, "-o", "typed"], root, environment);
		const typed = await runCopied(join(root, "typed"), [], root);
		assert.equal(typed.stderr, "");
		const typedObserved = JSON.parse(typed.stdout);
		assert.deepEqual(typedObserved, { typed: true, callbacks: 4, releases: 1, owned: true, activeClose: true, independentResult: true });
		await runCopied("cc", [...typedFlags, ...sanitizerFlags, "-o", "typed-sanitized"], root, environment);
		const typedSanitized = await sanitizerCheck(join(root, "typed-sanitized"), root, directory, environment, typedObserved);
		const valuesSource = witRecursiveCallableValues(wit);
		await saveLakeFile(root, "values.c", valuesSource);
		const valuesFlags = typedFlags.map(flag => flag === "typed.c" ? "values.c" : flag);
		await runCopied("cc", [...valuesFlags, "-o", "values"], root, environment);
		const values = await runCopied(join(root, "values"), [], root);
		assert.equal(values.stderr, ""); const valuesObserved = JSON.parse(values.stdout);
		assert.equal(valuesObserved.shapes, 9); assert.equal(valuesObserved.aliases, 2);
		assert.equal(valuesObserved.callbacks, 758); assert.equal(valuesObserved.rejections, 540);
		await runCopied("cc", [...valuesFlags, ...sanitizerFlags, "-o", "values-sanitized"], root, environment);
		const valuesSanitized = await sanitizerCheck(join(root, "values-sanitized"), root, directory, environment, valuesObserved);
		observations.push({ path: reviewed ? "reviewed-ir" : "ordinary-source"
			, model, receipt
			, metadata: JSON.parse(await readFile(join(compiled.root, "metadata.json"), "utf8"))
			, componentBase64: component.toString("base64")
			, observed
			, ...sanitized
			, typed: { observed: typedObserved
				, ...typedSanitized
				, sourceSha256: sha256(typedSource)
				, executableSha256: sha256(await readFile(join(root, "typed"))) }
			, values: { observed: valuesObserved
				, ...valuesSanitized
				, sourceSha256: sha256(valuesSource)
				, executableSha256: sha256(await readFile(join(root, "values"))) }
			, bindingIrSha256: wit.manifest.bindingIrSha256
			, runtimeIdentity: runtime.identity, componentSha256: sha256(component)
			, nativeLibrarySha256: sha256(await readFile(join(compiled.root, receipt.library)))
			, hostSourceSha256: sha256(host), consumerSourceSha256: sha256(consumer)
			, executableSha256: sha256(await readFile(join(root, "consumer"))) });
		t.diagnostic(`${reviewed ? "reviewed-ir" : "ordinary-source"}: ${JSON.stringify(observed)}`);
	}
	await saveLakeFile(resolve("build/recursive-callables"), "wit-native.json", canonicalJson({ schemaVersion: 1, installedPackage: false, observations }));
});
