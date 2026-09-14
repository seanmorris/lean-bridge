/**
 * Bind generated JVM native loading to verified compiler artifacts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compileCopiedJvmModel } from "../backends/jvm/copied-model.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "./native-artifacts.mjs";

/**
 * Verify native artifacts before generating JVM loader identities.
 *
 * @param options - Closed native runtime, component and C adapter roots.
 * @param options.nativeRoot - Verified native component artifacts.
 * @param options.runtimeRoot - Verified shared native runtime.
 * @param options.adapterRoot - Verified C adapter artifacts.
 */
export const ordinaryJvmEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity);
	const projection = compileCopiedJvmModel(model.bindingIr);
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== 1 || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${projection.surface.prefix}.so`
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path))) throw new Error("JVM C adapter differs from compiled component");
	const evidence = { runtimeIdentity: identity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, library: adapter.library
		, libraries: { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [receipt.library]: receipt.nativeLibrary.sha256
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) } };
	return { model, receipt, projection, evidence };
};
