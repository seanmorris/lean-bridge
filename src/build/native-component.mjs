/**
 * Native compilation from fresh Lean interfaces and checked export metadata.
 *
 * @file
 */
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { assertExportConfigurationCapabilities, assertExportConfigurationSnapshot, readExportConfiguration, selectSourceModules, compilerExportSelection } from "../analyze/export-configuration.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { createNativeModel, generateNativeLeanAdapters, nativeCType, nativeCallbackDefault } from "./native-model.mjs";
import { brokerHeader, brokerSource } from "../backends/native/runtime-broker.mjs";
import { nativeArtifactPaths, readVerifiedNativeRuntime } from "./native-artifacts.mjs";
import { captureLockedLakeProject } from "./lake-workspace.mjs";
import { verifyLakeSnapshotSourceTree } from "./lake-dependency-snapshot.mjs";
import { elaboratedComponent } from "../analyze/semantic-model.mjs";
import { resolveLakeBuildWorkspace } from "./lake-build-workspace.mjs";
import { selectLakeEntryModules, verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { createMetadataRequest, identifyLeanInterface } from "../analyze/elaborated-metadata.mjs";
import { compileLakeNativeInputs, lakeNativeInputs } from "./lake-native-inputs.mjs";

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const pinnedNativeLean = "f3b06c705e6c85f5314019d5d3baab0fec5b580c";
const json = value => canonicalJson(value);
const namePattern = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
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
const callbackBroker = `
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
		await save(join(staging, "broker.c"), `${brokerSource}\n${callbackBroker}`);
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
 * Read-only source snapshot, fresh elaboration, per-declaration native symbols.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.projectRoot - Ordinary Lean project root to compile without modifying source.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.runtimeRoot - Verified process-wide native runtime directory.
 * @param root0.leanPrefix - Pinned Lean installation containing the compiler and matching headers.
 * @param root0.moduleName - Public LeanBridge Perl package name.
 * @param root0.modules - Selected local Lean modules.
 * @param root0.configurationSha256 - Optional expected shared configuration identity.
 * @param root0.exports - Exact public declaration names, or discovery when empty.
 * @param root0.resources - Lean types explicitly assigned identity-bearing representation.
 * @param root0.arities - Explicit argument counts for exports returning closures.
 * @param root0.cc - Upstream C compiler executable.
 * @param root0.signal - Optional cancellation signal for child build processes.
 * @param root0.runner - Optional process runner for compiler and drift checks.
 * @param root0.lakeSnapshot - Shared immutable capture for a multi-profile build.
 * @param root0.targets - Native projections that must all admit the compiled API.
 * @param root0.validateModel - Optional target admission check before adapter compilation.
 */
export const buildNativeComponent = async ({ projectRoot
	, outputRoot
	, runtimeRoot
	, leanPrefix
	, moduleName
	, modules
	, exports
	, resources
	, arities
	, configurationSha256
	, lakeSnapshot
	, targets = ["cpan"]
	, validateModel
	, cc = "cc"
	, signal
	, runner = processBuildRunner }) => {
	const run = (command, args, options = {}) => runner.capture({ command, args, cwd: engineRoot, ...options });
	const output = resolve(outputRoot), project = resolve(projectRoot), runtime = resolve(runtimeRoot);
	await absent(output); await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-native-component-"));
	let lakeWorkspace;
	try
	{
		const record = await readExportConfiguration(project, { signal });
		if(configurationSha256 !== undefined && configurationSha256 !== record.sha256) throw new Error("export configuration changed before native compilation");
		const config = record.configuration;
		for(const target of targets)
			assertExportConfigurationCapabilities(config, { target, fields: ["modules", "exports", "resources", "arities", "specializations", "contracts", "generators"], targetFields: target === "cpan" ? ["module", "version"] : ["name", "version"] });
		for(const [field, value] of Object.entries({ modules, exports, resources, arities }))
			if(value !== undefined && config[field] !== undefined && canonicalJson(value) !== canonicalJson(config[field]))
				throw new Error(`Native ${field} override conflicts with lean-bridge.exports.json`);
		if(moduleName !== undefined && config.targets?.cpan?.module !== undefined && moduleName !== config.targets.cpan.module)
			throw new Error("Native moduleName override conflicts with targets.cpan.module");
		modules ??= config.modules;
		exports ??= config.exports ?? [];
		resources ??= config.resources ?? [];
		arities ??= config.arities ?? {};
		if(targets.includes("cpan")) moduleName ??= config.targets?.cpan?.module;
		const inventory = await inspectLeanProject(project, { signal });
		const entries = selectLakeEntryModules({ ...config, modules }, inventory.inputs);
		const analysis = inventory;
		assertExportConfigurationSnapshot(record, analysis.inputs);
		const lean = join(resolve(leanPrefix), "bin/lean");
		const extractor = join(engineRoot, "src/analyze/NativeExports.lean");
		const leanCompilerSha256 = sha256(await readFile(lean)), extractorSha256 = sha256(await readFile(extractor));
		const probe = await run(lean, ["--version"], { signal });
		const leanVersion = probe.stdout.match(/version ([^,]+),/)?.[1];
		if(!probe.stdout.includes(pinnedNativeLean) || analysis.project.toolchain !== `leanprover/lean4:v${leanVersion}`) throw new Error("native source/compiler/runtime toolchain mismatch");
		const { manifest: runtimeManifest } = await readVerifiedNativeRuntime(runtime);
		if(runtimeManifest.leanCommit !== pinnedNativeLean) throw new Error("incompatible native runtime");
		const sources = entries.filter(entry => entry.origin.kind === "captured").map(({ module, path, bytes, sha256 }) => ({ module, path, bytes, sha256 }));
		let sourceByModule = new Map(selectSourceModules({}, analysis.inputs).map(({ module, ...input }) => [module, input]));
		for(const { module, ...input } of sources) sourceByModule.set(module, input);
		const selectedModules = modules ?? [...sourceByModule.keys()];
		if(!selectedModules.length || selectedModules.some(name => !namePattern.test(name) || !entries.some(entry => entry.module === name))) throw new Error("native module selection is invalid");
		if([...exports, ...resources, ...Object.keys(arities)].some(name => !namePattern.test(name))) throw new Error("native export selection is invalid");
		if(Object.values(arities).some(n => !Number.isSafeInteger(n) || n < 0 || n > 32)) throw new Error("invalid native export arity");
		if(lakeSnapshot) await verifyLakeSnapshotSourceTree({ snapshot: lakeSnapshot, projectRoot: project, signal });
		else lakeSnapshot = await captureLockedLakeProject({ projectRoot: project, inputs: analysis.inputs, signal });
		if(config.generators?.length && !lakeSnapshot) throw new Error("Lake generators require a captured lake-manifest.json");
		let lakeModules;
		if(lakeSnapshot)
		{
			lakeWorkspace = await resolveLakeBuildWorkspace({ snapshot: lakeSnapshot, modules: selectedModules, leanPrefix, signal });
			if(lakeWorkspace.resolution.leanCommit !== pinnedNativeLean) throw new Error("native Lake resolver/compiler identity mismatch");
			lakeModules = new Map(lakeWorkspace.resolution.modules.map(module => [module.module, module]));
			verifyLakeEntryModules(entries, lakeWorkspace.resolution);
			sourceByModule = new Map(lakeWorkspace.resolution.modules.map(module => [module.module, { ...module.source, path: module.path }]));
		}
		const sourcePathFor = (name, input) => lakeWorkspace ? `${name.replaceAll(".", "/")}.lean` : input.path;
		const originalSource = (name, input) => lakeWorkspace
			? join(lakeWorkspace.sourceRoot, sourcePathFor(name, input)) : join(project, input.path);
		const sourceRoot = join(staging, "source"), oleanRoot = join(staging, "olean");
		await mkdir(oleanRoot); const compiled = new Set(), active = new Set(), compileOrder = [];
		const sourceByPath = new Map();
		for(const [name, input] of sourceByModule)
		{
			const bytes = await readFile(originalSource(name, input));
			if(sha256(bytes) !== input.sha256) throw new Error(`native source drift: ${input.path}`);
			const path = resolve(sourceRoot, sourcePathFor(name, input));
			await save(path, bytes); sourceByPath.set(path, name);
		}
		const env = { ...process.env, LEAN_SYSROOT: resolve(leanPrefix), LEAN_PATH: oleanRoot, LEAN_SRC_PATH: sourceRoot, PATH: `${join(leanPrefix, "bin")}:${process.env.PATH}` };
		const compile = async name => {
			if(compiled.has(name)) return;
			if(active.has(name)) throw new Error(`cyclic native source imports: ${name}`);
			active.add(name);
			const input = sourceByModule.get(name), sourceBytes = await readFile(originalSource(name, input));
			if(sha256(sourceBytes) !== input.sha256) throw new Error(`native source drift: ${input.path}`);
			const path = sourcePathFor(name, input);
			const sourcePath = join(sourceRoot, path), cPath = join(staging, `c/${path.replace(/\.lean$/, ".c")}`), olean = join(oleanRoot, `${name.replaceAll(".", "/")}.olean`);
			if(lakeModules)
			{
				for(const dependency of lakeModules.get(name).imports)
					if(lakeModules.has(dependency)) await compile(dependency);
			}
			else
			{
				const dependencies = await run(lean, ["--src-deps", sourcePath], { cwd: sourceRoot, env, signal });
				for(const path of dependencies.stdout.trim().split("\n"))
				{
					const dependency = sourceByPath.get(resolve(path));
					if(dependency) await compile(dependency);
				}
			}
			await save(sourcePath, sourceBytes); await mkdir(dirname(cPath), { recursive: true }); await mkdir(dirname(olean), { recursive: true });
			await run(lean, ["-R", sourceRoot, "-o", olean, "-c", cPath, sourcePath], { cwd: sourceRoot, env, signal });
			const compiledInterface = await identifyLeanInterface(olean, signal);
			compileOrder.push({ module: name, source: input
				, interface: { ...await fileIdentity(olean), interfaceSha256: compiledInterface.interfaceSha256 }
				, c: cPath });
			active.delete(name); compiled.add(name);
		};
		for(const name of selectedModules) await compile(name);
		const selection = { profile: "native-library-v1"
			, modules: compileOrder.map(item => item.module)
			, exports, resources
			, arities: Object.entries(arities)
			, ...compilerExportSelection(config)
			, exportModules: selectedModules };
		const request = createMetadataRequest(selection, { toolchain: analysis.project.toolchain
			, leanCompilerSha256, extractorSha256
			, modules: compileOrder.map(item => ({ name: item.module
				, sourcePath: item.source.path
				, sourceSha256: item.source.sha256
				, interfaceSha256: item.interface.interfaceSha256 })) });
		await save(join(staging, "request.json"), json(request));
		const verifyElaborationInputs = async () => {
			if(sha256(await readFile(lean)) !== leanCompilerSha256 || sha256(await readFile(extractor)) !== extractorSha256)
				throw Object.assign(new Error("Native compiler or extractor changed during compilation"), { code: "native-elaboration-drift" });
			for(const item of compileOrder)
			{
				const path = join(oleanRoot, `${item.module.replaceAll(".", "/")}.olean`);
				const actual = await identifyLeanInterface(path, signal);
				if(actual.oleanSha256 !== item.interface.sha256 || actual.interfaceSha256 !== item.interface.interfaceSha256
					|| sha256(await readFile(join(sourceRoot, sourcePathFor(item.module, item.source)))) !== item.source.sha256)
					throw Object.assign(new Error(`Native source or interface changed: ${item.module}`), { code: "native-elaboration-drift" });
			}
		};
		await verifyElaborationInputs();
		const extractMetadata = async () => {
			try
			{
				const extracted = await run(lean, ["--run", extractor, "--metadata", join(staging, "request.json")], { env, signal });
				return JSON.parse(extracted.stdout);
			}
			catch(error)
			{
				signal?.throwIfAborted();
				throw Object.assign(new Error("Lean native metadata extraction failed"), { code: "lean-metadata-extractor-failed"
					, details: { category: "extractor-failure", cause: error.message, compilerDetails: error.details ?? null } });
			}
		};
		const metadata = await extractMetadata();
		const sourceIdentity = { leanVersion
			, leanCommit: pinnedNativeLean
			, leanCompilerSha256
			, sourceTreeSha256: analysis.sourceTreeSha256
			, exportConfigurationSha256: record.sha256
			, extractorSha256
			, request
			, modules: compileOrder.map(({ module, source, interface: compiledInterface }) => ({ module, source, interface: compiledInterface })) };
		if(lakeWorkspace) sourceIdentity.lakeDependencies = { ...lakeWorkspace.evidence, snapshotSha256: lakeSnapshot.sha256 };
		const model = createNativeModel({ metadata
			, component: elaboratedComponent(analysis.project)
			, moduleName: moduleName ?? (targets.includes("cpan") ? `LeanBridge::${analysis.project.name.split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("")}` : undefined)
			, sourceIdentity });
		validateModel?.(model);
		await verifyElaborationInputs();
		const adapters = generateNativeLeanAdapters(model), generated = join(sourceRoot, `${adapters.module}.lean`), generatedC = join(staging, "c/adapter.c");
		await save(generated, adapters.leanSource);
		await run(lean, ["-R", sourceRoot, "-c", generatedC, generated], { env, signal });
		await verifyElaborationInputs();
		if(canonicalJson(await extractMetadata()) !== canonicalJson(metadata))
			throw Object.assign(new Error("Native metadata changed during adapter compilation"), { code: "native-elaboration-drift" });
		await verifyElaborationInputs();
		await save(join(staging, "component.h"), adapters.header);
		// The C compiler must compare every generated ABI declaration with Lean's
		// actual emitted definition. An ABI mismatch is a build error, not a crash
		// waiting for an installed consumer.
		await save(generatedC, `${await readFile(generatedC, "utf8")}\n#include "component.h"\n`);
		let callbacks = '#include "component.h"\n#include "lean_bridge_native_runtime.h"\n';
		for(const type of model.types.filter(t => t.kind === "callback"))
		{
			const result = nativeCType(type.result), arguments_ = type.parameters.map((_, i) => `value${i}`).join(", ");
			callbacks += `${result} lb_t${type.key}_invoke(size_t token, ${type.parameters.map((p, i) => `${nativeCType(p)} value${i}`).join(", ")}) {\n  lb_native_callback cb = lb_native_callback_lookup(token);\n  if (!cb.invoke) { ${type.parameters.map((p, i) => nativeCType(p) === "lean_object *" ? `lean_dec(value${i});` : "").join(" ")} return ${callbackDefault(type.result)}; }\n  return ((${result} (*)(void *, ${type.parameters.map(nativeCType).join(", ")}))cb.invoke)(cb.context, ${arguments_});\n}\n`;
		}
		await save(join(staging, "c/callbacks.c"), callbacks);
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
			await run(cc, ["-O2", "-g0", "-fPIC", `-ffile-prefix-map=${staging}=/build/native-component`, "-I", join(leanPrefix, "include"), "-I", join(runtime, "include"), "-I", staging, "-c", path, "-o", object], { signal });
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
		const receipt = { schemaVersion: 1
			, profile: "native-library-v1"
			, runtimeIdentity: sha256(canonicalJson(runtimeManifest))
			, bindingIrSha256: model.bindingIrSha256
			, sourceIdentity
			, metadataSha256: sha256(canonicalJson(metadata))
			, modelSha256: sha256(canonicalJson(model))
			, headerSha256: sha256(adapters.header)
			, adaptersSha256: sha256(adapters.leanSource)
			, initializer: `initialize_${adapters.module}`
			, library
			, nativeLibrary: await fileIdentity(join(staging, library))
			, compiler: (await run(cc, ["--version"])).stdout.split("\n")[0]
			, ...(nativeCompilation ? { nativeCompilation: nativeCompilation.document } : {})
			, exports: model.exports.map(item => ({ declaration: item.name, symbol: item.symbol })) };
		if((await inspectLeanProject(project, { signal })).sourceTreeSha256 !== analysis.sourceTreeSha256) throw new Error("native source changed during compilation");
		if(lakeSnapshot) await verifyLakeSnapshotSourceTree({ snapshot: lakeSnapshot, projectRoot: project, signal });
		if(lakeWorkspace && sha256(await readFile(lean)) !== lakeWorkspace.document.leanCompilerSha256)
			throw new Error("native Lean compiler changed during compilation");
		await nativeCompilation?.verify();
		await lakeWorkspace?.verify();
		await verifyElaborationInputs();
		if(lakeWorkspace?.generatedSources) await save(join(staging, "lake-generated-sources.json"), json(lakeWorkspace.generatedSources.document));
		await save(join(staging, "metadata.json"), json(metadata)); await save(join(staging, "model.json"), json(model));
		await save(join(staging, "binding-ir.json"), json(model.bindingIr)); await save(join(staging, "native-component.json"), json(receipt));
		await save(join(staging, "generated.lean"), adapters.leanSource);
		for(const path of ["source", "olean", "c", "native-objects", "request.json"]) await rm(join(staging, path), { recursive: true, force: true });
		const files = {};
		for(const path of await nativeArtifactPaths(staging)) files[path] = await fileIdentity(join(staging, path));
		await save(join(staging, "artifacts.json"), json({ schemaVersion: 1, profile: "native-library-v1", files }));
		await rename(staging, output);
		return { root: output, model, receipt };
	} catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
	finally
	{ await lakeWorkspace?.dispose(); }
	};
