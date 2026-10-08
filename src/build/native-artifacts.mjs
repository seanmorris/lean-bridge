/**
 * Closed native-library-v1 artifact inventories, independent of wasm32 policies.
 *
 * @file
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "./native-graph-model.mjs";
import { verifyReviewedOwnedSourceInputs } from "../analyze/reviewed-owned-source.mjs";
import { readVerifiedSourceNotices } from "../release/source-notices.mjs";
import { verifyPackageMetadataSource } from "../analyze/package-metadata.mjs";
import { verifyReviewedSourceInputs } from "../analyze/reviewed-source.mjs";
import { nativeAllocationGuardHeader } from "./native-allocation-guard.mjs";

/**
 * List regular payload files and reject symlinks and special filesystem entries.
 *
 * @param root - Filesystem root containing the native artifacts.
 * @param prefix - Relative path prefix or installed Perl library location.
 */
export async function nativeArtifactPaths(root, prefix = "")
{
	const result = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await nativeArtifactPaths(root, path));
		else if(entry.isFile()) result.push(path);
    else throw new Error(`unsupported native artifact: ${path}`);
	}
	return result.sort();
}

/**
 * Require the compiled Linux x86-64 ELF ABI before staging any native library.
 *
 * @param bytes - Exact compiled shared-library bytes.
 */
export const validateNativeElf = bytes => {
	if(bytes.length < 64 || bytes.subarray(0, 4).toString("hex") !== "7f454c46" || bytes[4] !== 2
    || bytes[5] !== 1 || bytes.readUInt16LE(18) !== 62 || bytes.readUInt16LE(16) !== 3) throw new Error("native-library-v1 requires Linux x86-64 little-endian shared ELF");
};

/**
 * Verify a closed, path-safe file inventory against the supplied artifact root.
 *
 * @param root - Filesystem root containing the native artifacts.
 * @param files - Expected artifact paths and SHA-256 identities.
 */
export async function verifyNativeFiles(root, files)
{
	if(!files || typeof files !== "object" || Array.isArray(files) || !Object.keys(files).length) throw new Error("invalid native file inventory");
	const actual = new Set(await nativeArtifactPaths(root));
	for(const [path, identity] of Object.entries(files))
	{
		// javac names nested classes Outer$Inner.class. Keep dollars out of directories
		// and non-class payloads; no shell interpretation is used for these paths.
		const safe = /^[A-Za-z0-9_.+/-]+$/.test(path) || /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z_][A-Za-z0-9_]*(?:\$[A-Za-z0-9_]+)+\.class$/.test(path);
		if(!actual.has(path) || !safe || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error(`invalid native artifact path: ${path}`);
		if(!identity || Object.keys(identity).sort().join(",") !== "bytes,sha256" || !Number.isSafeInteger(identity.bytes)
      || identity.bytes < 0 || !/^[a-f0-9]{64}$/.test(identity.sha256)) throw new Error("invalid native file identity");
		const bytes = await readFile(join(root, path));
		if(sha256(bytes) !== identity.sha256 || bytes.length !== identity.bytes) throw new Error(`native artifact drift: ${path}`);
		if(path.endsWith(".so")) validateNativeElf(bytes);
	}
}

/**
 * Read the exact runtime manifest and verify all its binaries and C headers.
 *
 * @param root - Filesystem root containing the native artifacts.
 */
export async function readVerifiedNativeRuntime(root)
{
	const bytes = await readFile(join(root, "runtime.json"));
	const manifest = JSON.parse(bytes);
	if(Object.keys(manifest).sort().join(",") !== "files,leanCommit,pointerBits,profile,schemaVersion"
    || manifest.schemaVersion !== 1 || manifest.profile !== "native-library-v1" || manifest.pointerBits !== 64
    || !/^[a-f0-9]{40}$/.test(manifest.leanCommit)
    || !["lib/libleanshared.so", "lib/liblean_bridge_native.so", "include/lean_bridge_native_runtime.h", "include/lean/lean.h"].every(path => Object.hasOwn(manifest.files, path))) throw new Error("invalid native runtime manifest");
	await verifyNativeFiles(root, manifest.files);
	if((await nativeArtifactPaths(root)).some(path => path !== "runtime.json" && !Object.hasOwn(manifest.files, path))) throw new Error("unrecorded native runtime artifact");
	return { manifest, identity: sha256(bytes) };
}

/**
 * Reconstruct source semantics and adapters before a new host projection.
 *
 * @param root - Compiled component directory.
 * @param runtimeIdentity - Expected shared runtime manifest identity.
 * @param options - Transport capabilities of the reader.
 * @param options.copiedGraphs - The caller implements the finite graph carrier model.
 * @param options.ownedGraphs - The caller implements explicit aggregate ownership.
 * @param options.ownedHostCallbacks - The caller implements owned host callback lifetimes.
 * @param options.ownedInputTransfers - The caller consumes validated input owners atomically.
 * @param options.ownedAnchoredResults - The caller validates original-owner result lifetimes.
 * @param options.ownedReceiverExports - The caller preserves receiver signatures and ownership.
 * @param options.ownedCallbackResultAnchors - The caller preserves callback-local result owners.
 * @param options.nativeRefinements - The caller checks top-level Fin bounds before Lean dispatch.
 * @param options.nativeCallbackRefinements - The caller checks a leased closure's Fin arguments before Lean dispatch.
 */
export async function readVerifiedNativeComponent(root, runtimeIdentity, { copiedGraphs = false, ownedGraphs = false, ownedHostCallbacks = false, ownedInputTransfers = false, ownedAnchoredResults = false, ownedReceiverExports = false, ownedCallbackResultAnchors = false, nativeRefinements = false, nativeCallbackRefinements = false } = {})
{
	const read = async path => JSON.parse(await readFile(join(root, path), "utf8"));
	const inventory = await read("artifacts.json"), receipt = await read("native-component.json"), model = await read("model.json");
	await verifyNativeFiles(root, inventory.files);
	if((await nativeArtifactPaths(root)).some(path => path !== "artifacts.json" && !Object.hasOwn(inventory.files, path))) throw new Error("unrecorded native component artifact");
	const metadata = await read("metadata.json");
	const callbackResults = model.schemaVersion === 11;
	const receivers = model.schemaVersion === 10 || (callbackResults && model.ownedGraph?.receiverExports !== undefined);
	const anchoredResults = model.schemaVersion === 9 || ((callbackResults || receivers) && model.ownedGraph?.resultAnchors !== undefined);
	const transferredInputs = model.schemaVersion === 8 || ((callbackResults || receivers || anchoredResults) && model.ownedGraph?.inputTransfers !== undefined);
	const hostCallbacks = model.schemaVersion === 7 || ((callbackResults || receivers || transferredInputs || anchoredResults) && model.ownedGraph?.hostCallbacks !== undefined);
	if(callbackResults && (!ownedGraphs || ownedCallbackResultAnchors !== true))
		throw Object.assign(new TypeError("This native component requires a callback-result lifetime consumer adapter"), { code: "native-owned-callback-anchors-unavailable" });
	if(receivers && (!ownedGraphs || ownedReceiverExports !== true))
		throw Object.assign(new TypeError("This native component requires a receiver-capable consumer adapter"), { code: "native-owned-receivers-unavailable" });
	if(anchoredResults && (!ownedGraphs || ownedAnchoredResults !== true))
		throw Object.assign(new TypeError("This native component requires an owner-anchored result consumer adapter"), { code: "native-owned-anchors-unavailable" });
	if(transferredInputs && (!ownedGraphs || !ownedInputTransfers))
		throw Object.assign(new TypeError("This native component requires an owned input-transfer consumer adapter"), { code: "native-owned-transfers-unavailable" });
	if(hostCallbacks && (!ownedGraphs || !ownedHostCallbacks))
		throw Object.assign(new TypeError("This native component requires an owned host-callback consumer adapter"), { code: "native-owned-callbacks-unavailable" });
	const refined = Array.isArray(model.exports) && model.exports.some(item => item?.refinements !== undefined);
	if(refined && nativeRefinements !== true)
		throw Object.assign(new TypeError("This native component requires a checked Fin consumer adapter"), { code: "native-refinements-unavailable" });
	const callbackRefined = refined && model.exports.some(item => [...(item.refinements?.parameters ?? []), item.refinements?.result].some(tree => tree?.kind === "callback"));
	if(callbackRefined && nativeCallbackRefinements !== true)
		throw Object.assign(new TypeError("This native component requires a consumer adapter that checks Fin in callbacks"), { code: "native-refinements-unavailable" });
	const reconstructed = createCompiledNativeModel({ metadata, component: model.component, moduleName: model.moduleName, sourceIdentity: receipt.sourceIdentity }, { ownedGraphs, ownedHostCallbacks: hostCallbacks, ownedInputTransfers: transferredInputs, ownedAnchoredResults: anchoredResults, ownedReceiverExports: receivers, ownedCallbackResultAnchors: callbackResults, nativeRefinements: refined, nativeCallbackRefinements: callbackRefined });
	const adapters = generateCompiledNativeLeanAdapters(reconstructed);
	if(receipt.profile !== "native-library-v1" || receipt.schemaVersion !== (callbackResults ? 7 : receivers ? 6 : anchoredResults ? 5 : transferredInputs ? 4 : hostCallbacks ? 3 : 2)
		|| canonicalJson(receipt.inputTransfers ?? null) !== canonicalJson(model.ownedGraph?.inputTransfers ?? null)
		|| canonicalJson(receipt.resultAnchors ?? null) !== canonicalJson(model.ownedGraph?.resultAnchors ?? null)
		|| canonicalJson(receipt.receiverExports ?? null) !== canonicalJson(model.ownedGraph?.receiverExports ?? null)
		|| canonicalJson(receipt.callbackResultAnchors ?? null) !== canonicalJson(model.ownedGraph?.callbackResultAnchors ?? null)
		|| receipt.runtimeIdentity !== runtimeIdentity
		|| canonicalJson(model) !== canonicalJson(reconstructed)
		|| receipt.modelSha256 !== sha256(canonicalJson(model))
		|| receipt.bindingIrSha256 !== model.bindingIrSha256
		|| canonicalJson(await read("binding-ir.json")) !== canonicalJson(model.bindingIr)
		|| receipt.metadataSha256 !== sha256(await readFile(join(root, "metadata.json")))
		|| receipt.headerSha256 !== sha256(adapters.header)
		|| adapters.header !== await readFile(join(root, "component.h"), "utf8")
		|| receipt.adaptersSha256 !== sha256(adapters.leanSource)
		|| adapters.leanSource !== await readFile(join(root, "generated.lean"), "utf8")
		|| receipt.allocationGuardSha256 !== sha256(nativeAllocationGuardHeader)
		|| nativeAllocationGuardHeader !== await readFile(join(root, "allocation-guard.h"), "utf8")
		|| receipt.initializer !== `initialize_${adapters.module}`
		|| !/^libcomponent_[0-9a-f]{20}\.so$/.test(receipt.library)) throw new Error("native component differs from compiler metadata or runtime");
	if(hostCallbacks && (receipt.callbackSourceSha256 !== sha256(adapters.callbackSource)
		|| adapters.callbackSource !== await readFile(join(root, "callbacks.c"), "utf8")))
		throw new Error("native host callbacks differ from compiler-authenticated recovery or trampolines");
	const bytes = await readFile(join(root, receipt.library));
	validateNativeElf(bytes);
	if(receipt.nativeLibrary.sha256 !== sha256(bytes) || receipt.nativeLibrary.bytes !== bytes.length) throw new Error("native component binary drift");
	const notices = await readVerifiedSourceNotices(root, receipt.sourceIdentity);
	verifyPackageMetadataSource(receipt.sourceIdentity, notices.document.packages[0].source.inputs);
	(model.ownedGraph ? verifyReviewedOwnedSourceInputs : verifyReviewedSourceInputs)(receipt.sourceIdentity, notices.document.packages[0].source.inputs);
	if(model.copiedGraph && !copiedGraphs) throw Object.assign(new TypeError("This native component requires a graph-capable consumer adapter"), { code: "native-graph-projection-unavailable" });
	return { model, receipt };
}
