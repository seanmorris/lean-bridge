/**
 * Verify ordinary PHP loader inputs against native compiler artifacts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compileCopiedPhpModel } from "../backends/php/copied-model.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "./native-artifacts.mjs";

/**
 * Derive loader identities from closed component, runtime and adapter inventories.
 *
 * @param options - Verified native staging roots.
 * @param options.nativeRoot - Compiled Lean component.
 * @param options.runtimeRoot - Shared Lean runtime.
 * @param options.adapterRoot - Compiled copied-value C adapter.
 */
export const ordinaryPhpEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity);
	const projection = compileCopiedPhpModel(model.bindingIr, { lists: true, variants: true });
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== 1 || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${projection.surface.prefix}.so`
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path))) throw new Error("PHP C adapter differs from compiled component");
	const evidence = { runtimeIdentity: identity, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, library: adapter.library
		, libraries: { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [receipt.library]: receipt.nativeLibrary.sha256
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) } };
	return { model, receipt, projection, evidence, adapter, runtime };
};
