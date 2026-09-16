/**
 * Check generated Rust against verified native artifacts before archiving.
 *
 * @file
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateCopiedRustPackage, copiedRustLock } from "../backends/rust/copied-values.mjs";
import { auditRustPackage } from "../backends/rust/package-audit.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { ordinaryRustEvidence } from "./native-rust-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOrdinaryCargo } from "../release/native-cargo.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";

/**
 * Compile-check Rust only. Lean and the C adapter are already compiled.
 *
 * @param options - Native roots, Cargo coordinates and compiler environment.
 * @param options.working - Private build directory.
 * @param options.nativeRoot - Compiled Lean component.
 * @param options.runtimeRoot - Shared runtime.
 * @param options.adapterRoot - Checked C adapter.
 * @param options.leanPrefix - Lean license source.
 * @param options.settings - Cargo name and version.
 * @param options.glibcMinimumVersion - Native ABI floor.
 * @param options.environment - Build environment.
 * @param options.signal - Cancellation signal.
 */
export const projectOrdinaryRust = async ({ working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion, environment, signal }) => {
	const { model, projection, evidence, receipt } = await ordinaryRustEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const name = settings.name ?? `lean_bridge_${projection.surface.prefix}`, version = settings.version ?? model.component.version;
	const root = join(working, "native/rust"), scratch = join(working, "rust-compiler");
	const files = generateCopiedRustPackage(model.bindingIr, evidence, { name, version, metadata: compiledPackageMetadata(model.sourceIdentity) });
	auditRustPackage(model.bindingIr, files);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	for(const [path, contents] of Object.entries(files)) await save(path, contents);
	await save("Cargo.lock", await copiedRustLock(name, version));
	for(const file of Object.keys(evidence.libraries))
	{
		const source = file === evidence.library ? join(adapterRoot, "lib", file) : file === receipt.library ? join(nativeRoot, file) : join(runtimeRoot, "lib", file);
		await save(`native/linux-x64/${file}`, await readFile(source));
	}
	await save("lean-bridge/licenses/LeanBridge-LICENSE", await readFile(new URL("../../LICENSE", import.meta.url)));
	const env = { ...environment, RUSTC: environment.LEAN_BRIDGE_RUSTC ?? "rustc", CARGO_TARGET_DIR: scratch };
	for(const key of ["RUSTFLAGS", "CARGO_ENCODED_RUSTFLAGS", "RUSTC_WRAPPER", "RUSTC_WORKSPACE_WRAPPER", "CARGO_BUILD_TARGET"]) delete env[key];
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env, signal });
	const rustc = (await run(env.RUSTC, ["--version"])).stdout.trim();
	if(!/^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /.test(rustc)) throw new Error("Ordinary Cargo packages require Rust 1.90 or newer");
	await run(environment.LEAN_BRIDGE_CARGO ?? "cargo", ["check", "--locked", "--target", "x86_64-unknown-linux-gnu"]);
	await rm(scratch, { recursive: true, force: true });
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("native-rust.json", canonicalJson({ schemaVersion: 1, profile: "native-library-v1", bindingIrSha256: model.bindingIrSha256, evidence, rustc, name, version, files: inventory }));
	return packageOrdinaryCargo({ working, rustRoot: root, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings, glibcMinimumVersion });
};
