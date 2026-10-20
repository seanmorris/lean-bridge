/**
 * Authenticate owned WIT hosts against native compiler facts and pinned SDKs.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { gmpIdentity } from "../backends/c/gmp.mjs";
import { compileOwnedWitGraphModel } from "../backends/wit/owned-graph-model.mjs";
import { generateOwnedWitPackage } from "../backends/wit/owned-package.mjs";
import { guardOwnedWitHostSource, ownedWitHostDependencies } from "../backends/wit/owned-host-evidence.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, validateNativeElf, verifyNativeFiles } from "./native-artifacts.mjs";
import { wasmtimeCapiIdentity } from "./native-wit-artifacts.mjs";

/**
 * Reconstruct the WIT contract from independently verified native inputs.
 *
 * @param options - Native component, shared runtime and WIT package coordinates.
 * @param options.nativeRoot - Verified compiled Lean component directory.
 * @param options.runtimeRoot - Verified shared native runtime directory.
 * @param options.settings - Optional WIT package name and version.
 */
export const ownedWitEvidence = async ({ nativeRoot, runtimeRoot, settings = {} }) => {
	const { manifest: runtime, identity: runtimeIdentity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, runtimeIdentity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true, ownedCallbackResultAnchors: true });
	if(!model.ownedGraph) throw new TypeError("Owned WIT requires an ownership-aware native component");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const inputs = { metadata, sourceIdentity: model.sourceIdentity
		, component: model.component
		, hostCallbacks: Boolean(model.ownedGraph.hostCallbacks)
		, transferredInputs: Boolean(model.ownedGraph.inputTransfers)
		, anchoredResults: Boolean(model.ownedGraph.resultAnchors)
		, receiverExports: Boolean(model.ownedGraph.receiverExports)
		, callbackResultAnchors: Boolean(model.ownedGraph.callbackResultAnchors) };
	return { model, receipt, runtime, runtimeIdentity, inputs
		, projection: compileOwnedWitGraphModel(model.bindingIr, settings, { transferredInputs: inputs.transferredInputs, anchoredResults: inputs.anchoredResults, receiverExports: inputs.receiverExports, callbackResultAnchors: inputs.callbackResultAnchors })
		, settings };
};

/**
 * Regenerate every host source, including exact loaded-library guards.
 *
 * @param evidence - Verified native compiler facts.
 * @param component - Compiled generated Component Model binary.
 * @param wasmtimeFiles - Verified pinned Wasmtime files.
 * @param gmpFiles - Verified pinned GMP build files.
 */
export const ownedWitSources = (evidence, component, wasmtimeFiles, gmpFiles) => {
	const generated = generateOwnedWitPackage(evidence.inputs, component, evidence.settings);
	const dependencies = ownedWitHostDependencies(evidence, wasmtimeFiles, gmpFiles);
	const source = guardOwnedWitHostSource(generated, dependencies);
	const { projection } = evidence, p = generated.values.prefix;
	return { generated, dependencies
		, files: { ...generated.files
			, [`src/${p}.c`]: source
			, [`wit/${projection.name}.wit`]: projection.wit
			, [`component/${projection.name}.wat`]: projection.wat
			, "binding-manifest.json": canonicalJson(projection.manifest) } };
};

/**
 * Preserve the native ownership policy and bind the generated public transport.
 * The model and sources come from independently reconstructed compiler inputs.
 *
 * @param model - Verified native component model.
 * @param sources - Regenerated WIT host sources.
 */
export const ownedWitValueContract = (model, sources) => ({
	schemaVersion: model.ownedGraph.callbackResultAnchors ? 5 : model.ownedGraph.receiverExports ? 4 : model.ownedGraph.resultAnchors ? 3 : model.ownedGraph.inputTransfers ? 2 : 1
	, hostCallbacks: model.ownedGraph.hostCallbacks ?? null
	, ...model.ownedGraph.inputTransfers ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
	, ...model.ownedGraph.resultAnchors ? { resultAnchors: model.ownedGraph.resultAnchors } : {}
	, ...model.ownedGraph.receiverExports ? { receiverExports: model.ownedGraph.receiverExports } : {}
	, ...model.ownedGraph.callbackResultAnchors ? { callbackResultAnchors: model.ownedGraph.callbackResultAnchors } : {}
	, headerSha256: sha256(sources.generated.publicHeader)
	, sourceSha256: sha256(sources.files[`src/${sources.generated.values.prefix}.c`])
});

/**
 * Reject altered capabilities and generated-file identities before installation.
 * This check does not replace the reader's binary, SDK or filesystem validation.
 *
 * @param compiled - Recorded WIT adapter receipt.
 * @param evidence - Independently verified native model, receipt and coordinates.
 * @param sources - Regenerated WIT host sources and dependency guards.
 * @param glibcMinimumVersion - Requested native platform floor.
 */
export const assertOwnedWitHostContract = (compiled, evidence, sources, glibcMinimumVersion) => {
	const { model, receipt, runtimeIdentity, projection, settings } = evidence;
	const p = sources.generated.values.prefix;
	if(compiled.schemaVersion !== 2 || compiled.profile !== "native-wit-v1"
		|| compiled.runtimeIdentity !== runtimeIdentity || compiled.bindingIrSha256 !== model.bindingIrSha256
		|| compiled.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| compiled.glibcMinimumVersion !== glibcMinimumVersion || !/^2\.\d+$/u.test(glibcMinimumVersion)
		|| canonicalJson(compiled.settings) !== canonicalJson(settings)
		|| compiled.library !== `lib${p}.so` || compiled.component !== `component/${projection.name}.wasm`
		|| !/^wasm-tools 1\.245\.1(?: |$)/u.test(compiled.wasmTools)
		|| canonicalJson(compiled.ownedValues) !== canonicalJson(ownedWitValueContract(model, sources))
		|| canonicalJson(compiled.dependencies) !== canonicalJson(sources.dependencies))
		throw new Error("Owned WIT host differs from compiler-authenticated types or runtime");
	for(const [path, source] of Object.entries(sources.files))
		if(canonicalJson(compiled.files?.[path]) !== canonicalJson({ bytes: Buffer.byteLength(source), sha256: sha256(source) }))
			throw new Error(`Owned WIT generated source identity differs: ${path}`);
};

/**
 * Verify a complete compiled host without invoking a producer toolchain.
 *
 * @param options - Native roots, compiled WIT root and package coordinates.
 */
export const readVerifiedOwnedWitHost = async options => {
	const { witRoot, glibcMinimumVersion } = options, evidence = await ownedWitEvidence(options);
	const { projection } = evidence;
	const compiled = JSON.parse(await readFile(join(witRoot, "native-wit-adapter.json"), "utf8"));
	await verifyNativeFiles(witRoot, compiled.files);
	if(compiled.wasmtime?.version !== wasmtimeCapiIdentity.version
		|| compiled.wasmtime.archiveSha256 !== wasmtimeCapiIdentity.archiveSha256
		|| compiled.wasmtime.filesSha256 !== wasmtimeCapiIdentity.filesSha256
		|| sha256(canonicalJson(compiled.wasmtime.files)) !== wasmtimeCapiIdentity.filesSha256)
		throw new Error("Owned WIT requires the pinned Wasmtime C API");
	await verifyNativeFiles(join(witRoot, "wasmtime"), compiled.wasmtime.files);
	const gmpRoot = join(witRoot, "gmp"), gmp = JSON.parse(await readFile(join(gmpRoot, "share/lean-bridge/gmp.json"), "utf8"));
	if(Object.entries(gmpIdentity).some(([key, value]) => gmp[key] !== value || compiled.gmp?.[key] !== value)
		|| gmp.checked !== true || gmp.soname !== undefined || gmp.binding !== undefined
		|| sha256(await readFile(join(gmpRoot, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))) !== gmpIdentity.sha256)
		throw new Error("Owned WIT requires the checked pinned GMP build and corresponding source");
	await verifyNativeFiles(gmpRoot, gmp.files);
	await verifyNativeFiles(gmpRoot, compiled.gmp.files);
	const gmpPaths = ["include/gmp.h", "lib/libgmp.so.10"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => `share/lean-bridge/licenses/GMP-${name}`)];
	if(canonicalJson(Object.keys(gmp.files).sort()) !== canonicalJson(gmpPaths.sort())
		|| canonicalJson(Object.keys(compiled.gmp.files).sort()) !== canonicalJson([...gmpPaths, "share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"].sort()))
		throw new Error("Owned WIT GMP inventory differs from the pinned build");
	validateNativeElf(await readFile(join(gmpRoot, "lib/libgmp.so.10")));
	const component = `component/${projection.name}.wasm`;
	const sources = ownedWitSources(evidence, await readFile(join(witRoot, component)), compiled.wasmtime.files, compiled.gmp.files);
	const p = sources.generated.values.prefix, library = `lib${p}.so`;
	assertOwnedWitHostContract(compiled, evidence, sources, glibcMinimumVersion);
	const paths = [...Object.keys(sources.files), component, `lib/${library}`
		, ...Object.keys(compiled.wasmtime.files).map(path => `wasmtime/${path}`)
		, ...Object.keys(compiled.gmp.files).map(path => `gmp/${path}`)].sort();
	if(canonicalJson(Object.keys(compiled.files).sort()) !== canonicalJson(paths)
		|| canonicalJson(await nativeArtifactPaths(witRoot)) !== canonicalJson([...paths, "native-wit-adapter.json"].sort()))
		throw new Error("Owned WIT host contains an unrecorded or unexpected artifact");
	for(const [path, source] of Object.entries(sources.files))
		if(await readFile(join(witRoot, path), "utf8") !== source) throw new Error(`Owned WIT generated source differs: ${path}`);
	return { ...evidence, ...sources, compiled, prefix: p };
};
