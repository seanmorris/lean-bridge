/**
 * Compiler-free prepared C/C++ archives from verified native artifacts.
 *
 * @file
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { compilePrimitiveCSurface } from "../backends/c/primitive-surface.mjs";

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
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, runtimeIdentity);
	const surface = compilePrimitiveCSurface(model.bindingIr), p = surface.prefix;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== 1 || adapter.profile !== "native-library-v1"
		|| adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt)) || adapter.runtimeIdentity !== runtimeIdentity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.library !== `lib${p}.so`
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path))) throw new Error("C adapter differs from compiled component");
	const name = settings.name ?? p.replaceAll("_", "-"), version = settings.version ?? model.component.version;
	validateNativeCSettings({ name, version });
	const archiveRoot = `${name}-${version}-${target}`, root = join(working, "packages", target, archiveRoot);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (from, path) => { await mkdir(dirname(join(root, path)), { recursive: true }); await copyFile(from, join(root, path), 1); };
	await copy(join(adapterRoot, `include/${p}.h`), `include/${p}.h`);
	if(target === "cpp") await copy(join(adapterRoot, `include/${p}.hpp`), `include/${p}.hpp`);
	await copy(join(adapterRoot, "lib", adapter.library), `lib/${adapter.library}`);
	await copy(join(nativeRoot, receipt.library), `lib/${receipt.library}`);
	for(const path of Object.keys(runtime.files).filter(path => path.startsWith("lib/"))) await copy(join(runtimeRoot, path), path);
	const evidence = "share/lean-bridge";
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "artifacts.json"])
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
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), `${evidence}/licenses/LeanBridge-LICENSE`);
	const cmakePackage = `LeanBridge${p.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("")}`;
	const cmakeTarget = `LeanBridge::${p}`;
	await save(`lib/pkgconfig/${name}.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib

Name: ${name}
Description: Compiled Lean ${model.component.name} ${target === "cpp" ? "C++20" : "C11"} API
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p}
Cflags: -I\${includedir}
`);
	const copiedGuide = surface.copies.some(copy => copy.record || copy.element)
		? "\n\nArrays and acyclic records can nest up to 32 types deep. C spans own their nested elements through their release callback; record clear functions clear their fields. Do not shallow-copy an owned result and clear both copies. C++ uses owned vectors and structs, with scoped input views. The 16 MiB conversion budget includes input and output payloads, array slots (at least pointer-sized), output ownership headers and record storage; it does not bound the Lean algorithm's working memory."
		: "";
	await save(`lib/cmake/${cmakePackage}/${cmakePackage}Config.cmake`, `get_filename_component(_LB_PREFIX "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
if(NOT TARGET ${cmakeTarget})
  add_library(${cmakeTarget} SHARED IMPORTED)
  set_target_properties(${cmakeTarget} PROPERTIES
    IMPORTED_LOCATION "\${_LB_PREFIX}/lib/${adapter.library}"
    INTERFACE_INCLUDE_DIRECTORIES "\${_LB_PREFIX}/include"
    INTERFACE_COMPILE_FEATURES "${target === "cpp" ? "cxx_std_20" : "c_std_11"}"
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
	await save("README.md", `# ${name} ${version}\n\nCompiled ${target === "cpp" ? "C++20 and C11" : "C11"} API from ${model.component.id}. Linux x86-64, glibc ${glibcMinimumVersion} or newer. Lean is not required by consumers. The shared native runtime is included in lib/ and loads automatically.\n\nInclude ${p}.${target === "cpp" ? "hpp" : "h"}. Use pkg-config package ${name}, or find_package(${cmakePackage} CONFIG REQUIRED) and link ${cmakeTarget}. C++ functions live in lean_bridge::${p}.\n\nC inputs borrow caller buffers for one call. Initialize result structs to zero and call the matching ${p}_TYPE_clear function after use, before reusing a result slot. Clear is idempotent. C++ results own their memory and release C buffers automatically, including when a C++ allocation throws.\n\nStrings are length-delimited UTF-8, including embedded NUL. Byte arrays are uninterpreted bytes. Nat/Int use little-endian uint32 limbs; an empty span is zero, and Int carries a negative flag. Unit parameters are zero in C and std::monostate in C++; Unit results have no output. Fixed-width integers use exact-width host types; floating-point values retain IEEE special values. Input and output copies share a 16 MiB per-call budget. Invalid input leaves the output unchanged and returns a status (C) or throws Error (C++).${copiedGuide}\n\n${surface.functions.map(fn => `- ${fn.name}: ${fn.declaration.id}`).join("\n")}\n`);
	const files = [];
	for(const path of await nativeArtifactPaths(root)) files.push({ path, bytes: await readFile(join(root, path)), mode: 0o644 });
	const manifest = { schemaVersion: 1, kind: "lean-bridge-native-c-package"
		, ecosystem: target, name, version, component: model.component
		, profile: "native-library-v1", runtimeIdentity
		, bindingIrSha256: model.bindingIrSha256
		, glibcMinimumVersion, cmakePackage, cmakeTarget, pkgConfig: name
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
	return { ecosystem: target, backend: "native-c-primitives-v1"
		, runtimeIdentity, glibcMinimumVersion
		, packages: [{ archive, sha256: sha256(bytes), bytes: bytes.length, name, version, compilerAccess: false }]
		, cmakePackage, cmakeTarget, pkgConfig: name };
};
