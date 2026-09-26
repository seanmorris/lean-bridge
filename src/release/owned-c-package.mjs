/**
 * Prepared owned-value C archives with runtime, exact integers and build metadata.
 *
 * @file
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { validateNativeCSettings } from "./native-c-family.mjs";

/**
 * Verify generated files against compiler facts and archive without compilation.
 *
 * @param options - Verified native roots and output archive coordinates.
 * @param options.working - Exclusively owned package staging directory.
 * @param options.adapterRoot - Public C adapter directory and receipt.
 * @param options.nativeRoot - Compiler-authenticated native component directory.
 * @param options.runtimeRoot - Verified shared runtime directory.
 * @param options.leanPrefix - Pinned Lean distribution containing license notices.
 * @param options.settings - Public C package name and version.
 * @param options.glibcMinimumVersion - Verified minimum target glibc version.
 */
export const packageOwnedNativeC = async ({ working, adapterRoot, nativeRoot, runtimeRoot, leanPrefix, settings = {}, glibcMinimumVersion }) => {
	validateNativeCSettings(settings);
	const { manifest: runtime, identity: runtimeIdentity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, runtimeIdentity, { ownedGraphs: true, ownedHostCallbacks: true });
	if(!model.ownedGraph) throw new TypeError("Owned C packaging requires a v4 native component");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const hostCallbacks = Boolean(model.ownedGraph.hostCallbacks);
	const generated = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks });
	const p = generated.values.prefix, adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== (hostCallbacks ? 3 : 2) || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== runtimeIdentity
		|| adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt)) || adapter.bindingIrSha256 !== model.bindingIrSha256
		|| adapter.library !== `lib${p}.so` || adapter.ownedValues?.schemaVersion !== (hostCallbacks ? 2 : 1) || adapter.gmp?.version !== "6.3.0"
		|| canonicalJson(adapter.ownedValues.hostCallbacks ?? null) !== canonicalJson(model.ownedGraph.hostCallbacks ?? null)
		|| adapter.ownedValues.headerSha256 !== sha256(generated.publicHeader) || adapter.ownedValues.sourceSha256 !== sha256(generated.source)
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path)))
		throw new Error("Owned C adapter differs from compiler-authenticated types or runtime");
	for(const [path, source] of Object.entries(generated.files))
		if(source !== await readFile(join(adapterRoot, path), "utf8")) throw new Error(`Owned C generated source differs: ${path}`);
	const name = settings.name ?? p.replaceAll("_", "-"), version = settings.version ?? model.component.version;
	validateNativeCSettings({ name, version });
	const archiveRoot = `${name}-${version}-c`, root = join(working, "packages/c", archiveRoot);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (from, path) => { await mkdir(dirname(join(root, path)), { recursive: true }); await copyFile(from, join(root, path), 1); };
	await copy(join(adapterRoot, `include/${p}.h`), `include/${p}.h`);
	for(const path of Object.keys(adapter.files).filter(path => /^gmp\/(include|lib|share)\//u.test(path)))
		await copy(join(adapterRoot, path), path.slice(4));
	await copy(join(adapterRoot, "lib", adapter.library), `lib/${adapter.library}`);
	await copy(join(nativeRoot, receipt.library), `lib/${receipt.library}`);
	for(const path of Object.keys(runtime.files).filter(path => path.startsWith("lib/"))) await copy(join(runtimeRoot, path), path);
	const evidence = "share/lean-bridge";
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `${evidence}/component/${path}`);
	if(hostCallbacks) await copy(join(nativeRoot, "callbacks.c"), `${evidence}/component/callbacks.c`);
	const generatedDigest = receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256;
	if(generatedDigest !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== generatedDigest) throw new Error("Owned native generated sources differ from compilation");
		await save(`${evidence}/component/lake-generated-sources.json`, bytes);
	}
	await copy(join(runtimeRoot, "runtime.json"), `${evidence}/runtime.json`);
	await copy(join(adapterRoot, "native-c-adapter.json"), `${evidence}/native-c-adapter.json`);
	await copy(join(leanPrefix, "LICENSE"), `${evidence}/licenses/Lean-LICENSE`);
	await copy(join(leanPrefix, "LICENSES"), `${evidence}/licenses/Lean-LICENSES`);
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`${evidence}/licenses/${path}`, bytes);
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), `${evidence}/licenses/LeanBridge-LICENSE`);
	await save("package-metadata.json", canonicalJson(compiledPackageMetadata(model.sourceIdentity)));
	const cmakePackage = `LeanBridge${p.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("")}`, cmakeTarget = `LeanBridge::${p}`;
	await save(`lib/pkgconfig/${name}.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib

Name: ${name}
Description: Compiled Lean ${model.component.name} ownership-aware C11 API
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p} -l:libgmp.so.10
Cflags: -I\${includedir}
`);
	await save(`lib/cmake/${cmakePackage}/${cmakePackage}Config.cmake`, `get_filename_component(_LB_PREFIX "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
if(NOT TARGET ${cmakeTarget})
  add_library(${cmakeTarget} SHARED IMPORTED)
  set_target_properties(${cmakeTarget} PROPERTIES
    IMPORTED_LOCATION "\${_LB_PREFIX}/lib/${adapter.library}"
    INTERFACE_INCLUDE_DIRECTORIES "\${_LB_PREFIX}/include"
    INTERFACE_COMPILE_FEATURES "c_std_11"
    INTERFACE_LINK_LIBRARIES "\${_LB_PREFIX}/lib/libgmp.so.10"
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
	await save("README.md", `# ${name} ${version}

Compiled ownership-aware C11 API from ${model.component.id}. Linux x86-64,
glibc ${glibcMinimumVersion} or newer. Consumers do not need Lean. The archive includes
the shared Lean runtime and GMP 6.3.0 with headers, corresponding source and notices.

Include ${p}.h. Use pkg-config package ${name}, or
find_package(${cmakePackage} CONFIG REQUIRED) and link ${cmakeTarget}.
Both methods link GMP automatically. The libraries load their bundled dependencies.

Open a session with ${p}_session_open. Each successful call returns a typed value
view and a separate result owner. Release that owner with ${p}_result_release.
Copying a view does not create ownership. Retain a resource or returned Lean closure
with its generated _retain function to keep it beyond the original owner's lifetime.
Close sessions with ${p}_session_close. Copied result storage survives session close
until result release; resource calls do not. Sessions and results belong to their
creating thread and process. Inherited handles reject after fork. Cleanup remains
available after runtime retirement. Initialize output handles to NULL; functions
publish outputs only on success. Keep and release earlier owners before reusing slots.

Records use named fields, variants use named KIND enums and named payloads, and
containers use typed spans, has_value, is_ok and fst/snd. Nat and Int are borrowed
read-only mpz_srcptr views. Initialize caller integers with mpz_init, assign using
mpz_set, and finish them with mpz_clear. Do not clear or mutate returned integers.
GMP uses its default fatal allocation-failure policy. Strings are length-delimited
UTF-8, including NUL; bytes are uninterpreted. Inputs must point to readable storage.

Each C conversion and native conversion has its own cumulative 16 MiB storage and
262,144-visit budget. Value depth is limited to 128, cycles reject, and native
transactions retain at most 4,096 references. Limits do not cap Lean algorithm
working memory or every GMP allocator overhead. Invalid input or bridge allocation
failure preserves outputs and releases partial ownership. Malformed native replies
retire the runtime. Returned Lean closures have typed _call operations. ${hostCallbacks ? `Host
callbacks use generated _host descriptors with call/context or an existing closure.
The descriptor borrows the enclosing call's lifetime. Lean cannot invoke a host
callback after that borrow ends. Callback arguments expire on return. Reply views
may borrow those arguments or context storage; use a generated _copy function for
callback-local storage. Transfer its result owner with the reply, including on
error. The bridge releases that owner and retains returned resources for the caller.

REQUIRES_RECOVERY macros identify signatures that need a real typed recovery value
in the descriptor before the call starts. Other signatures recover from real
arguments or productive constructors. The bridge never fabricates a resource or
publishes a recovery value as successful output. Callback failure suppresses later
host invocations in the same call; subsequent independent calls can recover.
No C++ exception or longjmp may cross a callback boundary.` : `Construction
of host callbacks for owned payloads is not implemented in this transport yet.`}

${generated.values.functions.map(item => `- ${item.name}: ${item.id}`).join("\n")}
`);
	const files = [];
	for(const path of await nativeArtifactPaths(root)) files.push({ path, bytes: await readFile(join(root, path)), mode: 0o644 });
	const manifest = { schemaVersion: hostCallbacks ? 3 : 2
		, kind: "lean-bridge-native-c-package"
		, ecosystem: "c", name, version, component: model.component
		, profile: "native-library-v1"
		, runtimeIdentity, bindingIrSha256: model.bindingIrSha256, glibcMinimumVersion
		, cmakePackage, cmakeTarget, pkgConfig: name, exactIntegers: "gmp-6.3.0"
		, ownedValues: adapter.ownedValues
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
	return { ecosystem: "c"
		, backend: hostCallbacks ? "native-c-owned-v2" : "native-c-owned-v1"
		, runtimeIdentity
		, glibcMinimumVersion
		, packages: [{ archive, sha256: sha256(bytes), bytes: bytes.length, name, version, compilerAccess: false }]
		, cmakePackage, cmakeTarget, pkgConfig: name };
};
