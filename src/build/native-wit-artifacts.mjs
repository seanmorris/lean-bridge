/**
 * Verify ordinary WIT input libraries against compiler-owned native receipts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compileCopiedWitModel } from "../backends/wit/copied-model.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "./native-artifacts.mjs";

/** Official v42.0.1 archive, also pinned by flake.nix. */
export const wasmtimeCapiIdentity = Object.freeze({
	version: "42.0.1"
	, archiveSha256: "2097a47351918a446b26c7e65f487278f63bc947591b71897db547cd90c05082"
	, filesSha256: "ec43764474c7f9cedf469659d0c5cc9401f65b79f5df88acda772280ae81fe01"
});

/**
 * Reconstruct WIT semantics after validating all shared native inputs.
 *
 * @param root0 - Compiled native staging roots and target coordinates.
 * @param root0.nativeRoot - Compiled Lean component.
 * @param root0.runtimeRoot - Compiled shared Lean runtime.
 * @param root0.adapterRoot - Copied-value C adapter.
 * @param root0.settings - Optional WIT package name and version.
 */
export const ordinaryWitEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot, settings }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity);
	const projection = compileCopiedWitModel(model.bindingIr, settings, { callables: true });
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== 1 || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${projection.surface.prefix}.so`
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path))) throw new Error("WIT C adapter differs from compiled component");
	return { model, receipt, projection, adapter, runtime, runtimeIdentity: identity };
};
