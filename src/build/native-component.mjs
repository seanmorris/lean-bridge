/**
 * Native compilation from fresh Lean interfaces and checked export metadata.
 *
 * @file
 */
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { createNativeModel, nativeCType, nativeCallbackDefault } from "./native-model.mjs";
import { brokerHeader, brokerSource } from "../backends/native/runtime-broker.mjs";
import { nativeArtifactPaths, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { compileLakeNativeInputs, lakeNativeInputs } from "./lake-native-inputs.mjs";
import { nativeAllocationGuardHeader } from "./native-allocation-guard.mjs";

import { buildElaboratedComponent, pinnedCompiledLean as pinnedNativeLean } from "./elaborated-component.mjs";

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export { pinnedCompiledLean as pinnedNativeLean } from "./elaborated-component.mjs";
const json = value => canonicalJson(value);
const absent = async path => {
	try
	{ await readdir(path); } catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	throw new Error(`native output already exists: ${path}`);
};
const run = async (command, args, options = {}) => processBuildRunner.capture({ command, args, cwd: engineRoot, ...options });
const save = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };
const fileIdentity = async path => { const bytes = await readFile(path); return { bytes: bytes.length, sha256: sha256(bytes) }; };

export const nativeCallbackHeader = `
typedef struct lb_native_callback { void (*invoke)(void); void *context; } lb_native_callback;
uint64_t lb_native_callback_register(void (*invoke)(void), void *context);
void lb_native_callback_release(uint64_t token);
lb_native_callback lb_native_callback_lookup(uint64_t token);
int lb_native_callback_wrong_thread(uint64_t token);
int lb_native_callback_take_error(void);
`;
export const nativeCallbackBroker = `
typedef struct { lb_native_callback callback; uint64_t generation; pthread_t thread; int wrong_thread; } lb_callback_slot;
static lb_callback_slot callback_slots[4096];
static _Thread_local int callback_error;
uint64_t lb_native_callback_register(void (*invoke)(void), void *context) {
  pthread_mutex_lock(&runtime_mutex);
  for (size_t i = 0; i < 4096; ++i) if (!callback_slots[i].callback.invoke && callback_slots[i].generation < (UINT64_MAX >> 12)) {
    lb_callback_slot *slot = &callback_slots[i];
    slot->callback = (lb_native_callback){invoke, context};
    slot->thread = pthread_self(); slot->wrong_thread = 0;
    uint64_t token = (++slot->generation << 12) | i;
    pthread_mutex_unlock(&runtime_mutex); return token;
  }
  pthread_mutex_unlock(&runtime_mutex); return 0;
}
void lb_native_callback_release(uint64_t token) {
  pthread_mutex_lock(&runtime_mutex);
  lb_callback_slot *slot = &callback_slots[token & 4095];
  if (slot->generation == (token >> 12)) slot->callback = (lb_native_callback){0};
  pthread_mutex_unlock(&runtime_mutex);
}
lb_native_callback lb_native_callback_lookup(uint64_t token) {
  pthread_mutex_lock(&runtime_mutex);
  lb_callback_slot *slot = &callback_slots[token & 4095];
  lb_native_callback result = slot->generation == (token >> 12) ? slot->callback : (lb_native_callback){0};
  if (result.invoke && !pthread_equal(slot->thread, pthread_self())) {
    slot->wrong_thread = 1; result = (lb_native_callback){0};
  }
  pthread_mutex_unlock(&runtime_mutex);
  if (!result.invoke) callback_error = 1;
  return result;
}
int lb_native_callback_wrong_thread(uint64_t token) {
  pthread_mutex_lock(&runtime_mutex);
  lb_callback_slot *slot = &callback_slots[token & 4095];
  int result = slot->generation == (token >> 12) && slot->wrong_thread;
  pthread_mutex_unlock(&runtime_mutex); return result;
}
int lb_native_callback_take_error(void) { int result = callback_error; callback_error = 0; return result; }
`;

/**
 * Build one process-wide runtime, reused unchanged by every component and XS ABI.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.leanPrefix - Pinned Lean installation containing the compiler and matching headers.
 * @param root0.cc - Upstream C compiler executable.
 */
export const buildNativeSharedRuntime = async ({ outputRoot, leanPrefix, cc = "cc" }) => {
	if(process.platform !== "linux" || process.arch !== "x64") throw new Error("native-library-v1 currently supports Linux x86-64 only");
	const output = resolve(outputRoot); await absent(output); await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-native-runtime-"));
	try
	{
		const probe = await run(join(leanPrefix, "bin/lean"), ["--version"]);
		if(!probe.stdout.includes(pinnedNativeLean)) throw new Error("native runtime Lean identity mismatch");
		await save(join(staging, "include/lean_bridge_native_runtime.h"), brokerHeader.replace("#ifdef __cplusplus\n}", `${nativeCallbackHeader}\n#ifdef __cplusplus\n}`));
		await save(join(staging, "broker.c"), `${brokerSource}\n${nativeCallbackBroker}`);
		await mkdir(join(staging, "lib"));
		const leanLibrary = join(leanPrefix, "lib/lean/libleanshared.so");
		await copyFile(leanLibrary, join(staging, "lib/libleanshared.so"));
		await run(cc, ["-O2"
			, "-g0"
			, "-fPIC"
			, "-shared"
			, "-I"
			, join(leanPrefix, "include")
			, "-I"
			, join(staging, "include")
			, join(staging, "broker.c")
			, "-L"
			, join(staging, "lib")
			, "-Wl,--no-as-needed"
			, "-lleanshared"
			, "-Wl,-z,defs"
			, "-pthread"
			, "-Wl,--build-id=none"
			, "-Wl,-rpath,$ORIGIN"
			, "-Wl,-soname,liblean_bridge_native.so"
			, "-o"
			, join(staging, "lib/liblean_bridge_native.so")]);
		for(const path of await nativeArtifactPaths(join(leanPrefix, "include/lean")))
		{
			await mkdir(dirname(join(staging, "include/lean", path)), { recursive: true });
			await copyFile(join(leanPrefix, "include/lean", path), join(staging, "include/lean", path));
		}
		await rm(join(staging, "broker.c"));
		const files = {};
		for(const path of await nativeArtifactPaths(staging))
      files[path] = await fileIdentity(join(staging, path));
		const manifest = { schemaVersion: 1, profile: "native-library-v1", leanCommit: pinnedNativeLean, pointerBits: 64, files };
		await save(join(staging, "runtime.json"), json(manifest));
		await readVerifiedNativeRuntime(staging);
		await rename(staging, output);
		return { root: output, manifest, identity: sha256(canonicalJson(manifest)) };
	} catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};

const callbackDefault = nativeCallbackDefault;

/**
 * Connect compiler-emitted callable bodies to the shared borrowed-call registry.
 *
 * @param model - Compiler-checked model at its target pointer width.
 */
export const generateCompiledCallbacks = model => {
	let callbacks = '#include "component.h"\n#include "lean_bridge_native_runtime.h"\n';
	for(const type of model.types.filter(t => t.kind === "callback"))
	{
		const result = nativeCType(type.result), arguments_ = type.parameters.map((_, i) => `value${i}`).join(", ");
		callbacks += `${result} lb_t${type.key}_invoke(size_t token, ${type.parameters.map((p, i) => `${nativeCType(p)} value${i}`).join(", ")}) {\n  lb_native_callback cb = lb_native_callback_lookup(token);\n  if (!cb.invoke) { ${type.parameters.map((p, i) => nativeCType(p) === "lean_object *" ? `lean_dec(value${i});` : "").join(" ")} return ${callbackDefault(type.result)}; }\n  return ((${result} (*)(void *, ${type.parameters.map(nativeCType).join(", ")}))cb.invoke)(cb.context, ${arguments_});\n}\n`;
	}
	return callbacks;
};

/**
 * Compile one freshly elaborated API against the verified 64-bit native runtime.
 *
 * @param options - Source selection, pinned compiler and native runtime paths.
 */
export const buildNativeComponent = async options => {
	const { runtimeRoot, leanPrefix, cc = "cc", signal } = options;
	const runtime = resolve(runtimeRoot);
	const { manifest: runtimeManifest } = await readVerifiedNativeRuntime(runtime);
	if(runtimeManifest.leanCommit !== pinnedNativeLean) throw new Error("incompatible native runtime");
	return buildElaboratedComponent({ ...options, profile: "native-library-v1"
		, receiptName: "native-component.json", createModel: createNativeModel
		, compileComponent: async ({ staging, model, metadata, sourceIdentity, adapters, compileOrder, generatedC, lakeWorkspace, lakeSnapshot, run, verifyElaborationInputs }) => {
			await save(join(staging, "c/callbacks.c"), generateCompiledCallbacks(model));
			const allocationGuard = join(staging, "allocation-guard.h");
			await save(allocationGuard, nativeAllocationGuardHeader);
			const objects = [];
			const nativeInputs = lakeWorkspace ? lakeNativeInputs(lakeWorkspace.resolution) : [];
			const nativeCompilation = nativeInputs.length ? await compileLakeNativeInputs({ snapshot: lakeSnapshot
				, snapshotRoot: lakeWorkspace.snapshotRoot, inputs: nativeInputs
				, generated: lakeWorkspace.generated
				, outputRoot: join(staging, "native-objects")
				, compiler: cc, profile: "native-library-v1"
				, includeRoots: [join(leanPrefix, "include"), join(runtime, "include")]
				, signal }) : null;
			if(nativeCompilation) objects.push(...nativeCompilation.objects);
			for(const [index, path] of [...compileOrder.map(item => item.c), generatedC, join(staging, "c/callbacks.c")].entries())
			{
				const object = join(staging, `c/${index}.o`); objects.push(object);
				try
				{
					await run(cc, ["-O2", "-g0", "-fPIC", `-ffile-prefix-map=${staging}=/build/native-component`, `-ffile-prefix-map=${runtime}=/build/native-runtime`, "-I", join(runtime, "include"), "-I", staging, "-include", allocationGuard, "-c", path, "-o", object], { signal });
				} catch(error)
				{
					if(error.details?.stderr?.includes("Lean Bridge: native constructor"))
						throw Object.assign(new Error("Cannot establish a safe constructor allocation for the pinned Lean runtime. Reduce the constructor's stored fields, for example by using an Array.", { cause: error }), { code: "native-constructor-allocation-unsupported", details: error.details });
					throw error;
				}
			}
			const library = `libcomponent_${sha256(model.component.id).slice(0, 20)}.so`;
			await verifyElaborationInputs();
			await run(cc, ["-shared"
				, ...objects
				, "-L"
				, join(runtime, "lib")
				, "-Wl,--no-as-needed"
				, "-llean_bridge_native"
				, "-lleanshared"
				, "-Wl,-z,defs"
				, "-Wl,--build-id=none"
				, "-Wl,-rpath,$ORIGIN"
				, `-Wl,-soname,${library}`
				, "-o"
				, join(staging, library)], { signal });
			const receipt = { schemaVersion: 2
				, profile: "native-library-v1"
				, runtimeIdentity: sha256(canonicalJson(runtimeManifest))
				, bindingIrSha256: model.bindingIrSha256
				, sourceIdentity
				, metadataSha256: sha256(canonicalJson(metadata))
				, modelSha256: sha256(canonicalJson(model))
				, headerSha256: sha256(adapters.header)
				, adaptersSha256: sha256(adapters.leanSource)
				, allocationGuardSha256: sha256(nativeAllocationGuardHeader)
				, initializer: `initialize_${adapters.module}`
				, library
				, nativeLibrary: await fileIdentity(join(staging, library))
				, compiler: (await run(cc, ["--version"])).stdout.split("\n")[0]
				, ...(nativeCompilation ? { nativeCompilation: nativeCompilation.document } : {})
				, exports: model.exports.map(item => ({ declaration: item.name, symbol: item.symbol })) };
			return { receipt, verify: async () => { await nativeCompilation?.verify(); } };
		}
	});
};
