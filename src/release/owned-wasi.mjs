/**
 * Assemble compiler-free owned WIT releases from authenticated build artifacts.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { readVerifiedOwnedWitHost } from "../build/owned-wit-artifacts.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";

/**
 * Package the generated public API, native dependencies and complete notices.
 *
 * @param options - Compiled native/WIT roots, license source and output coordinates.
 */
export const packageOwnedWasi = async options => {
	const { working, nativeRoot, runtimeRoot, witRoot, leanPrefix, glibcMinimumVersion } = options;
	const verified = await readVerifiedOwnedWitHost(options);
	const { model, receipt, runtime, runtimeIdentity, projection, compiled, prefix: p } = verified;
	const { name, version } = projection, archiveRoot = `${name}-${version}-wit-wasi`;
	const root = join(working, "packages/wit-wasi", archiveRoot);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (from, path) => save(path, await readFile(from));
	for(const path of await nativeArtifactPaths(witRoot))
		await copy(join(witRoot, path), path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE"
			: path.startsWith("wasmtime/") ? path.slice(9) : path.startsWith("gmp/") ? path.slice(4) : path);
	await copy(join(nativeRoot, receipt.library), `lib/${receipt.library}`);
	for(const path of Object.keys(runtime.files).filter(path => path.startsWith("lib/"))) await copy(join(runtimeRoot, path), path);
	for(const path of ["native-component.json", "model.json", "metadata.json"
		, "binding-ir.json", "generated.lean", "component.h"
		, "allocation-guard.h", "artifacts.json"
		, ...model.ownedGraph.hostCallbacks ? ["callbacks.c"] : []])
		await copy(join(nativeRoot, path), `share/lean-bridge/component/${path}`);
	const generatedDigest = receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256;
	if(generatedDigest !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== generatedDigest) throw new Error("Owned WIT generated sources differ from compilation");
		await save("share/lean-bridge/component/lake-generated-sources.json", bytes);
	}
	await copy(join(runtimeRoot, "runtime.json"), "share/lean-bridge/runtime.json");
	for(const path of ["LICENSE", "LICENSES"]) await copy(join(leanPrefix, path), `share/lean-bridge/licenses/Lean-${path}`);
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`share/lean-bridge/licenses/${path}`, bytes);
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), "share/lean-bridge/licenses/LeanBridge-LICENSE");
	await save("package-metadata.json", canonicalJson(compiledPackageMetadata(model.sourceIdentity)));
	const cmakePackage = `LeanBridge${p.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("")}`;
	const cmakeTarget = `LeanBridge::${p}`;
	await save(`lib/pkgconfig/${name}-wit.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib

Name: ${name}-wit
Description: Compiled Lean ownership-aware WIT API and Wasmtime host
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p} -l:libgmp.so.10
Cflags: -I\${includedir}
`);
	await save(`lib/cmake/${cmakePackage}/${cmakePackage}Config.cmake`, `get_filename_component(_LB_PREFIX "\${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)
if(NOT TARGET ${cmakeTarget})
  add_library(${cmakeTarget} SHARED IMPORTED)
  set_target_properties(${cmakeTarget} PROPERTIES
    IMPORTED_LOCATION "\${_LB_PREFIX}/lib/${compiled.library}"
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
	await save("README.md", ownedWitReadme(verified, glibcMinimumVersion, cmakePackage, cmakeTarget));
	const files = [];
	for(const path of await nativeArtifactPaths(root)) files.push({ path, bytes: await readFile(join(root, path)), mode: 0o644 });
	const manifest = { schemaVersion: 2, kind: "lean-bridge-owned-wit-package"
		, ecosystem: "wit-wasi"
		, name, version, component: model.component
		, bindingIrSha256: model.bindingIrSha256, runtimeIdentity
		, sourceIdentity: model.sourceIdentity
		, glibcMinimumVersion
		, wasmtime: compiled.wasmtime.version, gmp: compiled.gmp.version
		, componentSha256: compiled.files[compiled.component].sha256
		, ownedValues: compiled.ownedValues, dependencies: compiled.dependencies
		, pkgConfig: `${name}-wit`, cmakePackage, cmakeTarget
		, files: Object.fromEntries(files.map(file => [file.path, { bytes: file.bytes.length, sha256: sha256(file.bytes) }])) };
	const bytes = Buffer.from(canonicalJson(manifest));
	await save("lean-bridge-package.json", bytes); files.push({ path: "lean-bridge-package.json", bytes, mode: 0o644 });
	const archive = `${archiveRoot}.tar.gz`;
	const packed = createDeterministicTarGzFromFiles({ files: files.map(file => ({ ...file, path: `${archiveRoot}/${file.path}` })), sourceDateEpoch: 1 });
	await mkdir(join(working, "archives"), { recursive: true }); await writeFile(join(working, "archives", archive), packed, { flag: "wx" });
	return { ecosystem: "wit-wasi", backend: "ordinary-wit-native-owned-graph-v1"
		, runtimeIdentity, glibcMinimumVersion
		, packages: [{ archive, name, version, bytes: packed.length, sha256: sha256(packed), compilerAccess: false }] };
};

const ownedWitReadme = ({ projection, prefix: p, model }, glibc, cmakePackage, cmakeTarget) => `# ${projection.name} ${projection.version}

Compiled ownership-aware WIT API from ${model.component.id}. Linux x86-64,
glibc ${glibc} or newer. The archive includes Wasmtime 42.0.1, the shared Lean
runtime, GMP 6.3.0 and its corresponding source and notices. Consumers need a
C11 compiler, not Lean. Keep the installed files together and unchanged.

Include ${p}.h. Use pkg-config ${projection.name}-wit, or
find_package(${cmakePackage} CONFIG REQUIRED) and link ${cmakeTarget}.
Both supply the bundled GMP dependency. The host loads Wasmtime and Lean
automatically. Do not link the Lean shared library directly into the executable.

## Sessions and calls

Open with ${p}_session_open and call the typed functions declared in the header.
Every exported function and returned Lean closure invocation crosses the embedded
Component Model binary. Retain and copy helpers only manage local ownership.
component/${projection.name}.wasm contains that same binary; wit/${projection.name}.wit
describes its contract. The component requires this native host. It is not a
standalone WASI command or a browser module. Raw Wasmtime resource handles and
custom caller-owned stores are not part of this public API.

Initialize each output owner to NULL. A successful call returns a typed value and
an independent result owner. Release it with ${p}_result_release. Failure leaves
both output slots unchanged. Inputs are borrowed for the call. A result owns all
its copied storage and resource leaves; aliases expire when that owner is released.
Use the generated retain/copy helpers to acquire independent ownership.

Close with ${p}_session_close. Resource operations reject closed sessions. Copied
result storage remains readable until its result owner is released, even after
session close. Sessions and owners belong to their creating thread and process.
Wrong-thread and inherited post-fork calls reject without consuming the owner.
Use exec to start a fresh consumer after fork. Close during a callback defers
store destruction until active calls unwind. Reentrant calls use separate stores.

## Values and callbacks

Records have source-named fields, variants have named constructors, and sequences
use typed data/length views. Options have explicit presence flags; results keep
Ok and Err distinct. Recursive values use typed pointers with checked traversal.
Unit, absent values, present Unit and nested options remain distinct. Nat and Int
use exact GMP integers; negative Nat inputs reject. Strings are UTF-8 with explicit
lengths, including embedded NUL. Bytes use byte spans. Resource identities and
returned closures are opaque checked handles, never serialized pointer values.

Typed host callbacks borrow their arguments for the callback invocation. Retain
resources during that invocation to keep them. Callback replies transfer an owned
result to the adapter; it releases that result after conversion, including on
failure. A callback error prevents the outer call from publishing a successful
result. Recovery values follow the typed callback descriptor in the header.
Retaining a Lean closure that captured a host callback does not extend that
callback's call-scoped borrow. Retained host callbacks and asynchronous callbacks
are not supported.

Input, callback and output conversions enforce the limits recorded in
binding-manifest.json. Canonical scratch memory is capped at 64 MiB per active
store. These limits do not cap Lean algorithm, GMP or Wasmtime working memory.
Native conversion allocation failures return status codes and roll back partial
owners. Wasmtime and GMP allocation APIs do not expose recoverable out-of-memory
errors. See the header for status codes and individual function signatures.

## Loaded-library identity

Before entering Lean or Wasmtime, the host checks the loaded component, both Lean
runtime libraries, GMP and Wasmtime against their compiler receipt sizes and
SHA-256 hashes. A different library already loaded under the same name makes
public calls return a runtime error. All inherited host calls, including cleanup,
return a process error after fork; the parent retains responsibility for cleanup.

## Exports

${projection.functions.map(fn => `- ${fn.witName}: ${fn.resource?.id ?? fn.declaration.id}`).join("\n")}
`;
