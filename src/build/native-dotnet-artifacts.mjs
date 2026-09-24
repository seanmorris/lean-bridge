/**
 * Verify ordinary .NET loader inputs against native compiler artifacts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compileCopiedDotnetModel } from "../backends/dotnet/copied-model.mjs";
import { compileCopiedDotnetGraphPackageModel } from "../backends/dotnet/copied-graph-package.mjs";
import { nativeGraphProjectionSources } from "./native-graph-sources.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "./native-artifacts.mjs";

/**
 * Derive loader evidence only from verified native component and C adapter bytes.
 *
 * @param options - Closed native staging roots.
 * @param options.nativeRoot - Native component artifacts.
 * @param options.runtimeRoot - Shared native runtime.
 * @param options.adapterRoot - Compiled C adapter artifacts.
 */
export const ordinaryDotnetEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { copiedGraphs: true });
	const projection = model.copiedGraph ? compileCopiedDotnetGraphPackageModel(model.bindingIr) : compileCopiedDotnetModel(model.bindingIr);
	const prefix = model.copiedGraph ? projection.prefix : projection.surface.prefix;
	const copiedGraph = model.copiedGraph ? { schemaVersion: 1, layoutSha256: projection.layoutSha256 } : undefined;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== 1 || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${prefix}.so`
		|| (copiedGraph ? canonicalJson(adapter.copiedGraph ?? null) !== canonicalJson(copiedGraph) : adapter.copiedGraph !== undefined)
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path))) throw new Error(".NET C adapter differs from compiled component");
	if(copiedGraph) for(const [path, source] of Object.entries(nativeGraphProjectionSources(model, receipt)))
		if(await readFile(join(adapterRoot, path), "utf8") !== source) throw new Error(`Generated .NET graph adapter source differs: ${path}`);
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
