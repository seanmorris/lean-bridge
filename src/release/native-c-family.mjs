/**
 * Compiler-free prepared C/C++ archives from verified native artifacts.
 *
 * @file
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { compilePrimitiveCSurface } from "../backends/c/primitive-surface.mjs";
import { compileCopiedGraphPackageModel } from "../backends/c/graph-package.mjs";

const graphGuide = target => "\n\nRecursive copied records and named variants use a finite type graph. Values must be finite and acyclic, with at most 128 levels and 262,144 visited nodes per call. All inputs and the result share a 16 MiB native-copy budget; host conversion storage has a separate 16 MiB budget. Limits include container slots and ownership bookkeeping, not the Lean algorithm's working memory. Invalid arguments and limit failures report INVALID_ARGUMENT. Bridge allocation failures report UNEXPECTED_ERROR; malformed native results retire the shared runtime and later calls reject. Already owned results can still be released."

	+ (target === "cpp"
		? "\n\nC++ uses owned strings, vectors, optional values, pairs and named structs. Variants have a named struct for each constructor; inspect value with std::get, std::holds_alternative or std::visit. Recursive fields that require indirection use Box<T>; copying a box makes an independent deep copy. Empty required boxes reject. None, Some(None), Unit and empty constructors remain distinct. Calls return owned values, throw Error with status/code on bridge failures, or propagate std::bad_alloc for C++ allocation failures. Input and native output views are released during exception unwinding. Do not mutate input values concurrently with a call."
		: "\n\nC variants use named KIND constants and a union of named cases. Initialize a value with _init, select a constructor with _select, then assign that constructor's fields. _select returns STATUS_OK on success and preserves the value on invalid selections. A freshly initialized or cleared variant has no active constructor until selected. Do not assign kind directly. Caller inputs borrow pointer/span children for one call. Initialize every output before calling; success replaces the previous owned output and failure preserves it. An output root owns its nested data through private bookkeeping. Clear or select only the owning root, never a borrowed child view. Do not shallow-copy owned outputs or alter private ownership fields. An initialized caller-built parent may own an inline returned child; clearing that parent releases the child. Clear is idempotent. GMP integers in active fields are initialized already: assign with mpz_set, not mpz_init. Never overwrite them with a shallow struct copy. Finish standalone integers with mpz_clear.");

/**
 * Validate archive coordinates before any native compilation.
 *
 * @param settings - Optional target name and version.
 */
export const validateNativeCSettings = (settings = {}) => {
	if(settings.name !== undefined && !/^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/.test(settings.name)) throw new TypeError("C/C++ package name must be a lowercase archive coordinate");
	if(settings.version !== undefined && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(settings.version)) throw new TypeError("C/C++ package version must use semantic version syntax");
};

/**
 * Arrange exact native bytes and integration metadata; never invoke a compiler.
 *
 * @param options - Verified component, runtime, adapter and archive coordinates.
 * @param options.working - Private release staging directory.
 * @param options.adapterRoot - Compiled C adapter directory.
 * @param options.nativeRoot - Compiled native component directory.
 * @param options.runtimeRoot - Verified runtime directory.
 * @param options.leanPrefix - Pinned Lean installation containing license notices.
 * @param options.target - C-family ecosystem to package.
 * @param options.settings - Validated package name and version.
 * @param options.glibcMinimumVersion - Verified Linux glibc compatibility floor.
 */
export const packageNativeCFamily = async ({ working, adapterRoot, nativeRoot, runtimeRoot, leanPrefix, target, settings = {}, glibcMinimumVersion }) => {
	if(!["c", "cpp"].includes(target)) throw new TypeError("Unsupported native C-family target");
	validateNativeCSettings(settings);
	const { manifest: runtime, identity: runtimeIdentity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, runtimeIdentity, { copiedGraphs: true });
	const graph = model.copiedGraph ? compileCopiedGraphPackageModel(model.bindingIr, [target]) : null;
	const surface = graph ? null : compilePrimitiveCSurface(model.bindingIr, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true }), p = graph ? graph.prefix : surface.prefix;
	const bigint = target === "cpp" && (graph ? graph.bigint : surface.copies.some(copy => ["nat", "int"].includes(copy.scalarName)));
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	const gmp = target === "c" && (graph !== null || surface.copies.some(copy => ["nat", "int"].includes(copy.scalarName)));
	if(gmp && (adapter.gmp?.library !== `lib${p}_gmp.so` || adapter.gmp.version !== "6.3.0")) throw new Error("C GMP projection is missing or differs");
	const publicLibrary = gmp ? adapter.gmp.library : adapter.library;
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== 1 || adapter.profile !== "native-library-v1"
		|| adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt)) || adapter.runtimeIdentity !== runtimeIdentity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.library !== `lib${p}.so`
		|| (graph ? adapter.copiedGraph?.schemaVersion !== 1 || adapter.copiedGraph.layoutSha256 !== graph.layoutSha256 : adapter.copiedGraph !== undefined)
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path))) throw new Error("C adapter differs from compiled component");
	const name = settings.name ?? p.replaceAll("_", "-"), version = settings.version ?? model.component.version;
	validateNativeCSettings({ name, version });
	const archiveRoot = `${name}-${version}-${target}`, root = join(working, "packages", target, archiveRoot);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (from, path) => { await mkdir(dirname(join(root, path)), { recursive: true }); await copyFile(from, join(root, path), 1); };
	if(gmp)
	{
		for(const path of Object.keys(adapter.files).filter(path => /^gmp\/(include|lib|share)\//.test(path))) await copy(join(adapterRoot, path), path.slice(4));
	} else if(graph)
	{
		for(const path of Object.keys(adapter.files).filter(path => path.startsWith("include/"))) await copy(join(adapterRoot, path), path);
	} else await copy(join(adapterRoot, `include/${p}.h`), `include/${p}.h`);
	if(target === "cpp" && !graph) await copy(join(adapterRoot, `include/${p}.hpp`), `include/${p}.hpp`);
	if(target === "cpp") for(const path of Object.keys(adapter.files).filter(path => (!graph && path.startsWith("include/boost/")) || path === "share/lean-bridge/boost.json" || path === "share/lean-bridge/licenses/Boost-LICENSE"))
		await copy(join(adapterRoot, path), path);
	await copy(join(adapterRoot, "lib", adapter.library), `lib/${adapter.library}`);
	await copy(join(nativeRoot, receipt.library), `lib/${receipt.library}`);
	for(const path of Object.keys(runtime.files).filter(path => path.startsWith("lib/"))) await copy(join(runtimeRoot, path), path);
	const evidence = "share/lean-bridge";
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `${evidence}/component/${path}`);
	const generatedDigest = receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256;
	if(generatedDigest !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== generatedDigest) throw new Error("Native generated source handoff differs from compilation");
		await save(`${evidence}/component/lake-generated-sources.json`, bytes);
	}
	await copy(join(runtimeRoot, "runtime.json"), `${evidence}/runtime.json`);
	await copy(join(adapterRoot, "native-c-adapter.json"), `${evidence}/native-c-adapter.json`);
	await copy(join(leanPrefix, "LICENSE"), `${evidence}/licenses/Lean-LICENSE`);
	await copy(join(leanPrefix, "LICENSES"), `${evidence}/licenses/Lean-LICENSES`);
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`${evidence}/licenses/${path}`, bytes);
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), `${evidence}/licenses/LeanBridge-LICENSE`);
	const cmakePackage = `LeanBridge${p.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("")}`;
	const cmakeTarget = `LeanBridge::${p}`;
	await save("package-metadata.json", canonicalJson(compiledPackageMetadata(model.sourceIdentity)));
	await save(`lib/pkgconfig/${name}.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib

Name: ${name}
Description: Compiled Lean ${model.component.name} ${target === "cpp" ? "C++20" : "C11"} API
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p}${gmp ? "_gmp -l:libgmp.so.10" : ""}
Cflags: -I\${includedir}${bigint ? " -DBOOST_MP_STANDALONE" : ""}
`);
	const callableGuide = surface?.callbacks.size
		? (target === "cpp" ? "\n\nPass typed C++ lambdas or functions for synchronous callbacks. Arguments are owned values and results must match the declared type exactly; Unit results return void. Move-only callbacks are supported. Exceptions are contained before C and rethrown after the native call returns. The first failure suppresses later host invocations. Returned LeanClosure<Result(Args...)> values are move-only: call(...) or operator() invokes them, close() releases explicitly, and destruction releases automatically. Invoke and close on the creating thread. Moving a closure does not change its creating thread. Calls after close and inherited calls after fork reject. Active invocation defers self-close until return."
			: "\n\nSynchronous callbacks use the signature-specific function/context structs in the public header. Keep them valid until the Lean call returns. Dynamic callback arguments are borrowed views with null ownership fields. Return a borrowed view or an owned buffer with its release hook; the adapter copies and then releases callback results, including failed results. Return normally with a status; do not unwind across Lean frames. The first callback failure suppresses later host invocations in that call. Error text is thread-local, limited to 1023 bytes, and valid until the next failing call on that thread. Returned closures use generated _call and pointer-to-pointer _dispose functions. Invoke them on the creating thread, dispose once per owning pointer, and never use an alias after disposal.")
			+ " Call-scoped host callbacks cannot be retained by Lean. Nested callable calls are limited to 64; the 16 MiB budget includes callback conversions. Closure leases share the runtime's 4096-identity capacity."
		: "";
	const copiedGuide = graph ? graphGuide(target) : (surface.copies.some(copy => copy.record || copy.element)
		? "\n\nArrays and acyclic records can nest up to 32 types deep. C spans own their nested elements through their release callback; record clear functions clear their fields. Do not shallow-copy an owned result and clear both copies. C++ uses owned vectors and structs, with scoped input views. The 16 MiB conversion budget includes input and output payloads, array slots (at least pointer-sized), output ownership headers and record storage; it does not bound the Lean algorithm's working memory."
		: "") + (surface.copies.some(copy => copy.variant)
		? (target === "cpp"
			? "\n\nTagged Lean variants use std::variant with one named struct per constructor. Construct and inspect named alternatives with std::get, std::holds_alternative or std::visit; consumers do not supply constructor numbers. Empty constructors remain distinct and Unit fields use std::monostate. Payloads may nest supported copied values. Field names use snake_case; reserved C++ keywords gain a trailing underscore. Generated Lean helpers keep compiler object tags and field offsets private. Only the active case is read, copied or cleared. Variants share the 32-level type limit and the 16 MiB conversion budget. Recursive, callable and identity-bearing payloads are not supported."
			: "\n\nTagged Lean variants use named KIND constructor constants and a union of named case fields. Initialize with the generated _init function, then call _select with a named constructor tag before filling its fields. Selection releases the previous active payload and initializes the new one, including mpz_t fields. Read kind to choose the active case; do not assign it directly or shallow-copy an owned result. Invalid selections leave the value unchanged. _clear releases the active payload and restores the initialized first constructor; repeated clear is safe. Initialize output slots before calls, and clear an earlier owned result before reusing its slot. Failed calls leave the supplied output slot unchanged. Empty constructors and Unit fields remain distinct. Generated Lean helpers keep compiler object tags and field offsets private. Variants share the 32-level type limit and 16 MiB conversion budget. Recursive, callable and identity-bearing payloads remain unsupported.")
		: "") + callableGuide;
	await save(`lib/cmake/${cmakePackage}/${cmakePackage}Config.cmake`, `get_filename_component(_LB_PREFIX "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
if(NOT TARGET ${cmakeTarget})
  add_library(${cmakeTarget} SHARED IMPORTED)
  set_target_properties(${cmakeTarget} PROPERTIES
    IMPORTED_LOCATION "\${_LB_PREFIX}/lib/${publicLibrary}"
    INTERFACE_INCLUDE_DIRECTORIES "\${_LB_PREFIX}/include"
    INTERFACE_COMPILE_FEATURES "${target === "cpp" ? "cxx_std_20" : "c_std_11"}"
${bigint ? '    INTERFACE_COMPILE_DEFINITIONS "BOOST_MP_STANDALONE"\n' : ""}\
${gmp ? '    INTERFACE_LINK_LIBRARIES "${_LB_PREFIX}/lib/libgmp.so.10"\n' : ""}\
  )
endif()
unset(_LB_PREFIX)
`);
	await save(`lib/cmake/${cmakePackage}/${cmakePackage}ConfigVersion.cmake`, `set(PACKAGE_VERSION "${version}")
if(PACKAGE_FIND_VERSION VERSION_EQUAL PACKAGE_VERSION)
  set(PACKAGE_VERSION_EXACT TRUE)
  set(PACKAGE_VERSION_COMPATIBLE TRUE)
else()
  set(PACKAGE_VERSION_COMPATIBLE FALSE)
endif()
`);
	const cInitialization = gmp
		? `Initialize Nat/Int with mpz_init and aggregate structs with ${p}_TYPE_init before first use. Never initialize an mpz_t with a shallow struct copy. Nat/Int inputs are borrowed mpz_srcptr values; outputs are initialized mpz_ptr values. Successful calls replace initialized copied outputs; failures leave them unchanged. Clear structs with ${p}_TYPE_clear. Clear resets their fields to initialized empty values and is idempotent. Finish standalone integers with mpz_clear. GMP callback inputs are borrowed read-only values; callback output integers are already initialized, so assign with mpz_set, not mpz_init. Do not clear callback integer arguments or outputs.`
		: `Initialize C result structs to zero and call the matching ${p}_TYPE_clear function after use, before reusing a result slot. Clear is idempotent.`;
	const integerGuide = target === "cpp"
		? "Nat and Int are Boost.Multiprecision cpp_int values. Negative Nat inputs reject. Packages using these types include Boost 1.90.0 standalone headers, license and source hashes; CMake and pkg-config configure them automatically."
		: gmp ? "Nat and Int are GMP mpz_t values. Negative Nat inputs reject. GMP 6.3.0 headers and a replaceable shared library ship in the archive and link automatically through CMake or pkg-config. Its complete corresponding source, build settings and LGPL/GPL notices are under share/lean-bridge/. GMP allocation failures abort by default; the bridge does not replace GMP allocation hooks."
			: "This package has no arbitrary-integer values and does not require GMP.";
	const exports = graph ? graph.layout.roots.map(fn => `- ${fn.name}: ${fn.bindingId}`) : surface.functions.map(fn => `- ${fn.name}: ${fn.declaration.id}`);
	const initialization = graph ? (target === "cpp" ? "C++ results own their memory and release native buffers automatically, including when a C++ allocation throws."
		: `Initialize Nat/Int with mpz_init and aggregate structs with ${p}_TYPE_init before first use. C inputs borrow caller buffers for one call. The recursive C value API includes GMP in every package; CMake and pkg-config link it automatically.`)
		: `C inputs borrow caller buffers for one call. ${cInitialization} C++ results own their memory and release C buffers automatically, including when a C++ allocation throws.`;
	await save("README.md", `# ${name} ${version}\n\nCompiled ${target === "cpp" ? graph ? "C++20" : "C++20 and C11" : "C11"} API from ${model.component.id}. Linux x86-64, glibc ${glibcMinimumVersion} or newer. Lean is not required by consumers. The shared native runtime is included in lib/ and loads automatically.\n\nInclude ${p}.${target === "cpp" ? "hpp" : "h"}. Use pkg-config package ${name}, or find_package(${cmakePackage} CONFIG REQUIRED) and link ${cmakeTarget}. C++ functions live in lean_bridge::${p}.\n\n${initialization}\n\nStrings are length-delimited UTF-8, including embedded NUL. Byte arrays are uninterpreted bytes. ${integerGuide} Unit parameters are zero in C and std::monostate in C++; Unit results have no output. Fixed-width integers use exact-width host types; floating-point values retain IEEE special values. Input and output copies share a 16 MiB per-call budget. Invalid input leaves the output unchanged and returns a status (C) or throws Error (C++).${copiedGuide}\n\n${exports.join("\n")}\n`);
	const files = [];
	for(const path of await nativeArtifactPaths(root)) files.push({ path, bytes: await readFile(join(root, path)), mode: 0o644 });
	const manifest = { schemaVersion: 1, kind: "lean-bridge-native-c-package"
		, ecosystem: target, name, version, component: model.component
		, profile: "native-library-v1", runtimeIdentity
		, bindingIrSha256: model.bindingIrSha256
		, glibcMinimumVersion
		, cmakePackage
		, cmakeTarget
		, pkgConfig: name
		, ...(gmp ? { exactIntegers: "gmp-6.3.0" } : {})
		, ...graph ? { copiedGraph: { schemaVersion: 1, layoutSha256: graph.layoutSha256 } } : {}
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, adapterReceiptSha256: sha256(canonicalJson(adapter))
		, files: Object.fromEntries(files.map(file => [file.path, { bytes: file.bytes.length, sha256: sha256(file.bytes) }])) };
	const manifestBytes = Buffer.from(canonicalJson(manifest));
	await save("lean-bridge-package.json", manifestBytes);
	files.push({ path: "lean-bridge-package.json", bytes: manifestBytes, mode: 0o644 });
	const archive = `${archiveRoot}.tar.gz`;
	const bytes = createDeterministicTarGzFromFiles({ files: files.map(file => ({ ...file, path: `${archiveRoot}/${file.path}` })), sourceDateEpoch: 1 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: target
		, backend: graph ? "native-c-graphs-v1" : "native-c-primitives-v1"
		, runtimeIdentity, glibcMinimumVersion
		, packages: [{ archive, sha256: sha256(bytes), bytes: bytes.length, name, version, compilerAccess: false }]
		, cmakePackage, cmakeTarget, pkgConfig: name };
};
