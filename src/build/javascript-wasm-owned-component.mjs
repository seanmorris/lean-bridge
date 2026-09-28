/**
 * Compile owned Lean APIs into side modules for the existing JavaScript heap.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { buildElaboratedComponent } from "./elaborated-component.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters, javascriptWasmOwnedProfile as profile } from "./javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "./javascript-wasm-owned-sources.mjs";
import { javascriptWasmOwnedPins as pins, javascriptWasmTargetHeaders, validateOwnedJavaScriptWasmBinary } from "./javascript-wasm-owned-artifacts.mjs";
import { identifyJavaScriptWasmCompiler } from "./javascript-wasm-toolchain.mjs";
import { compileLakeNativeInputs, lakeNativeInputs } from "./lake-native-inputs.mjs";
import { compileOwnedJavaScriptPackageModel } from "../backends/javascript/owned-package.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const save = async (root, path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
const capture = async (root, paths) => Object.fromEntries(await Promise.all(paths.map(async path => [path, identity(await readFile(join(root, path)))])));
const verifyCapture = async (root, expected) => {
	if(!same(expected, await capture(root, Object.keys(expected)))) throw new Error("JavaScript compiler or target inputs changed during compilation");
};
const flags = ["-std=c11", "-O2", "-g0", "-fPIC", "-fvisibility=hidden", "-fwasm-exceptions", "-ffp-contract=off", "-Werror=date-time", "-DLEAN_EMSCRIPTEN", "-fbracket-depth=4096"];

/**
 * Run the shared source-capture/carrier pipeline with an explicit wasm32 ABI.
 * The target Lean headers and SDK are compiler inputs, not consumer dependencies.
 *
 * @param options - Ordinary or reviewed source, target headers and pinned SDK.
 */
export const buildOwnedJavaScriptWasmComponent = async options => {
	if(options.moduleName !== undefined || (options.targets !== undefined && !same(options.targets, ["npm"])))
		throw new TypeError("Owned JavaScript compilation requires its own npm target and no native namespace");
	const { signal, runner = processBuildRunner } = options;
	const target = resolve(options.leanRuntimeRoot), sdk = resolve(options.emsdkRoot);
	const emcc = join(sdk, "upstream/emscripten/emcc");
	const env = { ...process.env, ...options.environment, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten"), LANG: "C.UTF-8", LC_ALL: "C.UTF-8" };
	for(const key of ["CPATH", "C_INCLUDE_PATH", "CPLUS_INCLUDE_PATH", "OBJC_INCLUDE_PATH", "COMPILER_PATH", "GCC_EXEC_PREFIX", "LIBRARY_PATH", "CFLAGS", "CPPFLAGS", "LDFLAGS", "EMCC_CFLAGS", "CCC_OVERRIDE_OPTIONS", "DEPENDENCIES_OUTPUT", "SUNPRO_DEPENDENCIES"])
		delete env[key];
	const run = (command, args, cwd = sdk) => runner.capture({ command, args, cwd, env, signal, timeoutMs: 600000 });
	const compiler = await identifyJavaScriptWasmCompiler({ sdkRoot: sdk, run });
	const inputPaths = ["source/.lean-wasm-patched", "source/LICENSE", ...javascriptWasmTargetHeaders.map(name => `cmake/include/lean/${name}`)];
	const targetFiles = await capture(target, inputPaths);
	if((await readFile(join(target, "source/.lean-wasm-patched"), "utf8")).trim() !== `${pins.leanCommit} ${pins.patchSetSha256} browser`)
		throw new Error("Owned JavaScript headers must come from the pinned browser target");
	const versionHeader = await readFile(join(target, "cmake/include/lean/version.h"), "utf8");
	if(!/^#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"\r?$/m.test(versionHeader)
		|| !/^#define LEAN_VERSION_STRING "4\.32\.2"\r?$/m.test(versionHeader)) throw new Error("Owned JavaScript target header version mismatch");
	return buildElaboratedComponent({ ...options
		, targets: ["npm"], ownedGraphs: true, moduleName: undefined
		, profile, receiptName: "javascript-wasm-component.json"
		, createModel: createOwnedJavaScriptWasmModel
		, createAdapters: generateOwnedJavaScriptWasmLeanAdapters
		, validateModel: model => { compileOwnedJavaScriptPackageModel(model.bindingIr); options.validateModel?.(model); }
		, compileComponent: async ({ staging, model, metadata, sourceIdentity, adapters, compileOrder, generatedC, lakeWorkspace, lakeSnapshot }) => {
			const generated = generateCompiledJavaScriptWasmOwned(model, metadata, adapters);
			for(const [path, source] of Object.entries(generated.files)) await save(staging, path, source);
			const targetHeaders = {};
			for(const name of javascriptWasmTargetHeaders)
			{
				const bytes = await readFile(join(target, "cmake/include/lean", name));
				if(!same(identity(bytes), targetFiles[`cmake/include/lean/${name}`])) throw new Error("JavaScript target header changed before compilation");
				const path = `compiler/include/lean/${name}`; targetHeaders[path] = identity(bytes); await save(staging, path, bytes);
			}
			await save(staging, "compiler/notices/lean.txt", await readFile(join(target, "source/LICENSE")));
			const includeRoots = [staging, join(staging, "owned"), join(staging, "compiler/include")];
			const nativeInputs = lakeWorkspace ? lakeNativeInputs(lakeWorkspace.resolution) : [];
			const native = nativeInputs.length ? await compileLakeNativeInputs({ snapshot: lakeSnapshot
				, snapshotRoot: lakeWorkspace.snapshotRoot
				, generated: lakeWorkspace.generated
				, inputs: nativeInputs, outputRoot: join(staging, "native-objects")
				, compiler: emcc, profile: "side-module-2"
				, includeRoots, runner, environment: env, signal }) : null;
			const leanC = [...compileOrder.map(item => item.c), generatedC];
			const sources = [...leanC, ...generated.sources.map(path => join(staging, path))], objects = [];
			const compileFlags = [...flags
				, `-ffile-prefix-map=${staging}=/build/javascript-owned-component`
				, `-fmacro-prefix-map=${staging}=/build/javascript-owned-component`
				, `-ffile-prefix-map=${sdk}=/toolchains/javascript`
				, ...includeRoots.flatMap(path => ["-I", path])];
			for(const [index, source] of sources.entries())
			{
				const object = join(staging, `c/owned-${index}.o`); objects.push(object);
				const guard = leanC.includes(source) ? ["-include", join(staging, generated.allocationGuard)] : [];
				await run(emcc, [...compileFlags, ...guard, "-c", source, "-o", object], staging);
			}
			const library = "lib/component.so.wasm";
			await mkdir(join(staging, "lib"));
			await run(emcc, ["-O2", "-g0", "-fwasm-exceptions", "-sSIDE_MODULE=2"
				, "-Wl,--no-entry"
				, `-Wl,--export=${generated.privateAbi.controlSymbol}`
				, ...objects, ...(native?.objects ?? [])
				, "-o", join(staging, library)], staging);
			const bytes = await readFile(join(staging, library));
			await validateOwnedJavaScriptWasmBinary(bytes, generated.privateAbi.controlSymbol);
			const receipt = { schemaVersion: 1, profile, pointerBits: 32, pins
				, bindingIrSha256: model.bindingIrSha256, sourceIdentity
				, metadataSha256: sha256(canonicalJson(metadata))
				, modelSha256: sha256(canonicalJson(model))
				, headerSha256: sha256(adapters.header)
				, adaptersSha256: sha256(adapters.leanSource)
				, ownedGraph: generated.receipt
				, initializer: generated.privateAbi.initializer
				, library, wasmLibrary: identity(bytes), targetHeaders
				, compiler
				, ...(native ? { nativeCompilation: native.document } : {}) };
			const verify = async () => {
				await native?.verify(); await verifyCapture(target, targetFiles);
				if(!same(await identifyJavaScriptWasmCompiler({ sdkRoot: sdk, run }), compiler)) throw new Error("JavaScript compiler or origin changed during compilation");
				for(const [path, expected] of Object.entries(targetHeaders))
					if(!same(identity(await readFile(join(staging, path))), expected)) throw new Error("JavaScript staged target header changed during compilation");
				for(const [path, source] of Object.entries(generated.files))
					if(await readFile(join(staging, path), "utf8") !== source) throw new Error("JavaScript generated adapter changed during compilation");
			};
			return { receipt, verify };
		}
	});
};
