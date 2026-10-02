/**
 * Authenticate owned Python loader inputs against compiled Lean and C artifacts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../backends/cpp/owned-package.mjs";
import { generateOwnedRustPackage } from "../backends/rust/owned-package.mjs";
import { generateOwnedPythonPackage } from "../backends/python/owned-package.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "./native-artifacts.mjs";

/**
 * Derive loader identities only after checking source, ABI and library inventories.
 *
 * @param options - Authenticated native artifact roots.
 * @param options.nativeRoot - Compiler-authenticated Lean component.
 * @param options.runtimeRoot - Compatible shared Lean runtime.
 * @param options.adapterRoot - Owned C adapter and bundled GMP.
 */
export const ownedPythonEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true, ownedCallbackResultAnchors: true });
	if(!model.ownedGraph?.hostCallbacks && !model.ownedGraph?.receiverExports && !model.ownedGraph?.callbackResultAnchors) throw new TypeError("Owned Python requires authenticated callback/copy, receiver or callback-result support");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const anchoredResults = Boolean(model.ownedGraph.resultAnchors);
	const receiverExports = Boolean(model.ownedGraph.receiverExports), hostCallbacks = Boolean(model.ownedGraph.hostCallbacks);
	const callbackResultAnchors = Boolean(model.ownedGraph.callbackResultAnchors);
	const options = { transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, hostCallbacks };
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, valueCopies: callbackResultAnchors, ...options });
	const python = generateOwnedPythonPackage(model.bindingIr, null, options), prefix = c.values.prefix;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	const cpp = adapter.cppValues ? generateOwnedCppPackage(model.bindingIr, options) : null;
	const rust = adapter.rustValues ? generateOwnedRustPackage(model.bindingIr, null, {}, options) : null;
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== (callbackResultAnchors ? 7 : receiverExports ? 6 : anchoredResults ? 5 : transferredInputs ? 4 : hostCallbacks ? 3 : 2) || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${prefix}.so` || adapter.gmp?.version !== "6.3.0" || adapter.ownedValues?.schemaVersion !== (callbackResultAnchors ? 6 : receiverExports ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : hostCallbacks ? 2 : 1)
		|| canonicalJson(adapter.ownedValues.inputTransfers ?? null) !== canonicalJson(model.ownedGraph.inputTransfers ?? null)
		|| canonicalJson(adapter.ownedValues.resultAnchors ?? null) !== canonicalJson(model.ownedGraph.resultAnchors ?? null)
		|| canonicalJson(adapter.ownedValues.receiverExports ?? null) !== canonicalJson(model.ownedGraph.receiverExports ?? null)
		|| canonicalJson(adapter.ownedValues.callbackResultAnchors ?? null) !== canonicalJson(model.ownedGraph.callbackResultAnchors ?? null)
		|| canonicalJson(adapter.ownedValues.hostCallbacks ?? null) !== canonicalJson(model.ownedGraph.hostCallbacks ?? null)
		|| adapter.ownedValues.headerSha256 !== sha256(c.publicHeader) || adapter.ownedValues.sourceSha256 !== sha256(c.source)
		|| canonicalJson(adapter.pythonValues ?? null) !== canonicalJson(python.contract)
		|| canonicalJson(adapter.cppValues ?? null) !== canonicalJson(cpp?.contract ?? null)
		|| canonicalJson(adapter.rustValues ?? null) !== canonicalJson(rust?.contract ?? null)
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path)))
		throw new Error("Owned Python adapter differs from compiler-authenticated types or lifetime rules");
	for(const [path, source] of Object.entries({ ...c.files, ...cpp?.files
		, ...rust ? { "internal/rust-abi.h": rust.abiHeader } : {}
		, "internal/python-abi.h": python.abiHeader }))
		if(source !== await readFile(join(adapterRoot, path), "utf8")) throw new Error(`Owned Python generated adapter source differs: ${path}`);
	const libraries = {
		[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [receipt.library]: receipt.nativeLibrary.sha256
		, "libgmp.so.10": adapter.files["gmp/lib/libgmp.so.10"].sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256]))
	};
	const libraryPaths = Object.fromEntries(Object.keys(libraries).map(file => [file
		, file === adapter.library ? join(adapterRoot, "lib", file)
			: file === receipt.library ? join(nativeRoot, file)
				: file === "libgmp.so.10" ? join(adapterRoot, "gmp/lib", file) : join(runtimeRoot, "lib", file)]));
	const evidence = { runtimeIdentity: identity, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, ownedValues: python.contract
		, library: adapter.library, libraries };
	return { model, receipt, prefix, evidence, libraryPaths, adapter, runtime, python };
};
