/**
 * Deterministic prepared Cargo archives with explicitly owned structured values.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { ownedRustEvidence } from "../build/owned-rust-artifacts.mjs";
import { generateOwnedRustPackage } from "../backends/rust/owned-package.mjs";
import { copiedRustLock } from "../backends/rust/copied-values.mjs";
import { validateOrdinaryCargoSettings } from "../backends/rust/copied-model.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";

/**
 * Reverify generated code and embedded dependencies without compiling anything.
 *
 * @param options - Verified projection roots and package coordinates.
 */
export const packageOwnedCargo = async options => {
	const { working, rustRoot, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion } = options;
	validateOrdinaryCargoSettings(settings);
	const { model, prefix, evidence, adapter, receipt } = await ownedRustEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const compiled = JSON.parse(await readFile(join(rustRoot, "native-rust.json"), "utf8"));
	const name = settings.name ?? `lean_bridge_${prefix}`, version = settings.version ?? model.component.version;
	const generated = generateOwnedRustPackage(model.bindingIr, evidence, { name, version, metadata: compiledPackageMetadata(model.sourceIdentity) });
	await verifyNativeFiles(rustRoot, compiled.files);
	if(compiled.schemaVersion !== 2 || compiled.profile !== "native-library-v1" || compiled.bindingIrSha256 !== model.bindingIrSha256
		|| compiled.name !== name || compiled.version !== version || canonicalJson(compiled.evidence) !== canonicalJson(evidence)
		|| canonicalJson(compiled.ownedValues) !== canonicalJson(generated.contract)
		|| !/^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u.test(compiled.rustc)
		|| (await nativeArtifactPaths(rustRoot)).some(path => path !== "native-rust.json" && !Object.hasOwn(compiled.files, path)))
		throw new Error("Owned Rust projection differs from compiler-authenticated types or lifetime rules");
	for(const [path, source] of Object.entries(generated.files))
		if(source !== await readFile(join(rustRoot, path), "utf8")) throw new Error(`Owned Rust generated source differs: ${path}`);
	if(await readFile(join(rustRoot, "Cargo.lock"), "utf8") !== await copiedRustLock(name, version))
		throw new Error("Owned Cargo dependency lock differs from checked projection");
	for(const [file, expected] of Object.entries(evidence.libraries))
		if(sha256(await readFile(join(rustRoot, "native/linux-x64", file))) !== expected) throw new Error("Owned Rust embedded library differs from native evidence");
	const root = join(working, "packages/cargo", `${name}-${version}`);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const path of Object.keys(compiled.files)) await copy(join(rustRoot, path), path);
	await copy(join(rustRoot, "native-rust.json"), "lean-bridge/native-rust.json");
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json", "callbacks.c"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256) throw new Error("Owned Rust generated Lean inputs differ from compilation");
		await save("lean-bridge/component/lake-generated-sources.json", bytes);
	}
	await copy(join(adapterRoot, "native-c-adapter.json"), "lean-bridge/native-c-adapter.json");
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "lean-bridge/licenses/Lean-LICENSES");
	for(const path of Object.keys(adapter.files).filter(path => path.startsWith("gmp/share/lean-bridge/")))
		await copy(join(adapterRoot, path), path.slice("gmp/share/".length));
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files)
		await save(`lean-bridge/licenses/${path}`, bytes);
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 2
		, kind: "lean-bridge-owned-cargo-package"
		, ecosystem: "cargo", name, version, component: model.component
		, bindingIrSha256: model.bindingIrSha256
		, runtimeIdentity: evidence.runtimeIdentity
		, sourceIdentity: model.sourceIdentity, glibcMinimumVersion
		, compiledProjectionSha256: sha256(canonicalJson(compiled))
		, ownedValues: generated.contract, files }));
	const archive = `${name}-${version}.crate`, bytes = await createDeterministicTarGz({ directory: root, archiveRoot: `${name}-${version}`, sourceDateEpoch: 1 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "cargo", backend: "owned-rust-v1"
		, runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion
		, packages: [{ archive, name, version, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
