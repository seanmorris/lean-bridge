/**
 * Compile a generated Component Model adapter and its pinned Wasmtime C host.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { ordinaryWitEvidence, wasmtimeCapiIdentity } from "./native-wit-artifacts.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../backends/wit/copied-host.mjs";
import { renderWitGraphHostSource } from "../backends/wit/copied-graph-host.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOrdinaryWasi } from "../release/native-wasi.mjs";

/**
 * Snapshot the verified C API before compiling.
 *
 * @param source - Extracted official C API archive.
 * @param destination - Private build staging directory.
 */
export const snapshotWasmtimeCapi = async (source, destination) => {
	if(!source) throw new Error("Set LEAN_BRIDGE_WASMTIME_C_API to the extracted Wasmtime 42.0.1 x86_64-linux C API archive");
	const root = resolve(source), files = {}, contents = [];
	for(const path of (await nativeArtifactPaths(root)).filter(path => path === "LICENSE" || path === "lib/libwasmtime.so" || (path.startsWith("include/") && path.endsWith(".h"))))
	{
		const bytes = await readFile(join(root, path));
		files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; contents.push({ path, bytes });
	}
	if(sha256(canonicalJson(files)) !== wasmtimeCapiIdentity.filesSha256) throw new Error("Wasmtime C API differs from the pinned 42.0.1 archive");
	for(const { path, bytes } of contents)
	{ await mkdir(dirname(join(destination, path)), { recursive: true }); await writeFile(join(destination, path), bytes, { flag: "wx" }); }
	return files;
};

/**
 * Reuse the shared Lean/C compilation; compile this target's host library.
 *
 * @param options - Verified native staging, target settings and compiler environment.
 */
export const projectOrdinaryWasi = async options => {
	const { working, adapterRoot, settings, environment = process.env, signal, glibcMinimumVersion } = options;
	const { model, receipt, projection, adapter, runtimeIdentity } = await ordinaryWitEvidence(options);
	const graph = Boolean(model.copiedGraph), nativeRuntime = graph || projection.resources.length > 0;
	const p = graph ? projection.prefix : projection.surface.prefix, root = join(working, "native/wit-adapter");
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const wasmtimeFiles = await snapshotWasmtimeCapi(environment.LEAN_BRIDGE_WASMTIME_C_API, join(root, "wasmtime"));
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env: environment, signal });
	await save(`wit/${projection.name}.wit`, projection.wit);
	await save(`component/${projection.name}.wat`, projection.wat);
	await save(`include/${p}_wasmtime.h`, graph ? projection.hostHeader : renderWitHostHeader(projection));
	await save("binding-manifest.json", canonicalJson(projection.manifest));
	const wasmTools = environment.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";
	const toolsVersion = (await run(wasmTools, ["--version"])).stdout.trim();
	if(!/^wasm-tools 1\.245\.1(?: |$)/.test(toolsVersion)) throw new Error("Ordinary WIT builds require wasm-tools 1.245.1");
	const component = `component/${projection.name}.wasm`;
	await run(wasmTools, ["component", "wit", join(root, `wit/${projection.name}.wit`), "--json"]);
	await run(wasmTools, ["parse", join(root, `component/${projection.name}.wat`), "-o", join(root, component)]);
	await run(wasmTools, ["validate", "--features", "component-model", join(root, component)]);
	await run(wasmTools, ["component", "wit", join(root, component), "--json"]);
	await save(`src/${p}_wasmtime.c`, (graph ? renderWitGraphHostSource : renderWitHostSource)(projection, await readFile(join(root, component))));
	const library = `lib${p}_wasmtime.so`;
	await mkdir(join(root, "lib"));
	await run(environment.CC ?? "cc", ["-std=c11", "-O2", "-g0", "-fPIC", "-shared"
		, "-Wall", "-Wextra", "-Werror"
		, `-ffile-prefix-map=${working}=/build/native-wit`
		, "-I", join(root, "include")
		, "-I", join(root, "wasmtime/include")
		, "-I", join(adapterRoot, "include")
		, ...(graph ? ["-I", join(adapterRoot, "include/detail"), "-Wl,-z,nodelete"] : [])
		, ...(nativeRuntime ? ["-I", join(options.runtimeRoot, "include"), "-pthread"] : [])
		, join(root, `src/${p}_wasmtime.c`)
		, "-L", join(adapterRoot, "lib")
		, "-L", join(root, "wasmtime/lib")
		, `-l${p}`, "-lwasmtime", "-Wl,-z,defs", "-Wl,--build-id=none"
		, ...(nativeRuntime ? [join(options.runtimeRoot, "lib/liblean_bridge_native.so")] : [])
		, "-Wl,-rpath,$ORIGIN", `-Wl,-soname,${library}`
		, "-o", join(root, "lib", library)]);
	for(const path of [join(root, "lib", library), join(root, "wasmtime/lib/libwasmtime.so")])
	{
		const report = await run("readelf", ["--version-info", path]);
		for(const match of report.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/g))
			if(Number(match[1]) > 2 || (Number(match[1]) === 2 && (Number(match[2]) > Number(glibcMinimumVersion.slice(2)) || (Number(match[2]) === Number(glibcMinimumVersion.slice(2)) && Number(match[3] ?? 0) > 0)))) throw new Error(`WIT library exceeds glibc floor ${glibcMinimumVersion}: ${match[0]}`);
	}
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("native-wit-adapter.json", canonicalJson({ schemaVersion: 1, profile: "native-wit-v1", bindingIrSha256: model.bindingIrSha256, componentReceiptSha256: sha256(canonicalJson(receipt)), adapterReceiptSha256: sha256(canonicalJson(adapter)), runtimeIdentity, library, component, settings: settings ?? {}, glibcMinimumVersion, wasmtime: { ...wasmtimeCapiIdentity, files: wasmtimeFiles }, wasmTools: toolsVersion, files }));
	return packageOrdinaryWasi({ ...options, witRoot: root });
};
