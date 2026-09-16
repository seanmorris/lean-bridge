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
	for(const path of await nativeArtifactPaths(witRoot))
		await copy(join(witRoot, path), path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path);
	await copy(join(adapterRoot, "lib", adapter.library), `lib/${adapter.library}`);
	await copy(join(adapterRoot, `include/${p}.h`), `include/${p}.h`);
	await copy(join(nativeRoot, receipt.library), `lib/${receipt.library}`);
	for(const path of Object.keys(runtime.files).filter(path => path.startsWith("lib/"))) await copy(join(runtimeRoot, path), path);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "artifacts.json"])
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
	await save("README.md", `# ${name} ${version}\n\nWIT API compiled from ${model.component.id}. Linux x86-64, glibc ${glibcMinimumVersion} or newer. The archive includes Wasmtime 42.0.1 and the compiled native Lean runtime. Consumers do not install Lean. Keep lib/ and include/ together.\n\nUse pkg-config ${name}-wit, include ${p}_wasmtime.h, open a session with ${p}_wasmtime_open, and call a WIT function by name with ${p}_wasmtime_call. Calls cross the embedded Component Model component. ${p}_wasmtime_link supplies the native import to custom Wasmtime embeddings loading component/${name}.wasm. The component requires its native host; it is not a standalone WASI command. The host helper embeds exactly the same component bytes.\n\nArguments borrow caller-owned Wasmtime C values. Delete each owned result with wasmtime_component_val_delete; results remain valid after closing the session. Errors return an owned wasmtime_error_t and leave the result unchanged. Delete errors with wasmtime_error_delete. Close sessions with ${p}_wasmtime_close. Do not call one session concurrently. Separate sessions and components share the native Lean runtime automatically.\n\nUnit is enum { unit }, including arguments, results and fields. Nat is list<u32>, least-significant limb first; [] is zero. Int is { negative: bool, limbs: list<u32> }. Reject trailing zero limbs and negative zero. Fixed-width values use their WIT scalar widths. Float values preserve NaN classification, infinities and signed zero. Strings are UTF-8 including NUL; bytes are list<u8>. Arrays and acyclic records nest at most 32 types deep; empty records use a single-case enum { empty }. Record entries follow WIT field order. No resources, callbacks or effectful exports are admitted here.\n\nThe adapter enforces a 16 MiB conversion budget, counting Wasmtime slots and native scratch copies; the native C adapter also enforces its combined input/output budget. Canonical-ABI scratch memory is capped at 64 MiB and reset after each successful call. The session helper replaces a trapped store before reuse; custom embeddings must discard a trapped instance. These limits do not bound Lean algorithm or Wasmtime engine working memory. Native scratch allocation failures return errors and free scratch buffers. Wasmtime's allocation API does not expose recoverable out-of-memory errors.\n\n${surfaceList(projection)}\n`);
	const files = [];
	for(const path of await nativeArtifactPaths(root)) files.push({ path, bytes: await readFile(join(root, path)), mode: 0o644 });
	const manifest = { schemaVersion: 1, kind: "lean-bridge-ordinary-wit-package", ecosystem: "wit-wasi", name, version, component: model.component, bindingIrSha256: model.bindingIrSha256, runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, wasmtime: compiled.wasmtime.version, componentSha256: compiled.files[compiled.component].sha256, files: Object.fromEntries(files.map(file => [file.path, { bytes: file.bytes.length, sha256: sha256(file.bytes) }])) };
	const bytes = Buffer.from(canonicalJson(manifest)); await save("lean-bridge-package.json", bytes); files.push({ path: "lean-bridge-package.json", bytes, mode: 0o644 });
	const archive = `${archiveRoot}.tar.gz`, packed = createDeterministicTarGzFromFiles({ files: files.map(file => ({ ...file, path: `${archiveRoot}/${file.path}` })), sourceDateEpoch: 1 });
	await mkdir(join(working, "archives"), { recursive: true }); await writeFile(join(working, "archives", archive), packed, { flag: "wx" });
	return { ecosystem: "wit-wasi", backend: "ordinary-wit-native-v1", runtimeIdentity, glibcMinimumVersion, packages: [{ archive, name, version, bytes: packed.length, sha256: sha256(packed), compilerAccess: false }] };
};

const surfaceList = projection => projection.surface.functions.map(fn => `- ${fn.witName}: ${fn.declaration.id}`).join("\n");
