/**
 * Build a self-contained owned WIT host over the shared compiled Lean component.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { gmpIdentity } from "../backends/c/gmp.mjs";
import { buildNativeGmp } from "./native-gmp.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { wasmtimeCapiIdentity } from "./native-wit-artifacts.mjs";
import { snapshotWasmtimeCapi } from "./native-wit-projection.mjs";
import { ownedWitEvidence, ownedWitSources } from "./owned-wit-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOwnedWasi } from "../release/owned-wasi.mjs";

/**
 * Compile the generated Component Model and guarded public host, then package it.
 *
 * @param options - Verified native staging, WIT coordinates and compiler environment.
 */
export const projectOwnedWasi = async options => {
	const { working, nativeRoot, runtimeRoot, environment = process.env, signal } = options;
	const evidence = await ownedWitEvidence(options), { model, receipt, projection, runtimeIdentity, settings } = evidence;
	const root = join(working, "native/owned-wit-adapter");
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const inventory = async directory => {
		const files = {};
		for(const path of await nativeArtifactPaths(directory))
		{ const bytes = await readFile(join(directory, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
		return files;
	};
	const wasmtimeFiles = await snapshotWasmtimeCapi(environment.LEAN_BRIDGE_WASMTIME_C_API, join(root, "wasmtime"));
	await buildNativeGmp({ root: join(root, "gmp"), environment, signal });
	const gmpFiles = await inventory(join(root, "gmp"));
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env: environment, signal });
	const wasmTools = environment.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";
	const toolsVersion = (await run(wasmTools, ["--version"])).stdout.trim();
	if(!/^wasm-tools 1\.245\.1(?: |$)/u.test(toolsVersion)) throw new Error("Owned WIT builds require wasm-tools 1.245.1");
	await save(`wit/${projection.name}.wit`, projection.wit);
	await save(`component/${projection.name}.wat`, projection.wat);
	const component = `component/${projection.name}.wasm`;
	await run(wasmTools, ["component", "wit", join(root, `wit/${projection.name}.wit`), "--json"]);
	await run(wasmTools, ["parse", join(root, `component/${projection.name}.wat`), "-o", join(root, component)]);
	await run(wasmTools, ["validate", "--features", "component-model", join(root, component)]);
	await run(wasmTools, ["component", "wit", join(root, component), "--json"]);
	const sources = ownedWitSources(evidence, await readFile(join(root, component)), wasmtimeFiles, gmpFiles);
	for(const [path, bytes] of Object.entries(sources.files))
		if(!path.endsWith(".wit") && !path.endsWith(".wat")) await save(path, bytes);
	const p = sources.generated.values.prefix, library = `lib${p}.so`;
	await mkdir(join(root, "lib"));
	await run(environment.CC ?? "cc", ["-std=c11", "-O2", "-g0", "-fPIC", "-shared"
		, "-Wall", "-Wextra", "-Werror"
		, `-ffile-prefix-map=${working}=/build/owned-wit`
		, "-I", join(root, "include"), "-I", join(root, "internal")
		, "-I", join(root, "gmp/include"), "-I", join(root, "wasmtime/include")
		, "-I", join(runtimeRoot, "include")
		, join(root, `src/${p}.c`), "-L", nativeRoot, "-L", join(runtimeRoot, "lib")
		, "-L", join(root, "gmp/lib"), "-L", join(root, "wasmtime/lib")
		, "-Wl,--no-as-needed", `-l:${receipt.library}`
		, "-llean_bridge_native", "-lleanshared"
		, "-l:libgmp.so.10", "-lwasmtime", "-ldl", "-pthread"
		, "-Wl,-z,defs", "-Wl,-z,now", "-Wl,-Bsymbolic-functions"
		, "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN", "-Wl,-z,nodelete"
		, `-Wl,-soname,${library}`, "-o", join(root, "lib", library)]);
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
	if(!/^2\.\d+$/u.test(floor)) throw new TypeError("Invalid native glibc floor");
	const libraries = [join(root, "lib", library)
		, join(nativeRoot, receipt.library)
		, ...Object.keys(evidence.runtime.files).filter(path => path.startsWith("lib/")).map(path => join(runtimeRoot, path))
		, join(root, "wasmtime/lib/libwasmtime.so")
		, join(root, "gmp/lib/libgmp.so.10")];
	for(const path of libraries)
	{
		const report = await run("readelf", ["--version-info", path]);
		for(const match of report.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
			if(Number(match[1]) > 2 || (Number(match[1]) === 2 && (Number(match[2]) > Number(floor.slice(2)) || (Number(match[2]) === Number(floor.slice(2)) && Number(match[3] ?? 0) > 0))))
				throw new Error(`Owned WIT library requires ${match[0]}, above the package floor ${floor}`);
	}
	await save("native-wit-adapter.json", canonicalJson({ schemaVersion: 2
		, profile: "native-wit-v1", bindingIrSha256: model.bindingIrSha256
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, runtimeIdentity, library, component, settings
		, glibcMinimumVersion: floor
		, ownedValues: { schemaVersion: model.ownedGraph.resultAnchors ? 3 : model.ownedGraph.inputTransfers ? 2 : 1
			, hostCallbacks: model.ownedGraph.hostCallbacks ?? null
			, ...model.ownedGraph.inputTransfers ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
			, ...model.ownedGraph.resultAnchors ? { resultAnchors: model.ownedGraph.resultAnchors } : {}
			, headerSha256: sha256(sources.generated.publicHeader)
			, sourceSha256: sha256(sources.files[`src/${p}.c`]) }
		, dependencies: sources.dependencies
		, wasmtime: { ...wasmtimeCapiIdentity, files: wasmtimeFiles }
		, wasmTools: toolsVersion
		, gmp: { ...gmpIdentity, files: gmpFiles }, files: await inventory(root) }));
	return packageOwnedWasi({ ...options, witRoot: root, glibcMinimumVersion: floor });
};
