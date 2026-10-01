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
import { generateOwnedCppPackage } from "../backends/cpp/owned-package.mjs";
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
 * @param options.target - C or C++ host package to assemble.
 * @param options.glibcMinimumVersion - Verified minimum target glibc version.
 */
export const packageOwnedNativeC = async ({ working, adapterRoot, nativeRoot, runtimeRoot, leanPrefix, target = "c", settings = {}, glibcMinimumVersion }) => {
	if(!["c", "cpp"].includes(target)) throw new TypeError("Owned native packaging requires c or cpp");
	validateNativeCSettings(settings);
	const { manifest: runtime, identity: runtimeIdentity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, runtimeIdentity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: target === "c" });
	if(!model.ownedGraph) throw new TypeError("Owned C packaging requires a v4 native component");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const hostCallbacks = Boolean(model.ownedGraph.hostCallbacks);
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const anchoredResults = Boolean(model.ownedGraph.resultAnchors);
	const receiverExports = Boolean(model.ownedGraph.receiverExports);
	const generated = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks, transferredInputs, anchoredResults, receiverExports });
	const p = generated.values.prefix, adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	const cpp = adapter.cppValues ? generateOwnedCppPackage(model.bindingIr, { transferredInputs, anchoredResults }) : null;
	if((target === "cpp" && !cpp) || (cpp && !hostCallbacks) || canonicalJson(adapter.cppValues ?? null) !== canonicalJson(cpp?.contract ?? null))
		throw new Error("Owned C++ adapter differs from compiler-authenticated types or lifetime rules");
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== (receiverExports ? 6 : anchoredResults ? 5 : transferredInputs ? 4 : hostCallbacks ? 3 : 2) || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== runtimeIdentity
		|| adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt)) || adapter.bindingIrSha256 !== model.bindingIrSha256
		|| adapter.library !== `lib${p}.so` || adapter.ownedValues?.schemaVersion !== (receiverExports ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : hostCallbacks ? 2 : 1) || adapter.gmp?.version !== "6.3.0"
		|| canonicalJson(adapter.ownedValues.inputTransfers ?? null) !== canonicalJson(model.ownedGraph.inputTransfers ?? null)
		|| canonicalJson(adapter.ownedValues.resultAnchors ?? null) !== canonicalJson(model.ownedGraph.resultAnchors ?? null)
		|| canonicalJson(adapter.ownedValues.receiverExports ?? null) !== canonicalJson(model.ownedGraph.receiverExports ?? null)
		|| canonicalJson(adapter.ownedValues.hostCallbacks ?? null) !== canonicalJson(model.ownedGraph.hostCallbacks ?? null)
		|| adapter.ownedValues.headerSha256 !== sha256(generated.publicHeader) || adapter.ownedValues.sourceSha256 !== sha256(generated.source)
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path)))
		throw new Error("Owned C adapter differs from compiler-authenticated types or runtime");
	for(const [path, source] of Object.entries({ ...generated.files, ...cpp?.files }))
		if(source !== await readFile(join(adapterRoot, path), "utf8")) throw new Error(`Owned C generated source differs: ${path}`);
	const name = settings.name ?? p.replaceAll("_", "-"), version = settings.version ?? model.component.version;
	validateNativeCSettings({ name, version });
	const archiveRoot = `${name}-${version}-${target}`, root = join(working, "packages", target, archiveRoot);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (from, path) => { await mkdir(dirname(join(root, path)), { recursive: true }); await copyFile(from, join(root, path), 1); };
	await copy(join(adapterRoot, `include/${p}.h`), `include/${p}.h`);
	if(target === "cpp") for(const path of Object.keys(cpp.files).filter(path => !path.startsWith("src/")))
		await copy(join(adapterRoot, path), path);
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
	const cmakePackage = `LeanBridge${p.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("")}${target === "cpp" ? "Cpp" : ""}`, cmakeTarget = `LeanBridge::${p}${target === "cpp" ? "_cpp" : ""}`;
	await save(`lib/pkgconfig/${name}.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib

Name: ${name}
Description: Compiled Lean ${model.component.name} ownership-aware ${target === "cpp" ? "C++20" : "C11"} API
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p} -l:libgmp.so.10${target === "cpp" ? " -pthread" : ""}
Cflags: -I\${includedir}${target === "cpp" ? " -pthread" : ""}${target === "cpp" && cpp.contract.boost ? " -DBOOST_MP_STANDALONE" : ""}
`);
	await save(`lib/cmake/${cmakePackage}/${cmakePackage}Config.cmake`, `${target === "cpp" ? "include(CMakeFindDependencyMacro)\nfind_dependency(Threads REQUIRED)\n" : ""}get_filename_component(_LB_PREFIX "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
if(NOT TARGET ${cmakeTarget})
  add_library(${cmakeTarget} SHARED IMPORTED)
  set_target_properties(${cmakeTarget} PROPERTIES
    IMPORTED_LOCATION "\${_LB_PREFIX}/lib/${adapter.library}"
    INTERFACE_INCLUDE_DIRECTORIES "\${_LB_PREFIX}/include"
    INTERFACE_COMPILE_FEATURES "${target === "cpp" ? "cxx_std_20" : "c_std_11"}"${target === "cpp" && cpp.contract.boost ? '\n    INTERFACE_COMPILE_DEFINITIONS "BOOST_MP_STANDALONE"' : ""}
    INTERFACE_LINK_LIBRARIES "\${_LB_PREFIX}/lib/libgmp.so.10${target === "cpp" ? ";Threads::Threads" : ""}"
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
	await save("README.md", target === "cpp" ? `# ${name} ${version}

Compiled ownership-aware C++20 API from ${model.component.id}. Linux x86-64,
glibc ${glibcMinimumVersion} or newer. Consumers need a C++20 compiler, not Lean.
The archive includes the shared Lean runtime, GMP 6.3.0 with corresponding source
and notices, and ${cpp.contract.boost ? "pinned Boost 1.90.0 standalone headers and notices" : "generated value headers"}.

Include ${p}.hpp. Functions live in lean_bridge::${p}. Use pkg-config package
${name}, or find_package(${cmakePackage} CONFIG REQUIRED) and link ${cmakeTarget}.
Both methods supply the GMP and thread dependencies; bundled libraries load
automatically. Do not link the Lean shared library directly into a C++ executable.

Records and variants have source-named fields and constructors. Arrays and lists
are std::vector, options are std::optional, tuples are std::pair, and Result<T,E>
has distinct Ok<T>/Err<E> alternatives. Recursive inline fields use deep-copy
Box<T>. Nat and Int use exact Boost.Multiprecision integers; negative Nat inputs
reject. Unit inputs use std::monostate and Unit results return void. Strings are
UTF-8 std::string values, including embedded NUL; bytes are std::vector<uint8_t>.

Resource wrappers share checked result leases and nominal identity when copied.
close() releases that wrapper; other owning copies remain usable. retain() makes
an independently owned reference. Calls reject closed, foreign-thread and inherited
post-fork resources. Foreign-thread destruction queues disposal for the creating
thread. Thread exit closes its session and releases registered native owners.
${anchoredResults ? `Functions returning resource-containing values use Value<T>, including empty
containers. get(), operator* and operator-> check the complete result lifetime.
Copies of Value<T> share immutable storage and its original owner. close() drops
one such reference. retain() or copy_value(value) creates independent ownership;
copy_value(rawValue) gives a host-assembled value its own result owner.

A parameter-anchored result borrows the original Value<T> argument's owner. Keep
that owner alive: releasing its last owning reference or transferring it expires
the result and every borrowed descendant. A borrowed result does not retain its
anchor. Resource equality compares canonical identity across different views.
Use get() again to validate access; a previously obtained C++ reference does not
perform further checks by itself. Resource leaves still validate their own use.
` : "Copied container storage is independent; its resource leaves retain their leases."}${transferredInputs ? anchoredResults ? `

Transferred inputs take Value<T>&&. Pass std::move(value) after constructing an
owner with a Lean call or copy_value. The original owner is consumed, not a copied
stand-in; aliases and all borrowed descendants expire before Lean or a callback
runs. A call cannot consume the anchor of its own result, or an ancestor of that
anchor. Borrowed Value<T> inputs cannot be transferred; retain() first. Validation
failures preserve owners. Failures after handoff leave them consumed.
` : `

Transferred inputs take rvalue references. Pass std::move(value), or a temporary.
The bridge validates every argument before consuming any resource lease. At the
C handoff, all submitted leases and their aliases become closed, before Lean or
a host callback runs. Each source lease can belong to only one transferred
argument; host-assembled values may contain several distinct leases. The entire
lease moves, including siblings omitted from the submitted value. Independent
retain() references survive. Callback borrows cannot be transferred; retain them
first. Failures before handoff preserve the input leases; failures after handoff
leave them consumed. Copied fields remain ordinary C++ values.
` : ""}

Typed lambdas and function objects are call-scoped callbacks. Borrowed callback
resource arguments expire on return, including copies of those wrappers. Call
retain() inside the callback to keep a resource. Reply storage is copied into an
owning C result before callback locals die. Original callback exceptions are
rethrown after C/Lean cleanup; no exception crosses a C trampoline. Later host
invocations in the same failed call are suppressed. Independent calls can recover.
Factories that cannot derive a failure-path value require
with_recovery(callback, typedValue); failures never publish it as successful output.
Returned Lean closures support function-call syntax and retain(). A closure that
captures a borrowed host callback cannot invoke that callback after the borrow ends.

Input, callback and result conversions share per-call depth128,262144-visit and
16MiB native/storage budgets. C/native conversion limits also apply; these do not
cap Lean algorithm working memory or GMP allocator overhead. GMP retains its
default fatal allocation-failure policy. Invalid inputs and partial conversions
release their temporary storage and ownership. Boundaries throw Error with a status;
C++ allocation failures throw std::bad_alloc.

${generated.values.functions.map(item => `- ${item.name}: ${item.id}`).join("\n")}
` : `# ${name} ${version}

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
publish outputs only on success. Keep and release earlier owners before reusing slots.${receiverExports ? `

Methods and properties take their receiver as the first argument. Receiver-borrowed
results also take that receiver's original result owner immediately after it.
Releasing or consuming the receiver owner expires the result and its descendants.
A result anchored to another parameter follows that parameter's owner instead.
` : ""}${transferredInputs ? `
Transferred inputs take an additional result-owner pointer immediately after the
value. Supply a distinct owner from the same session for each transferred argument.
Every resource in the value must belong to that owner. The bridge validates all
arguments before consuming any owner. Immediately before Lean runs, it consumes
each entire owner and sets its slot to NULL, including owners of empty values.
Failures before consumption preserve all input owners; later failures leave them
consumed. Do not reuse old views after the call returns. Independently retained
owners remain valid. Owner slots must not overlap output values or output owners.
` : ""}${anchoredResults ? `
Borrowed results take an additional input-owner handle after their anchor argument.
The returned owner depends on that exact input owner, even when the result has no
resources. Releasing or consuming the input owner expires every dependent result.
Use ${p}_result_validate before accessing a borrowed view; raw C field reads do not
perform validation. Keep its result owner until all view storage is no longer used,
then release it, including after expiration. Calls reject expired resource handles.
Generated _retain and _copy operations create independent ownership while a view is
valid. Independent aliases cannot revive an expired view. Compare resources with
their generated _equal operation; different view handles may identify one resource.
` : ""}

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
	const manifest = { schemaVersion: receiverExports ? 6 : anchoredResults ? 5 : transferredInputs ? 4 : hostCallbacks ? 3 : 2
		, kind: `lean-bridge-native-${target}-package`
		, ecosystem: target, name, version, component: model.component
		, profile: "native-library-v1"
		, runtimeIdentity, bindingIrSha256: model.bindingIrSha256, glibcMinimumVersion
		, cmakePackage, cmakeTarget, pkgConfig: name
		, ...(target === "c" ? { exactIntegers: "gmp-6.3.0" } : cpp.contract.boost ? { exactIntegers: "boost-multiprecision-1.90.0" } : {})
		, ownedValues: adapter.ownedValues
		, ...(target === "cpp" ? { cppValues: cpp.contract } : {})
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
		, backend: `native-${target}-owned-v${receiverExports ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : hostCallbacks ? 2 : 1}`
		, runtimeIdentity
		, glibcMinimumVersion
		, packages: [{ archive, sha256: sha256(bytes), bytes: bytes.length, name, version, compilerAccess: false }]
		, cmakePackage, cmakeTarget, pkgConfig: name };
};
