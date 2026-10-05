/**
 * Execute original and independently reviewed Lean contracts through WIT.
 * These fresh component builds are transport evidence, not installed packages.
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
import { nativeGraphCarrierAbi } from "../src/build/native-graph-model.mjs";
import { generateNativeCopiedGraphAdapters } from "../src/backends/c/native-graph-adapters.mjs";
import { compileCopiedWitGraphModel } from "../src/backends/wit/copied-graph-model.mjs";
import { renderWitGraphHostHeader, renderWitGraphHostSource } from "../src/backends/wit/copied-graph-host.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./helpers/native-recursive-transport.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("recursive WIT calls real Lean through the Component Model on both authoring paths", { skip: process.env.LEAN_BRIDGE_WIT_GRAPH_NATIVE_TEST !== "1", timeout: 900_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-native-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = nativeFixtureEnvironment(["wit-wasi"]), prefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtime = await buildNativeSharedRuntime({ outputRoot: join(directory, "runtime"), leanPrefix: prefix });
	const sdk = join(directory, "wasmtime");
	await snapshotWasmtimeCapi(environment.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr(), observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), project = join(root, "project");
		await saveLakeFile(project, "Recursive.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Recursive"], ...reviewed ? {} : { exports: reviewedIr.declarations.map(item => item.source.declaration) } }));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		// Build the already-admitted native carrier; the WIT package target remains
		// unavailable until packaging and installed acceptance have their own gates.
		const compiled = await buildNativeComponent({ projectRoot: project, outputRoot: join(root, "component"), runtimeRoot: runtime.root, leanPrefix: prefix, targets: ["c"], copiedGraphs: true });
		const { model, receipt } = await readVerifiedNativeComponent(compiled.root, runtime.identity, { copiedGraphs: true });
		assert.equal(model.schemaVersion, reviewed ? 5 : 4);
		const native = generateNativeCopiedGraphAdapters(model.bindingIr, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
		const wit = compileCopiedWitGraphModel(model.bindingIr);
		assert.deepEqual(wit.layout, native.layout);
		await saveLakeFile(root, "recursive-graph.h", native.header);
		await saveLakeFile(root, "recursive-graph-types.h", native.typesHeader);
		await saveLakeFile(root, "native.c", native.source);
		await saveLakeFile(root, "recursive.wit", wit.wit);
		await saveLakeFile(root, "recursive.wat", wit.wat);
		await runCopied("wasm-tools", ["parse", "recursive.wat", "-o", "recursive.wasm"], root, environment);
		await runCopied("wasm-tools", ["validate", "--features", "component-model", "recursive.wasm"], root, environment);
		const component = await readFile(join(root, "recursive.wasm")), host = renderWitGraphHostSource(wit, component);
		await saveLakeFile(root, "recursive_wasmtime.h", renderWitGraphHostHeader(wit));
		await saveLakeFile(root, "host.c", host);
		await runCopied("cc", ["-std=c11", "-O1", "-g0", "-Wall", "-Wextra"
			, "-Werror", "-UNDEBUG", "-fPIC", "-shared"
			, "-I", join(runtime.root, "include"), "-I", join(sdk, "include")
			, "native.c", "host.c", "-L", compiled.root
			, "-L", join(runtime.root, "lib"), "-L", join(sdk, "lib")
			, `-l:${receipt.library}`, "-llean_bridge_native", "-lleanshared"
			, "-lwasmtime", "-Wl,--no-undefined"
			, `-Wl,-rpath,${compiled.root}:${join(runtime.root, "lib")}:${join(sdk, "lib")}`
			, "-o", "libgraph-wit.so"], root, environment);
		const named = name => wit.nodes.find(node => node.ref.id === `lean:Recursive.${name}`);
		const type = id => wit.nodes.find(node => node.id === id);
		const mappings = {
			Outcome: type(named("Envelope").fields.find(field => field.name === "outcome").type)
			, Forest: type(wit.layout.roots.find(fn => fn.bindingId === "lean:Recursive.forest").result)
			, Units: type(wit.layout.roots.find(fn => fn.bindingId === "lean:Recursive.units").result)
		};
		const declarations = Object.entries(mappings).map(([name, node]) => `typedef ${node.name} native_${name};`).join("\n");
		const consumer = (await readFile("tests/fixtures/recursive-consumers/wit-native.c", "utf8")).replace("/* GENERATED_TYPES */", declarations);
		await saveLakeFile(root, "consumer.c", consumer);
		await runCopied("cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror"
			, "-UNDEBUG", "-I", join(sdk, "include"), "consumer.c"
			, "-L", root, "-L", join(sdk, "lib"), "-lgraph-wit", "-lwasmtime"
			, `-Wl,-rpath,${root}:${join(sdk, "lib")}`
			, "-o", "consumer"], root, environment);
		const result = await runCopied(join(root, "consumer"), [], root);
		assert.equal(result.stderr, "");
		const observation = JSON.parse(result.stdout);
		assert.deepEqual(observation, { scalarTypes: 19, mixedValues: true, growth: true, join: true, words64: true, independentResult: true, invalidInput: true, trapRecovery: true });
		observations.push({ path: reviewed ? "reviewed-ir" : "ordinary-source"
			, observation, bindingIrSha256: wit.manifest.bindingIrSha256
			, runtimeIdentity: runtime.identity, componentSha256: sha256(component)
			, nativeLibrarySha256: sha256(await readFile(join(compiled.root, receipt.library)))
			, hostLibrarySha256: sha256(await readFile(join(root, "libgraph-wit.so")))
			, hostSourceSha256: sha256(host), consumerSourceSha256: sha256(consumer)
			, executableSha256: sha256(await readFile(join(root, "consumer"))) });
		t.diagnostic(`${reviewed ? "reviewed-ir" : "ordinary-source"}: ${JSON.stringify(observation)}`);
	}
	await saveLakeFile(resolve("build/recursive-wit"), "native.json", canonicalJson({ schemaVersion: 1, installedAcceptance: false, observations }));
});
