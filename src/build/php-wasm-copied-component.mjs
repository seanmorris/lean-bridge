/**
 * Compile ordinary Lean copied APIs for the pinned PHP-Wasm 32-bit Zend host.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { brokerHeader, brokerSource } from "../backends/native/runtime-broker.mjs";
import { phpWasmUnsupportedLibuvC } from "../backends/php/php-wasm-libuv.mjs";
import { generateCopiedPhpZendAdapter } from "../backends/php/copied-zend.mjs";
import { compileCopiedPhpModel } from "../backends/php/copied-model.mjs";
import { compileCopiedPhpGraphZendModel } from "../backends/php/copied-graph-zend.mjs";
import { compileCallablePhpGraphZendModel } from "../backends/php/callable-graph-zend-model.mjs";
import { generateCBindingPackage } from "../backends/c/generate.mjs";
import { generateNativePrimitiveC } from "../backends/c/native-primitives.mjs";
import { buildElaboratedComponent } from "./elaborated-component.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "./php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmGraph } from "./php-wasm-graph-component.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { lakeNativeInputs } from "./lake-native-inputs.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { phpWasmCopiedPins as pins, phpWasmCopiedProfile as profile, phpWasmCopiedCompilerFiles, readVerifiedPhpWasmCopiedRuntime, validatePhpWasmCopiedBinary } from "./php-wasm-copied-artifacts.mjs";
import { phpWasmHeaderPaths } from "../release/php-wasm-compiler-inputs.mjs";
import { nativeCallbackHeader, nativeCallbackBroker, generateCompiledCallbacks } from "./native-component.mjs";

// Callback tokens travel through Lean USize. Exhausted generations retire;
// they must never truncate or wrap on the 32-bit host.
export const phpWasmCallbackBroker = nativeCallbackBroker.replace("UINT64_MAX >> 12", "UINT32_MAX >> 12");
const runtimeHeader = brokerHeader.replace("#ifdef __cplusplus\n}", `${nativeCallbackHeader}\n#ifdef __cplusplus\n}`);
const runtimeSource = `${brokerSource}\n${phpWasmCallbackBroker}`;

const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const save = async (root, path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off", "-Werror=date-time", "-DLEAN_EMSCRIPTEN"];
const includes = roots => roots.flatMap(root => ["-I", root]);
const requireAbsent = async output => {
	try
	{ await readdir(output); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	throw new Error(`PHP-Wasm output already exists: ${output}`);
};
const capture = async (root, paths) => Object.fromEntries(await Promise.all(paths.map(async path => [path, identity(await readFile(join(root, path)))])));
const verifyCapture = async (root, expected) => {
	if(!same(expected, await capture(root, Object.keys(expected)))) throw new Error("PHP-Wasm compiler or build inputs changed during compilation");
};

const toolchain = async (emsdkRoot, runner, signal) => {
	const root = resolve(emsdkRoot), emcc = join(root, "upstream/emscripten/emcc"), emxx = join(root, "upstream/emscripten/em++");
	const env = { ...process.env, EM_CONFIG: join(root, ".emscripten"), EMSDK: root };
	const run = (command, args, options = {}) => runner.capture({ command, args, cwd: root, env, signal, ...options });
	const sdk = await run("git", ["-C", root, "rev-parse", "HEAD"]), probe = await run(emcc, ["--version"]);
	const version = probe.stdout.split("\n")[0];
	if(sdk.stdout.trim() !== pins.emsdkCommit || !version.includes(` ${pins.emscriptenVersion} (${pins.emscriptenCommit})`)) throw new Error("PHP-Wasm requires its pinned Emscripten 3.1.68 toolchain, not the npm compiler");
	const files = await capture(root, phpWasmCopiedCompilerFiles);
	return { emcc, emxx, run, compiler: { version, emsdkCommit: pins.emsdkCommit, files }, verify: () => verifyCapture(root, files) };
};

/**
 * Build one shared Lean runtime from the PHP-Wasm-specific target archives.
 *
 * @param options - New output, pinned target runtime build and Emscripten SDK.
 * @param options.outputRoot - New shared runtime output directory.
 * @param options.leanRuntimeRoot - Pinned Lean target archives and headers.
 * @param options.emsdkRoot - Pinned PHP-Wasm Emscripten SDK.
 * @param options.signal - Child-process cancellation signal.
 * @param options.runner - Process runner for builds and drift checks.
 */
export const buildPhpWasmCopiedRuntime = async ({ outputRoot, leanRuntimeRoot, emsdkRoot, signal, runner = processBuildRunner }) => {
	const output = resolve(outputRoot), target = resolve(leanRuntimeRoot);
	await requireAbsent(output); await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-php-wasm-runtime-"));
	try
	{
		const compiler = await toolchain(emsdkRoot, runner, signal);
		const stamp = (await readFile(join(target, "source/.lean-wasm-patched"), "utf8")).trim();
		if(stamp !== `${pins.leanCommit} ${pins.patchSetSha256} browser`) throw new Error("PHP-Wasm target Lean runtime identity mismatch");
		const headerPaths = ["lean.h", "lean_gmp.h", "lean_libuv.h", "config.h", "version.h"].map(path => `cmake/include/lean/${path}`);
		const archives = ["cmake/lib/lean/libInit.a", "cmake/lib/lean/libleanrt.a"];
		const uvRoot = join(target, "cmake/libuv/src/libuv/include");
		const uvHeaders = (await nativeArtifactPaths(uvRoot)).filter(path => path.endsWith(".h"));
		const inputFiles = await capture(target, ["source/.lean-wasm-patched", ...headerPaths, ...archives, ...uvHeaders.map(path => `cmake/libuv/src/libuv/include/${path}`)]);
		for(const path of headerPaths) await save(staging, `include/lean/${basename(path)}`, await readFile(join(target, path)));
		for(const path of uvHeaders) await save(staging, `c/uv/${path}`, await readFile(join(uvRoot, path)));
		await save(staging, "include/lean_bridge_native_runtime.h", runtimeHeader);
		await save(staging, "c/broker.c", `${runtimeSource}\n_Static_assert(sizeof(void *) == 4, "PHP-Wasm requires wasm32");\n`);
		await save(staging, "c/libuv.c", phpWasmUnsupportedLibuvC);
		const objects = [];
		for(const name of ["broker", "libuv"])
		{
			const object = join(staging, `c/${name}.o`); objects.push(object);
			await compiler.run(compiler.emcc, ["-O2", "-g0", "-fPIC", `-ffile-prefix-map=${staging}=/build/php-wasm-runtime`, ...includes([join(staging, "include"), join(staging, "c/uv")]), "-c", join(staging, `c/${name}.c`), "-o", object]);
		}
		const inputs = { files: inputFiles, brokerSha256: sha256(runtimeSource), libuvSha256: sha256(phpWasmUnsupportedLibuvC) };
		const key = sha256(canonicalJson({ profile, pins, compiler: compiler.compiler, inputs })).slice(0, 20);
		const library = `lib/liblean_bridge_php_wasm_copied_${key}.so`;
		await mkdir(join(staging, "lib"));
		await compiler.run(compiler.emxx, [...objects, "-Wl,--start-group", ...archives.map(path => join(target, path)), "-lc++", "-lc++abi", "-Wl,--end-group", "-O2", "-g0", "-fPIC", "-sSIDE_MODULE=1", "-Wl,--no-entry", "-o", join(staging, library)]);
		await validatePhpWasmCopiedBinary(await readFile(join(staging, library)));
		await verifyCapture(target, inputFiles); await compiler.verify();
		await rm(join(staging, "c"), { recursive: true });
		const files = await capture(staging, await nativeArtifactPaths(staging));
		const manifest = { schemaVersion: 1, profile, pointerBits: 32, pins, compiler: compiler.compiler, inputs, library, files };
		await save(staging, "runtime.json", canonicalJson(manifest));
		const verified = await readVerifiedPhpWasmCopiedRuntime(staging);
		await rename(staging, output);
		return { root: output, ...verified };
	}
	catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};

/**
 * Emit one private Zend extension containing freshly compiled ordinary Lean C.
 * No native ELF receipt or npm Wasm artifact enters this build.
 *
 * @param options - Ordinary source selection, verified runtime and pinned SDKs.
 */
export const buildPhpWasmCopiedComponent = async options => {
	if(options.moduleName !== undefined || (options.targets !== undefined && !same(options.targets, ["php-wasm"]))) throw new TypeError("PHP-Wasm copied compilation requires its own target selection and no Perl namespace");
	const { runtimeRoot, emsdkRoot, phpSource, signal, runner = processBuildRunner } = options;
	const runtime = resolve(runtimeRoot), php = resolve(phpSource);
	const verifiedRuntime = await readVerifiedPhpWasmCopiedRuntime(runtime);
	const compiler = await toolchain(emsdkRoot, runner, signal);
	if(!same(verifiedRuntime.manifest.compiler, compiler.compiler)) throw new Error("PHP-Wasm runtime/component compiler identity mismatch");
	const phpHeaders = await capture(php, await phpWasmHeaderPaths(php));
	return buildElaboratedComponent({ ...options, targets: ["php-wasm"]
		, moduleName: undefined, profile, receiptName: "php-wasm-component.json"
		, createModel: createCompiledPhpWasmModel
		, createAdapters: generateCompiledPhpWasmLeanAdapters
		, validateModel: model => {
			if(model.copiedGraph?.callbacks) compileCallablePhpGraphZendModel(model.bindingIr);
			else if(model.copiedGraph) compileCopiedPhpGraphZendModel(model.bindingIr);
			else compileCopiedPhpModel(model.bindingIr, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
			options.validateModel?.(model);
		}
		, compileComponent: async ({ staging, model, metadata, sourceIdentity, adapters, compileOrder, generatedC, lakeWorkspace }) => {
			if(lakeWorkspace && lakeNativeInputs(lakeWorkspace.resolution).length) throw new Error("PHP-Wasm copied compilation does not yet admit Lake native C inputs");
			for(const path of Object.keys(phpHeaders)) await save(staging, `c/php/${path}`, await readFile(join(php, path)));
			const graph = model.copiedGraph ? generateCompiledPhpWasmGraph(model, adapters) : null;
			const zend = graph?.files ?? generateCopiedPhpZendAdapter(model.bindingIr);
			const manifestPath = graph?.zendManifestPath ?? "copied-zend-manifest.json";
			const manifest = JSON.parse(zend[manifestPath]);
			const runtimeHeader = await readFile(join(runtime, "include/lean_bridge_native_runtime.h"), "utf8");
			if(graph && !runtimeHeader.includes("#define LEAN_BRIDGE_NATIVE_RUNTIME_RETIREMENT_VERSION 1")) throw new Error("PHP-Wasm recursive packages require compiler inputs rebuilt with runtime retirement support");
			if(model.copiedGraph?.callbacks && !runtimeHeader.includes(nativeCallbackHeader)) throw new Error("PHP-Wasm recursive callables require compiler inputs rebuilt with callback registry support");
			for(const [path, source] of Object.entries(zend)) await save(staging, path, source);
			const initializer = `initialize_${adapters.module}`;
			let adapterSources;
			if(graph) adapterSources = graph.sources;
			else
			{
				const c = generateCBindingPackage(model.bindingIr), { surface } = compileCopiedPhpModel(model.bindingIr, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
				if(surface.callbacks.size && !runtimeHeader.includes(nativeCallbackHeader)) throw new Error("PHP-Wasm callables require compiler inputs rebuilt with callback registry support");
				for(const path of [surface.paths.publicHeader, surface.paths.internalHeader, surface.paths.implementation]) await save(staging, `c/binding/${path}`, c[path]);
				await save(staging, "c/provider.c", generateNativePrimitiveC(model, { initializer }));
				await save(staging, "c/callbacks.c", generateCompiledCallbacks(model));
				adapterSources = ["c/provider.c", "c/callbacks.c", `c/binding/${surface.paths.implementation}`, `extension/${manifest.extension}.c`];
			}
			await save(staging, "c/width.c", '#include <php.h>\n#include <lean/lean.h>\n_Static_assert(sizeof(void *) == 4 && sizeof(size_t) == 4 && sizeof(zend_long) == 4, "PHP-Wasm requires wasm32");\n_Static_assert(PHP_VERSION_ID == 80401, "PHP headers must match PHP-Wasm 8.4.1");\n');
			const roots = [staging, join(staging, "include"), join(staging, "c/binding/include"), join(staging, "c/binding/internal"), join(runtime, "include"), join(staging, "c/php"), ...["Zend", "main", "TSRM", "ext"].map(path => join(staging, "c/php", path))];
			// Retain the historical object order for acyclic components.
			const paths = [...adapterSources]; paths.splice(2, 0, "c/width.c");
			const sources = [...compileOrder.map(item => item.c), generatedC, ...paths.map(path => join(staging, path))];
			const compileFlags = graph ? [...flags, "-fbracket-depth=4096"] : flags;
			const guardedSources = new Set(graph ? [...compileOrder.map(item => item.c), generatedC] : []);
			const objects = [];
			for(const [i, source] of sources.entries())
			{
				const object = join(staging, `c/${i}.o`); objects.push(object);
				const guard = guardedSources.has(source) ? ["-include", join(staging, "graph/allocation-guard.h")] : [];
				try
				{
					await compiler.run(compiler.emcc, [...compileFlags, ...guard, `-ffile-prefix-map=${staging}=/build/php-wasm-component`, `-ffile-prefix-map=${runtime}=/build/php-wasm-runtime`, `-ffile-prefix-map=${resolve(emsdkRoot)}=/toolchains/php-wasm`, ...includes(roots), "-c", source, "-o", object]);
				}
				catch(error)
				{
					if(error.details?.stderr?.includes("Lean Bridge: native constructor"))
						throw Object.assign(new Error("Cannot establish a safe constructor allocation for the pinned PHP-Wasm Lean runtime. Reduce the constructor's stored fields, for example by using an Array.", { cause: error }), { code: "php-wasm-constructor-allocation-unsupported", details: error.details });
					throw error;
				}
			}
			const library = `lib/php8.4-${manifest.extension}.so`;
			await mkdir(join(staging, "lib"));
			// Export only the Zend loader entry point. Independently compiled Lean
			// modules may reuse source names without interposing on another package.
			await compiler.run(compiler.emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", ...objects, join(runtime, verifiedRuntime.manifest.library), "-o", join(staging, library)]);
			const bytes = await readFile(join(staging, library));
			await validatePhpWasmCopiedBinary(bytes, true);
			const receipt = { schemaVersion: 1, profile, pointerBits: 32
				, runtimeIdentity: verifiedRuntime.identity
				, bindingIrSha256: model.bindingIrSha256, sourceIdentity
				, metadataSha256: sha256(canonicalJson(metadata))
				, modelSha256: sha256(canonicalJson(model))
				, headerSha256: sha256(adapters.header)
				, adaptersSha256: sha256(adapters.leanSource)
				, zendSha256: sha256(zend[manifestPath])
				, ...graph ? { copiedGraph: graph.receipt } : {}
				, initializer, library, wasmLibrary: identity(bytes)
				, compiler: compiler.compiler
				, phpHeadersSha256: sha256(canonicalJson(phpHeaders))
				, exports: manifest.exports };
			return { receipt
				, verify: async () => {
					await compiler.verify(); await verifyCapture(php, phpHeaders);
					if((await readVerifiedPhpWasmCopiedRuntime(runtime)).identity !== verifiedRuntime.identity) throw new Error("PHP-Wasm runtime changed during component compilation");
				}
			};
		}
	});
};
