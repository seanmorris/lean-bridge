/**
 * Bind generated JVM native loading to verified compiler artifacts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compileCopiedJvmModel } from "../backends/jvm/copied-model.mjs";
import { compileCopiedJvmGraphPackageModel } from "../backends/jvm/copied-graph-package.mjs";
import { nativeGraphProjectionSources } from "./native-graph-sources.mjs";
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
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { copiedGraphs: true });
	const projection = model.copiedGraph ? compileCopiedJvmGraphPackageModel(model.bindingIr) : compileCopiedJvmModel(model.bindingIr);
	const prefix = model.copiedGraph ? projection.prefix : projection.surface.prefix;
	const copiedGraph = model.copiedGraph ? { schemaVersion: 1, layoutSha256: projection.layoutSha256 } : undefined;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== 1 || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${prefix}.so`
		|| (copiedGraph ? canonicalJson(adapter.copiedGraph ?? null) !== canonicalJson(copiedGraph) : adapter.copiedGraph !== undefined)
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path))) throw new Error("JVM C adapter differs from compiled component");
	if(copiedGraph) for(const [path, source] of Object.entries({ ...nativeGraphProjectionSources(model, receipt), "src/jvm-graph-clear.c": projection.nativeReleaseSource }))
		if(await readFile(join(adapterRoot, path), "utf8") !== source) throw new Error(`Generated JVM graph adapter source differs: ${path}`);
	const evidence = { runtimeIdentity: identity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, ...copiedGraph ? { copiedGraph } : {}
		, library: adapter.library
		, libraries: { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [receipt.library]: receipt.nativeLibrary.sha256
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) } };
	return { model, receipt, projection, evidence, adapter, runtime };
};
