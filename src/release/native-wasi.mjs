/**
 * Arrange a prepared WIT/Wasmtime archive without access to a compiler.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { ordinaryWitEvidence, wasmtimeCapiIdentity } from "../build/native-wit-artifacts.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../backends/wit/copied-host.mjs";
import { witAliasReadme } from "../backends/wit/copied-aliases.mjs";
import { witVariantReadme } from "../backends/wit/copied-variants.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";

/**
 * Revalidate the compiled projection and copy its immutable payload.
 *
 * @param options - Compiled native/WIT roots, license source and target coordinates.
 */
export const packageOrdinaryWasi = async options => {
	const { working, nativeRoot, runtimeRoot, adapterRoot, witRoot, leanPrefix, settings = {}, glibcMinimumVersion } = options;
	const { model, receipt, projection, adapter, runtime, runtimeIdentity } = await ordinaryWitEvidence(options);
	const p = projection.surface.prefix;
	const compiled = JSON.parse(await readFile(join(witRoot, "native-wit-adapter.json"), "utf8"));
	await verifyNativeFiles(witRoot, compiled.files);
	if(compiled.wasmtime?.version !== wasmtimeCapiIdentity.version || compiled.wasmtime.archiveSha256 !== wasmtimeCapiIdentity.archiveSha256
		|| compiled.wasmtime.filesSha256 !== wasmtimeCapiIdentity.filesSha256 || sha256(canonicalJson(compiled.wasmtime.files)) !== wasmtimeCapiIdentity.filesSha256) throw new Error("WIT package requires the pinned Wasmtime C API");
	await verifyNativeFiles(join(witRoot, "wasmtime"), compiled.wasmtime.files);
	if(compiled.schemaVersion !== 1 || compiled.profile !== "native-wit-v1" || compiled.runtimeIdentity !== runtimeIdentity
		|| compiled.bindingIrSha256 !== model.bindingIrSha256 || compiled.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| compiled.adapterReceiptSha256 !== sha256(canonicalJson(adapter)) || compiled.glibcMinimumVersion !== glibcMinimumVersion
		|| canonicalJson(compiled.settings) !== canonicalJson(settings) || compiled.library !== `lib${p}_wasmtime.so`
		|| compiled.component !== `component/${projection.name}.wasm`
		|| (await nativeArtifactPaths(witRoot)).some(path => path !== "native-wit-adapter.json" && !Object.hasOwn(compiled.files, path))) throw new Error("WIT host differs from compiled native inputs");
	const expected = { [`wit/${projection.name}.wit`]: projection.wit
		, [`component/${projection.name}.wat`]: projection.wat
		, [`include/${p}_wasmtime.h`]: renderWitHostHeader(projection)
		, [`src/${p}_wasmtime.c`]: renderWitHostSource(projection, await readFile(join(witRoot, compiled.component)))
		, "binding-manifest.json": canonicalJson(projection.manifest) };
	for(const [path, contents] of Object.entries(expected)) if(await readFile(join(witRoot, path), "utf8") !== contents) throw new Error(`WIT generated source differs: ${path}`);
	const { name, version } = projection, archiveRoot = `${name}-${version}-wit-wasi`, root = join(working, "packages/wit-wasi", archiveRoot);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (from, path) => save(path, await readFile(from));
	const saveReadme = bytes => save("README.md", (projection.resources.length ? callableReadme(projection, glibcMinimumVersion) : bytes) + witAliasReadme(projection) + witVariantReadme(projection));
	for(const path of await nativeArtifactPaths(witRoot))
		await copy(join(witRoot, path), path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path);
	await copy(join(adapterRoot, "lib", adapter.library), `lib/${adapter.library}`);
	await copy(join(adapterRoot, `include/${p}.h`), `include/${p}.h`);
	await copy(join(nativeRoot, receipt.library), `lib/${receipt.library}`);
	for(const path of Object.keys(runtime.files).filter(path => path.startsWith("lib/"))) await copy(join(runtimeRoot, path), path);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `share/lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined) await copy(join(nativeRoot, "lake-generated-sources.json"), "share/lean-bridge/component/lake-generated-sources.json");
	await copy(join(adapterRoot, "native-c-adapter.json"), "share/lean-bridge/native-c-adapter.json");
	await copy(join(runtimeRoot, "runtime.json"), "share/lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "share/lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "share/lean-bridge/licenses/Lean-LICENSES");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`share/lean-bridge/licenses/${path}`, bytes);
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), "share/lean-bridge/licenses/LeanBridge-LICENSE");
	await save("package-metadata.json", canonicalJson(compiledPackageMetadata(model.sourceIdentity)));
	await save(`lib/pkgconfig/${name}-wit.pc`, `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib

Name: ${name}-wit
Description: Compiled Lean WIT API and Wasmtime 42.0.1 host
Version: ${version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -l${p}_wasmtime -lwasmtime
Cflags: -I\${includedir}
`);
	await saveReadme(`# ${name} ${version}\n\nWIT API compiled from ${model.component.id}. Linux x86-64, glibc ${glibcMinimumVersion} or newer. The archive includes Wasmtime 42.0.1 and the compiled native Lean runtime. Consumers do not install Lean. Keep lib/ and include/ together.\n\nUse pkg-config ${name}-wit, include ${p}_wasmtime.h, open a session with ${p}_wasmtime_open, and call a WIT function by name with ${p}_wasmtime_call. Calls cross the embedded Component Model component. ${p}_wasmtime_link supplies the native import to custom Wasmtime embeddings loading component/${name}.wasm. The component requires its native host; it is not a standalone WASI command. The host helper embeds exactly the same component bytes.\n\nArguments borrow caller-owned Wasmtime C values. Delete each owned result with wasmtime_component_val_delete; results remain valid after closing the session. Errors return an owned wasmtime_error_t and leave the result unchanged. Delete errors with wasmtime_error_delete. Close sessions with ${p}_wasmtime_close. Do not call one session concurrently. Separate sessions and components share the native Lean runtime automatically.\n\nUnit is enum { unit }, including arguments, results and fields. Nat is list<u32>, least-significant limb first; [] is zero. Int is { negative: bool, limbs: list<u32> }. Reject trailing zero limbs and negative zero. Fixed-width values use their WIT scalar widths. Float values preserve NaN classification, infinities and signed zero. Strings are UTF-8 including NUL; bytes are list<u8>. Options use option<T>, results use result<Success, Error>, and binary products use nested tuple<A, B>. Unit stays a single-case enum even inside an option or result, preserving present Unit and nested options. Lean Lists and Arrays both use canonical WIT \`list<T>\`, preserving order, duplicates and empty sequences. They retain distinct IR constructors and native C types. Returned sequences own independent storage. List parameters, results and record fields are supported; List callback payloads are not. Compound payloads compose with arrays, Lists and acyclic records, at most 32 types deep; empty records use a single-case enum { empty }. Record entries follow WIT field order. No resources, callbacks or effectful exports are admitted here.\n\nThe adapter enforces a 16 MiB conversion budget, counting Wasmtime slots and native scratch copies; the native C adapter also enforces its combined input/output budget. Canonical-ABI scratch memory is capped at 64 MiB and reset after each successful call. The session helper replaces a trapped store before reuse; custom embeddings must discard a trapped instance. These limits do not bound Lean algorithm or Wasmtime engine working memory. Native scratch allocation failures return errors and free scratch buffers. Wasmtime's allocation API does not expose recoverable out-of-memory errors.\n\n${surfaceList(projection)}\n`);
	const files = [];
	for(const path of await nativeArtifactPaths(root)) files.push({ path, bytes: await readFile(join(root, path)), mode: 0o644 });
	const manifest = { schemaVersion: 1, kind: "lean-bridge-ordinary-wit-package", ecosystem: "wit-wasi", name, version, component: model.component, bindingIrSha256: model.bindingIrSha256, runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, wasmtime: compiled.wasmtime.version, componentSha256: compiled.files[compiled.component].sha256, files: Object.fromEntries(files.map(file => [file.path, { bytes: file.bytes.length, sha256: sha256(file.bytes) }])) };
	const bytes = Buffer.from(canonicalJson(manifest)); await save("lean-bridge-package.json", bytes); files.push({ path: "lean-bridge-package.json", bytes, mode: 0o644 });
	const archive = `${archiveRoot}.tar.gz`, packed = createDeterministicTarGzFromFiles({ files: files.map(file => ({ ...file, path: `${archiveRoot}/${file.path}` })), sourceDateEpoch: 1 });
	await mkdir(join(working, "archives"), { recursive: true }); await writeFile(join(working, "archives", archive), packed, { flag: "wx" });
	return { ecosystem: "wit-wasi", backend: "ordinary-wit-native-v1", runtimeIdentity, glibcMinimumVersion, packages: [{ archive, name, version, bytes: packed.length, sha256: sha256(packed), compilerAccess: false }] };
};

const surfaceList = projection => projection.surface.functions.map(fn => `- ${fn.witName}: ${fn.declaration.id}`).join("\n");

const callableReadme = (projection, glibc) => {
	const { name, version, surface: { prefix: p } } = projection;
	return `# ${name} ${version}

Compiled Lean WIT API for Linux x86-64, glibc ${glibc} or newer. The archive includes Wasmtime 42.0.1 and the native Lean runtime. Consumers do not install Lean. Keep lib/ and include/ together. Compile the consuming application with pkg-config ${name}-wit and include ${p}_wasmtime.h.

## Session and calls

Open with ${p}_wasmtime_open. Use ${p}_wasmtime_invoke to call exports by their WIT names, including invoke-function-* exports. Every call crosses the embedded Component Model binary, also supplied as component/${name}.wasm. It requires the native host and is not a standalone WASI command. Callable imports require the owning session API; ${p}_wasmtime_link returns an error without modifying a caller-owned linker. Copied-only packages retain their custom-linker API.

Each ${p}_wasmtime_value holds either a copied Wasmtime value in value (function = 0), or an opaque callable token in function. Arguments borrow both kinds. Outputs are independently owned. Use fresh output slots; failure leaves them unchanged. Delete copied results with wasmtime_component_val_delete and errors with wasmtime_error_delete. Copied results remain valid after closing the session.

Register callbacks with ${p}_wasmtime_callback_create, naming a function-* resource from the WIT interface. The callback borrows its argument array and transfers an independently owned result or error to the adapter. The adapter deletes both the result and error, including a result populated before failure. Callback data transfers only when registration succeeds; its optional finalizer runs exactly once after active calls finish. Finalizers must not reenter their session.

Returned Lean functions use the same token representation. Call the matching invoke-function-* export with the token as the first argument. A returned function can also be passed to an export expecting the same callback signature. Close tokens with ${p}_wasmtime_function_close(session, &token). Successful close zeroes that variable; closing zero is harmless. Copied token aliases expire together. Wrong-session, wrong-signature and stale tokens are rejected before entering Wasmtime. Tokens are identities, not pointers or serialized handles.

Close the session with ${p}_wasmtime_close to release all remaining tokens. Sessions and tokens belong to their creating thread and process. Wrong-thread close does nothing; the creating thread must still close the session. Closing during a callback defers destruction until the outer call returns an error. Do not access a session after close. Separate sessions share the native Lean runtime, but cannot exchange tokens.

## Values, ownership and limits

All nineteen Lean primitives are admitted in callable signatures of one through sixteen arguments. Unit is enum { unit }; Nat is least-significant-first list<u32> ([] = zero); Int is { negative: bool, limbs: list<u32> }. Trailing zero limbs and negative zero are rejected. Strings are UTF-8 including NUL. Bytes are list<u8>. Fixed-width values, Char, USize and ISize use their declared WIT scalars (64-bit words here). Floats preserve NaN classification, infinities and signed zero. Copied arrays, Lists, acyclic records, options, results and binary products remain available outside callable signatures. Options use option<T>, results use result<Success, Error>, and products use nested tuple<A, B>. Unit retains its singleton enum inside branches.

Lean borrows a host callback only for the exporting call. Retaining that callback inside Lean does not extend the borrow; later invocation fails. Returned Lean functions have explicit leases. Closing during a call invalidates aliases immediately and defers cleanup of active uses. Synchronous callback reentry is bounded at 64 calls. Callbacks with arrays, Lists, records, options, results, products, nested callbacks, retained host borrows or asynchronous results remain unsupported.

A session holds at most 1024 callable tokens. All sessions/components also share the native runtime's identity capacity; a returned Lean function uses a native lease and a session token. Conversion work has a 16 MiB budget, including Wasmtime slots and native scratch copies. Canonical scratch memory has a 64 MiB cap. These limits do not bound Lean algorithm or Wasmtime working memory. Wasmtime allocation APIs do not expose recoverable out-of-memory errors.

The first callback failure is returned as an owned Wasmtime error (message limited to 1023 bytes). A trap poisons the active call chain. After it unwinds, the helper replaces the component store; surviving tokens and native Lean leases remain usable. Failed calls release temporary resources and unreturned leases. Copied-only packages retain their original host implementation.

## Exports

${surfaceList(projection)}
`;
};
