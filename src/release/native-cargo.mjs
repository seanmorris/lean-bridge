/**
 * Assemble deterministic ordinary Cargo crates without compiler access.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { ordinaryRustEvidence } from "../build/native-rust-artifacts.mjs";
import { generateCopiedRustPackage, copiedRustLock } from "../backends/rust/copied-values.mjs";
import { generateCopiedRustGraphPackage } from "../backends/rust/copied-graph-package.mjs";
import { validateOrdinaryCargoSettings } from "../backends/rust/copied-model.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";

/**
 * Archive checked Rust sources, compiled libraries and their provenance.
 *
 * @param options - Compiled roots and Cargo coordinates.
 * @param options.working - Private output directory.
 * @param options.rustRoot - Compile-checked Rust projection.
 * @param options.nativeRoot - Compiled Lean component.
 * @param options.runtimeRoot - Shared runtime.
 * @param options.adapterRoot - Compiled C adapter.
 * @param options.leanPrefix - Lean license notices.
 * @param options.settings - Cargo coordinates.
 * @param options.glibcMinimumVersion - Native ABI floor.
 */
export const packageOrdinaryCargo = async ({ working, rustRoot, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion }) => {
	validateOrdinaryCargoSettings(settings);
	const { model, prefix, evidence, receipt } = await ordinaryRustEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const compiled = JSON.parse(await readFile(join(rustRoot, "native-rust.json"), "utf8"));
	const name = settings.name ?? `lean_bridge_${prefix}`, version = settings.version ?? model.component.version;
	validateOrdinaryCargoSettings({ name, version });
	await verifyNativeFiles(rustRoot, compiled.files);
	if(compiled.schemaVersion !== 1 || compiled.profile !== "native-library-v1" || compiled.bindingIrSha256 !== model.bindingIrSha256
		|| compiled.name !== name || compiled.version !== version || canonicalJson(compiled.evidence) !== canonicalJson(evidence)
		|| !/^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /.test(compiled.rustc)
		|| (await nativeArtifactPaths(rustRoot)).some(path => path !== "native-rust.json" && !Object.hasOwn(compiled.files, path))) throw new Error("Compiled Rust projection differs from source or native evidence");
	const generate = model.copiedGraph ? generateCopiedRustGraphPackage : generateCopiedRustPackage;
	for(const [path, contents] of Object.entries(generate(model.bindingIr, evidence, { name, version, metadata: compiledPackageMetadata(model.sourceIdentity) })))
		if(await readFile(join(rustRoot, path), "utf8") !== contents) throw new Error("Generated Rust source differs from compiled package model");
	if(await readFile(join(rustRoot, "Cargo.lock"), "utf8") !== await copiedRustLock(name, version)) throw new Error("Cargo dependency lock differs from checked projection");
	for(const [file, hash] of Object.entries(evidence.libraries))
		if(sha256(await readFile(join(rustRoot, "native/linux-x64", file))) !== hash) throw new Error("Embedded Rust library differs from native evidence");
	const root = join(working, "packages/cargo", `${name}-${version}`);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const path of Object.keys(compiled.files)) await copy(join(rustRoot, path), path);
	await copy(join(rustRoot, "native-rust.json"), "lean-bridge/native-rust.json");
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined) await copy(join(nativeRoot, "lake-generated-sources.json"), "lean-bridge/component/lake-generated-sources.json");
	await copy(join(adapterRoot, "native-c-adapter.json"), "lean-bridge/native-c-adapter.json");
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "lean-bridge/licenses/Lean-LICENSES");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`lean-bridge/licenses/${path}`, bytes);
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-cargo-package", ecosystem: "cargo", name, version, component: model.component, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: evidence.runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, compiledProjectionSha256: sha256(canonicalJson(compiled)), files: inventory }));
	const archive = `${name}-${version}.crate`, bytes = await createDeterministicTarGz({ directory: root, archiveRoot: `${name}-${version}`, sourceDateEpoch: 1 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "cargo", backend: "ordinary-rust-v1", runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion, packages: [{ archive, name, version, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
