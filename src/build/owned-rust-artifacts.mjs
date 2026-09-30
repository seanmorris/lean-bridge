/**
 * Authenticate an owned C adapter and Rust projection against compiler facts.
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
 * Derive loader evidence from closed inventories and regenerated source contracts.
 *
 * @param options - Authenticated native artifact roots.
 * @param options.nativeRoot - Compiler-authenticated component.
 * @param options.runtimeRoot - Shared Lean runtime.
 * @param options.adapterRoot - Owned C adapter and bundled GMP.
 */
export const ownedRustEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true });
	if(!model.ownedGraph?.hostCallbacks) throw new TypeError("Owned Rust requires authenticated callback/copy support");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const anchoredResults = Boolean(model.ownedGraph.resultAnchors);
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks: true, transferredInputs, anchoredResults });
	const rust = generateOwnedRustPackage(model.bindingIr, null, {}, { transferredInputs, anchoredResults }), prefix = c.values.prefix;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-c-adapter.json"), "utf8"));
	const cpp = adapter.cppValues ? generateOwnedCppPackage(model.bindingIr, { transferredInputs, anchoredResults }) : null;
	const python = adapter.pythonValues ? generateOwnedPythonPackage(model.bindingIr, null, { transferredInputs, anchoredResults }) : null;
	await verifyNativeFiles(adapterRoot, adapter.files);
	if(adapter.schemaVersion !== (anchoredResults ? 5 : transferredInputs ? 4 : 3) || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${prefix}.so` || adapter.gmp?.version !== "6.3.0" || adapter.ownedValues?.schemaVersion !== (anchoredResults ? 4 : transferredInputs ? 3 : 2)
		|| canonicalJson(adapter.ownedValues.inputTransfers ?? null) !== canonicalJson(model.ownedGraph.inputTransfers ?? null)
		|| canonicalJson(adapter.ownedValues.resultAnchors ?? null) !== canonicalJson(model.ownedGraph.resultAnchors ?? null)
		|| canonicalJson(adapter.ownedValues.hostCallbacks) !== canonicalJson(model.ownedGraph.hostCallbacks)
		|| adapter.ownedValues.headerSha256 !== sha256(c.publicHeader) || adapter.ownedValues.sourceSha256 !== sha256(c.source)
		|| canonicalJson(adapter.rustValues ?? null) !== canonicalJson(rust.contract)
		|| canonicalJson(adapter.cppValues ?? null) !== canonicalJson(cpp?.contract ?? null)
		|| canonicalJson(adapter.pythonValues ?? null) !== canonicalJson(python?.contract ?? null)
		|| (await nativeArtifactPaths(adapterRoot)).some(path => path !== "native-c-adapter.json" && !Object.hasOwn(adapter.files, path)))
		throw new Error("Owned Rust adapter differs from compiler-authenticated types or lifetime rules");
	for(const [path, source] of Object.entries({ ...c.files, ...cpp?.files
		, ...python ? { "internal/python-abi.h": python.abiHeader } : {}
		, "internal/rust-abi.h": rust.abiHeader }))
		if(source !== await readFile(join(adapterRoot, path), "utf8")) throw new Error(`Owned Rust generated adapter source differs: ${path}`);
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
		, ownedValues: rust.contract
		, library: adapter.library, libraries };
	return { model, receipt, prefix, evidence, libraryPaths, adapter, runtime, rust };
};
