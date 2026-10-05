/**
 * Compile-check prepared Rust ownership APIs over authenticated native artifacts.
 *
 * @file
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedRustPackage } from "../backends/rust/owned-package.mjs";
import { copiedRustLock } from "../backends/rust/copied-values.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { ownedRustEvidence } from "./owned-rust-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { packageOwnedCargo } from "../release/owned-cargo.mjs";

/**
 * Compile Rust without consumer linker configuration, then package its evidence.
 *
 * @param options - Authenticated native roots and Cargo build environment.
 */
export const projectOwnedRust = async options => {
	const { working, nativeRoot, runtimeRoot, adapterRoot, settings = {}, environment, signal } = options;
	const verified = await ownedRustEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, prefix, evidence, libraryPaths } = verified;
	const name = settings.name ?? `lean_bridge_${prefix}`, version = settings.version ?? model.component.version;
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const anchoredResults = Boolean(model.ownedGraph.resultAnchors);
	const receiverExports = Boolean(model.ownedGraph.receiverExports), hostCallbacks = Boolean(model.ownedGraph.hostCallbacks);
	const callbackResultAnchors = Boolean(model.ownedGraph.callbackResultAnchors);
	const generated = generateOwnedRustPackage(model.bindingIr, evidence, { name, version, metadata: compiledPackageMetadata(model.sourceIdentity) }, { transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, hostCallbacks });
	const root = join(working, "native/rust"), scratch = join(working, "rust-compiler");
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	for(const [path, source] of Object.entries(generated.files)) await save(path, source);
	await save("Cargo.lock", await copiedRustLock(name, version));
	for(const [name, source] of Object.entries(libraryPaths)) await save(`native/linux-x64/${name}`, await readFile(source));
	await save("lean-bridge/licenses/LeanBridge-LICENSE", await readFile(new URL("../../LICENSE", import.meta.url)));
	const env = { ...environment, RUSTC: environment.LEAN_BRIDGE_RUSTC ?? "rustc", CARGO_TARGET_DIR: scratch, RUSTFLAGS: "-Dwarnings" };
	for(const key of ["CARGO_ENCODED_RUSTFLAGS", "RUSTC_WRAPPER", "RUSTC_WORKSPACE_WRAPPER", "CARGO_BUILD_TARGET"]) delete env[key];
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env, signal });
	const rustc = (await run(env.RUSTC, ["--version"])).stdout.trim();
	if(!/^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u.test(rustc)) throw new Error("Owned Cargo packages require Rust 1.90 or newer");
	try
	{ await run(environment.LEAN_BRIDGE_CARGO ?? "cargo", ["check", "--locked", "--target", "x86_64-unknown-linux-gnu"]); }
	finally
	{ await rm(scratch, { recursive: true, force: true }); }
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("native-rust.json", canonicalJson({ schemaVersion: callbackResultAnchors ? 6 : receiverExports ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : 2
		, profile: "native-library-v1"
		, bindingIrSha256: model.bindingIrSha256, evidence, rustc, name, version
		, ownedValues: generated.contract, files }));
	return packageOwnedCargo({ ...options, rustRoot: root });
};
