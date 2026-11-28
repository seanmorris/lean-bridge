/**
 * Closed receipts for compiler-checked owned JavaScript side modules.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { validateJavaScriptWasmControl as validateOwnedJavaScriptWasmBinary } from "../abi/component-wasm-control.mjs";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters, javascriptWasmOwnedProfile as profile } from "./javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "./javascript-wasm-owned-sources.mjs";
import { readVerifiedSourceNotices } from "../release/source-notices.mjs";
import { verifyPackageMetadataSource } from "../analyze/package-metadata.mjs";
import { verifyReviewedOwnedSourceInputs } from "../analyze/reviewed-owned-source.mjs";
import { validateLakeNativeCompilation } from "./lake-native-inputs.mjs";
import { javascriptWasmOwnedPins, javascriptWasmTargetHeaders, validJavaScriptWasmCompilerIdentity } from "./javascript-wasm-toolchain.mjs";

export { javascriptWasmOwnedPins, javascriptWasmCompilerFiles, javascriptWasmTargetHeaders } from "./javascript-wasm-toolchain.mjs";
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const closed = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$(?![\s\S])/.test(value);
const file = value => closed(value, ["bytes", "sha256"]) && Number.isSafeInteger(value.bytes) && value.bytes >= 0 && hash(value.sha256);
export { validateOwnedJavaScriptWasmBinary };

/**
 * Reconstruct adapters and verify all retained inputs before packaging a binary.
 * Receipt hashes check consistency. Publisher authentication is supplied by the
 * release channel, not by a colocated receipt.
 *
 * @param root - Compiled ownership component directory.
 */
export const readVerifiedOwnedJavaScriptWasmComponent = async root => {
	const read = async path => JSON.parse(await readFile(join(root, path), "utf8"));
	const inventory = await read("artifacts.json");
	if(!closed(inventory, ["schemaVersion", "profile", "files"]) || inventory.schemaVersion !== 1 || inventory.profile !== profile
		|| !inventory.files || typeof inventory.files !== "object" || Array.isArray(inventory.files)) throw new Error("Invalid owned JavaScript artifact inventory");
	if(!same(await nativeArtifactPaths(root), [...Object.keys(inventory.files), "artifacts.json"].sort())) throw new Error("Unrecorded or missing owned JavaScript artifact");
	for(const [path, entry] of Object.entries(inventory.files))
	{
		if(!/^[A-Za-z0-9_.+/-]+$(?![\s\S])/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")
			|| !file(entry) || !same(entry, identity(await readFile(join(root, path))))) throw new Error(`Owned JavaScript artifact drift: ${path}`);
	}
	const receipt = await read("javascript-wasm-component.json"), model = await read("model.json"), metadata = await read("metadata.json");
	const reconstructed = createOwnedJavaScriptWasmModel({ metadata
		, component: model.component, sourceIdentity: receipt.sourceIdentity
		, hostCallbacks: Boolean(model.ownedGraph?.hostCallbacks)
		, transferredInputs: Boolean(model.ownedGraph?.inputTransfers)
		, anchoredResults: Boolean(model.ownedGraph?.resultAnchors)
		, callbackResultAnchors: Boolean(model.ownedGraph?.callbackResultAnchors)
		, receiverExports: Boolean(model.ownedGraph?.receiverExports) });
	const adapters = generateOwnedJavaScriptWasmLeanAdapters(reconstructed);
	const generated = generateCompiledJavaScriptWasmOwned(reconstructed, metadata, adapters);
	const headers = Object.fromEntries(javascriptWasmTargetHeaders.map(name => [`compiler/include/lean/${name}`, inventory.files[`compiler/include/lean/${name}`]]));
	if(!closed(receipt, ["schemaVersion", "profile", "pointerBits", "pins", "bindingIrSha256", "sourceIdentity", "metadataSha256", "modelSha256", "headerSha256", "adaptersSha256", "ownedGraph", "initializer", "library", "wasmLibrary", "compiler", "targetHeaders", ...(receipt.nativeCompilation ? ["nativeCompilation"] : [])])
		|| receipt.schemaVersion !== 1 || receipt.profile !== profile || receipt.pointerBits !== 32
		|| !same(receipt.pins, javascriptWasmOwnedPins) || receipt.sourceIdentity.leanCommit !== javascriptWasmOwnedPins.leanCommit
		|| !validJavaScriptWasmCompilerIdentity(receipt.compiler) || !same(receipt.targetHeaders, headers) || !Object.values(headers).every(file)
		|| !same(model, reconstructed) || receipt.modelSha256 !== sha256(canonicalJson(model))
		|| receipt.bindingIrSha256 !== model.bindingIrSha256 || !same(await read("binding-ir.json"), model.bindingIr)
		|| receipt.metadataSha256 !== sha256(canonicalJson(metadata))
		|| receipt.headerSha256 !== sha256(adapters.header) || adapters.header !== await readFile(join(root, "component.h"), "utf8")
		|| receipt.adaptersSha256 !== sha256(adapters.leanSource) || adapters.leanSource !== await readFile(join(root, "generated.lean"), "utf8")
		|| !same(receipt.ownedGraph, generated.receipt) || receipt.initializer !== generated.privateAbi.initializer
		|| receipt.library !== "lib/component.so.wasm") throw new Error("Owned JavaScript component differs from compiler metadata, headers or adapters");
	for(const [path, source] of Object.entries(generated.files))
		if(source !== await readFile(join(root, path), "utf8")) throw new Error(`Owned JavaScript generated source drift: ${path}`);
	const version = await readFile(join(root, "compiler/include/lean/version.h"), "utf8");
	if(!/^#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"\r?$/m.test(version)
		|| !/^#define LEAN_VERSION_STRING "4\.32\.2"\r?$/m.test(version)) throw new Error("Owned JavaScript target headers differ from the pinned Lean target");
	const generatedSources = receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 ? await read("lake-generated-sources.json") : null;
	if(generatedSources && sha256(canonicalJson(generatedSources)) !== receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256)
		throw new Error("JavaScript generated Lake source identity mismatch");
	if(receipt.nativeCompilation) validateLakeNativeCompilation(receipt.nativeCompilation, {
		snapshotSha256: receipt.sourceIdentity.lakeDependencies?.snapshotSha256
		, profile: "side-module-2"
		, ...(generatedSources ? { overlaySha256: generatedSources.overlaySha256 } : {})
	});
	const bytes = await readFile(join(root, receipt.library));
	if(!same(receipt.wasmLibrary, identity(bytes))) throw new Error("Owned JavaScript binary drift");
	await validateOwnedJavaScriptWasmBinary(bytes, generated.privateAbi.controlSymbol, Boolean(reconstructed.ownedGraph.hostCallbacks));
	const notices = await readVerifiedSourceNotices(root, receipt.sourceIdentity);
	verifyPackageMetadataSource(receipt.sourceIdentity, notices.document.packages[0].source.inputs);
	verifyReviewedOwnedSourceInputs(receipt.sourceIdentity, notices.document.packages[0].source.inputs);
	const expected = ["binding-ir.json", "component.h", "generated.lean"
		, "metadata.json", "model.json", "javascript-wasm-component.json"
		, receipt.library, ...Object.keys(headers), "compiler/notices/lean.txt"
		, ...Object.keys(generated.files), ...notices.files.keys()
		, ...(generatedSources ? ["lake-generated-sources.json"] : [])].sort();
	if(!same(Object.keys(inventory.files).sort(), expected) || inventory.files["compiler/notices/lean.txt"].bytes === 0)
		throw new Error("Unexpected owned JavaScript compiler artifact or missing license");
	return { model, receipt, privateAbi: generated.privateAbi, identity: sha256(canonicalJson(receipt)) };
};
